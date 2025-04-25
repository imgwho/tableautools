/**
 * Tableau计算字段提取工具
 * 从Tableau工作簿(.twb/.twbx)中提取字段和计算信息
 */

// --- 核心提取函数 ---

/**
 * 从解析后的 TWB XML 文档中提取字段和计算信息
 * @param {XMLDocument} xmlDoc - 解析后的 XML 文档对象
 * @returns {object} - 返回包含字段列表和计算列表的对象 { fields: [], calcs: [] }
 */
function extractDataFromTwb(xmlDoc) {
  const allFields = []; // 用于存储所有提取的字段信息
  let counter = 0; // 简单的计数器，用于生成唯一标识或排序

  const datasources = xmlDoc.getElementsByTagName('datasource'); // 获取所有的 <datasource> 元素

  // 遍历每个数据源
  for (const ds of datasources) {
    // 获取数据源名称和标题 (优先使用标题 caption, 否则用 name)
    const dsName = ds.getAttribute('name') || 'Unknown Datasource'; // 数据源内部名称
    const dsCaption = ds.getAttribute('caption') || dsName; // 数据源显示名称
    const isParameterDs = dsName.toLowerCase() === 'parameters'; // 判断是否是参数数据源

    // 获取数据源下的所有 <column> 元素
    const columns = ds.getElementsByTagName('column');
    for (const col of columns) {
      // 获取字段的各种属性
      const fieldId = col.getAttribute('id') || `[${col.getAttribute('name') || `col_${counter}`}]`; // 字段ID (可能需要生成)
      const fieldName = col.getAttribute('name') || fieldId; // 字段名
      const fieldCaption = col.getAttribute('caption') || fieldName; // 字段标题 (显示用)

      // 查找字段下的 <calculation> 元素
      const calculationTag = col.getElementsByTagName('calculation')[0];
      const fieldCalculation = calculationTag ? calculationTag.getAttribute('formula') : null; // 获取计算公式

      // 查找字段描述
      const descTag = col.getElementsByTagName('desc')[0]; // 查找 <desc> 标签
      // 描述通常在 <formatted-text><run>...</run></formatted-text> 结构里
      const descriptionElement = descTag ? descTag.getElementsByTagName('formatted-text')[0]?.getElementsByTagName('run')[0] : null;
      const fieldDesc = descriptionElement ? descriptionElement.textContent : null; // 获取描述文本

      // 构建字段数据对象
      const fieldData = {
        counter: counter++, // 计数器
        datasource_name: dsName, // 数据源内部名
        datasource_caption: dsCaption, // 数据源显示名
        alias: col.getAttribute('alias'), // 别名
        field_calculation: fieldCalculation, // 计算公式 (后面可能会被友好名称替换)
        field_calculation_bk: fieldCalculation, // 备份原始计算公式，用于依赖分析
        field_caption: fieldCaption, // 字段显示名
        field_datatype: col.getAttribute('datatype'), // 数据类型 (string, integer, etc.)
        field_def_agg: col.getAttribute('default-aggregation'), // 默认聚合方式 (sum, avg, etc.)
        field_desc: fieldDesc, // 字段描述
        field_hidden: col.getAttribute('hidden') === 'true', // 是否隐藏
        field_id: fieldId, // 字段ID (通常是 [Name] 格式)
        // 语义角色 (近似判断，TWB XML 结构可能变化)
        field_is_nominal: col.getAttribute('semantic-role') === '[Nominal]',
        field_is_ordinal: col.getAttribute('semantic-role') === '[Ordinal]',
        field_is_quantitative: col.getAttribute('semantic-role') === '[Measure]',
        field_name: fieldName, // 字段内部名
        field_role: col.getAttribute('role'), // 角色 (dimension, measure)
        field_type: col.getAttribute('type'), // 类型 (quantitative, ordinal, nominal)
        // field_worksheets: TBD - 提取工作表使用情况比较复杂，暂不实现
      };

      // 初步分类字段类型 (后续会精炼)
      if (isParameterDs || (col.parentElement && col.parentElement.nodeName === 'datasource' && col.parentElement.getAttribute('name')?.toLowerCase() === 'parameters')) {
        // 如果字段属于 'Parameters' 数据源，则分类为参数
        fieldData.category = 'Parameters';
      } else if (fieldCalculation !== null) {
        // 如果有计算公式，则分类为计算字段
        fieldData.category = 'Calculated_Field';
      } else {
        // 否则为默认字段
        fieldData.category = 'Default_Field';
      }

      allFields.push(fieldData); // 将字段数据添加到列表
    }

    // 特殊处理 <datasource name='Parameters'> 下直接列出的 <param> 元素
    if (isParameterDs) {
      const parameters = ds.getElementsByTagName('param'); // 查找 <param> 标签 (标签名可能需确认)
      for (const param of parameters) {
        const fieldId = `[${param.getAttribute('name')}]`; // 参数的 ID 通常是 [ParamName]
        // 检查是否已通过 <column> 添加过 (不太可能，但以防万一)
        if (!allFields.some(f => f.field_id === fieldId && f.datasource_name === 'Parameters')) {
          // 如果未添加，则构建参数的字段数据并添加
          allFields.push({
            counter: counter++,
            datasource_name: dsName,
            datasource_caption: dsCaption,
            alias: param.getAttribute('alias'),
            field_calculation: null, // 参数通常没有计算公式
            field_calculation_bk: null,
            field_caption: param.getAttribute('caption') || param.getAttribute('name'), // 显示名
            field_datatype: param.getAttribute('datatype'), // 数据类型
            field_desc: null, // 参数一般没有 <desc>
            field_hidden: false, // 参数通常不隐藏
            field_id: fieldId, // ID
            field_name: param.getAttribute('name'), // 内部名
            field_role: 'parameter', // 角色
            field_type: 'quantitative', // 类型 (通常，取决于参数定义)
            category: 'Parameters' // 分类为参数
          });
        }
      }
    }
  }

  // --- 数据后处理 ---

  // 1. 创建字段 ID -> 友好名称 [FieldName] 的映射，用于替换计算公式中的 ID
  const calcMapRaw = new Map(); // key: 原始ID (无括号), value: 友好名称 [FieldName]
  allFields.forEach(field => {
    // 包含计算字段、参数和默认字段，因为它们都可能在其他计算中被引用
    const cleanId = field.field_id.replace(/[\[\]]/g, ''); // 移除 ID 中的方括号
    const friendlyName = `[${field.field_caption || field.field_name}]`; // 使用 Caption 或 Name 作为友好名称
    // 优先使用计算字段/参数的名称，避免被同名默认字段覆盖
    if (field.category === 'Calculated_Field' || field.category === 'Parameters') {
      calcMapRaw.set(cleanId, friendlyName);
    } else if (!calcMapRaw.has(cleanId)) { // 如果不是计算/参数，且该 cleanId 还未被映射，则添加默认字段的映射
      calcMapRaw.set(cleanId, friendlyName);
    }
  });


  // 2. 替换计算公式中的字段 ID 为友好名称 (对 `field_calculation` 进行修改)
  allFields.forEach(field => {
    if (field.field_calculation) { // 只处理有计算公式的字段
      let formula = field.field_calculation;
      // 获取所有映射的 key (原始ID，无括号)，按长度降序排序
      // 排序是为了优先替换长名称，避免如 [Sales] 错误替换 [Sales Amount] 的一部分
      const sortedKeys = Array.from(calcMapRaw.keys()).sort((a, b) => b.length - a.length);

      sortedKeys.forEach(keyId => {
        // 使用正则表达式精确替换 `[原始ID]` 为对应的 `[友好名称]`
        // 需要转义 keyId 中的正则表达式特殊字符
        const escapedKeyId = keyId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // 创建正则表达式，匹配方括号包围的、转义后的 keyId，全局替换，忽略大小写 (g, i)
        const regex = new RegExp(`\\[${escapedKeyId}\\]`, 'gi');
        const replacement = calcMapRaw.get(keyId); // 获取对应的友好名称
        if (replacement) {
          formula = formula.replace(regex, replacement);
        }
      });
      field.field_calculation = formula; // 更新字段对象的计算公式
    }
  });

  // 3. 过滤重复字段 (特别是参数可能在多个数据源下出现)
  // 策略：优先保留来自 'Parameters' 数据源的参数，对于其他字段保留第一次出现的
  const uniqueFields = []; // 存储去重后的字段
  const seenFieldIds = new Set(); // 存储已经添加的字段 ID

  // 先按数据源排序，将 'Parameters' 数据源的字段排在前面
  allFields
    .sort((a, b) => {
      if (a.datasource_name === 'Parameters' && b.datasource_name !== 'Parameters') return -1; // a 来自 Parameters，排前面
      if (a.datasource_name !== 'Parameters' && b.datasource_name === 'Parameters') return 1; // b 来自 Parameters，排前面
      return a.counter - b.counter; // 其他情况保持原始相对顺序
    })
    .forEach(field => {
      // 如果这个字段的 ID 还没见过，就添加到 uniqueFields 列表，并记录 ID
      if (!seenFieldIds.has(field.field_id)) {
        uniqueFields.push(field);
        seenFieldIds.add(field.field_id);
      }
      // (这里的逻辑保证了如果 Parameters 数据源的同 ID 字段先出现，就会被保留)
    });


  // 4. 最终排序，用于表格显示
  const preferenceOrder = ['Parameters', 'Calculated_Field', 'Default_Field']; // 定义类型优先级
  uniqueFields.sort((a, b) => {
    const typeAIndex = preferenceOrder.indexOf(a.category); // 获取 a 的类型优先级
    const typeBIndex = preferenceOrder.indexOf(b.category); // 获取 b 的类型优先级
    if (typeAIndex !== typeBIndex) return typeAIndex - typeBIndex; // 按类型优先级排序

    // 类型相同时，按数据源名称排序
    if (a.datasource_caption < b.datasource_caption) return -1;
    if (a.datasource_caption > b.datasource_caption) return 1;

    // 数据源名称也相同时，按字段名称排序
    if (a.field_name < b.field_name) return -1;
    if (a.field_name > b.field_name) return 1;

    return a.counter - b.counter; // 最后按原始顺序 (counter) 排序
  });

  // 5. 提取计算字段和参数，用于 Mermaid 图生成
  const calcsForMermaid = uniqueFields.filter(f => f.category === 'Calculated_Field' || f.category === 'Parameters');

  // 6. 提取依赖关系
  const relationships = [];
  
  // 遍历所有计算字段
  uniqueFields.forEach(field => {
    if (field.field_calculation) { // 只处理有计算公式的字段
      // 提取公式中的所有字段引用 [Field]
      const matches = field.field_calculation.match(/\[([^\]]+)\]/g);
      if (matches) {
        // 提取引用的字段名（去掉方括号）
        const dependencies = matches
          .map(m => m.slice(1, -1))
          .filter(dep => dep !== field.field_caption); // 过滤掉自引用

        // 为每个依赖添加关系
        dependencies.forEach(dep => {
          relationships.push({
            from: dep,
            to: field.field_caption,
          });
        });
      }
    }
  });

  // 7. 确保所有依赖关系中的字段都存在
  const allFieldNames = new Set(uniqueFields.map(f => f.field_caption));
  for (let rel of relationships) {
    if (!allFieldNames.has(rel.from)) {
      // 如果依赖关系中的来源字段不存在，则添加一个默认字段
      uniqueFields.push({
        counter: counter++,
        field_caption: rel.from,
        field_name: rel.from,
        field_id: `[${rel.from}]`,
        datasource: 'Unknown',
        datasource_caption: 'Unknown',
        category: 'Default_Field'
      });
      allFieldNames.add(rel.from); // 更新字段名集合
    }
  }

  // 返回处理后的字段列表、计算/参数列表和关系列表
  return { 
    fields: uniqueFields, 
    calcs: calcsForMermaid,
    relationships: relationships
  };
}

/**
 * 从计算字段中提取依赖关系
 * @param {Array} fields - 字段数组
 * @returns {Array} - 返回依赖关系数组 [{from: 'FieldA', to: 'FieldB'}, ...]
 */
function extractDependencies(fields) {
  const relationships = [];
  
  // 遍历所有计算字段
  fields.forEach(field => {
    if (field.field_calculation) { // 只处理有计算公式的字段
      // 提取公式中的所有字段引用 [Field]
      const matches = field.field_calculation.match(/\[([^\]]+)\]/g);
      if (matches) {
        // 提取引用的字段名（去掉方括号）
        const dependencies = matches
          .map(m => m.slice(1, -1))
          .filter(dep => dep !== field.field_caption); // 过滤掉自引用

        // 为每个依赖添加关系
        dependencies.forEach(dep => {
          relationships.push({
            from: dep,
            to: field.field_caption,
          });
        });
      }
    }
  });
  
  return relationships;
}

/**
 * 分析计算字段中的依赖关系
 * @param {Array} fields - 所有字段数组
 * @param {Array} calcs - 计算字段数组
 * @returns {Array} - 返回依赖关系数组 [{from: 'FieldA', to: 'FieldB'}, ...]
 */
function analyzeDependencies(fields, calcs) {
  const relationships = [];
  const fieldIdMap = new Map(); // 字段ID到字段对象的映射
  
  // 创建字段ID映射
  fields.forEach(field => {
    fieldIdMap.set(field.field_id, field);
  });
  
  // 遍历所有计算字段
  calcs.forEach(targetField => {
    // 如果没有原始计算公式，则跳过
    if (!targetField.field_calculation_bk) return;
    
    const originalFormula = targetField.field_calculation_bk; // 获取备份的原始公式
    
    // 遍历所有字段，检查是否是当前目标字段的依赖项
    fields.forEach(potentialSourceField => {
      // 如果是目标字段自身，则跳过
      if (potentialSourceField.field_id === targetField.field_id) return;
      
      // 提取来源字段ID的核心部分 (去除方括号)
      let coreIdentifier = potentialSourceField.field_id;
      if (coreIdentifier.startsWith('[') && coreIdentifier.endsWith(']')) {
        coreIdentifier = coreIdentifier.substring(1, coreIdentifier.length - 1);
      }
      
      // 转义核心标识符中的正则表达式特殊字符
      const escapedIdentifier = coreIdentifier.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      
      // 创建正则表达式，查找公式中形如 `[标识符]` 的部分，忽略大小写
      const regex = new RegExp(`\\[${escapedIdentifier}\\]`, 'gi');
      
      // 如果在原始公式中找到了匹配项
      if (regex.test(originalFormula)) {
        // 添加从来源到目标的依赖关系
        relationships.push({
          from: potentialSourceField.field_caption,
          to: targetField.field_caption,
        });
      }
    });
  });
  
  return relationships;
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractDataFromTwb,
    extractDependencies,
    analyzeDependencies
  };
}
