# Tableau Tools 工具集

一套强大的 Tableau 分析工具，提供工作簿分析、文档生成和流程可视化功能。


## 📦 工具概览

本工具集包含三个独立但互补的工具，帮助您更好地理解和管理 Tableau 资源:

### 1. 📊 Workbook Analysis (工作簿分析)
**可视化依赖关系并分析 Tableau 工作簿中的字段**

- **字段解析**: 自动提取并展示所有字段信息(名称、类型、角色、来源、公式)
- **依赖关系图**: 使用 Cytoscape.js 可视化字段间的依赖关系
- **多种布局**: 支持 Dagre(树状)、Cose(力导向)、Circle、Grid、Breadthfirst 等布局
- **搜索功能**: 在字段表格和依赖图中快速搜索
- **导出功能**: 
  - 导出字段列表为 Excel
  - 导出依赖关系图为 PNG 图片
- **支持格式**: `.twb`, `.twbx`

### 2. 📝 Dashboard Documentation Generator (仪表板文档生成器)
**自动为 Tableau 仪表板生成全面的文档**

- **智能文档生成**: 自动提取工作簿结构并生成 Markdown 格式文档
- **完整信息提取**:
  - 工作簿基本信息(版本、平台、语言环境)
  - 数据源详情(连接类型、表关系、JOIN 操作)
  - 仪表板参数和交互功能
  - 可视化组件详情
  - 计算字段和公式
  - 关键维度和度量
- **布局可视化**: 生成 ASCII 布局图展示仪表板结构
- **Markdown 预览**: 实时预览生成的文档
- **一键下载**: 导出为 `.md` 文件
- **支持格式**: `.twb`, `.twbx`

### 3. 🔄 Flow Analysis Dashboard (流程分析仪表板)
**可视化并分析 Tableau Prep 流程**

- **流程解析**: 自动解析 `.tfl` 和 `.tflx` 文件
- **Mermaid 流程图**: 使用 Mermaid.js 生成清晰的流程可视化
  - 📥 数据源(输入)节点
  - 🔗 数据连接(Join)节点
  - ⚙️ 转换步骤节点
  - 📤 数据输出节点
- **流程摘要**: 提取并展示关键信息
  - 数据源列表和字段数量
  - JOIN 类型和条件
  - 输出目标和项目信息
- **JSON 查看**: 查看原始 JSON 数据结构
- **语法高亮**: 使用 Prism.js 高亮显示 JSON
- **导出功能**: 下载解析后的 JSON 文件
- **支持格式**: `.tfl`, `.tflx`

## 🚀 快速开始

### 在线使用

1. 访问网站
2. 选择您需要的工具(通过顶部导航栏切换)
3. 上传对应的文件(.twb/.twbx 或 .tfl/.tflx)
4. 查看分析结果并导出所需格式

### 本地部署

本项目为纯前端应用,无需后端服务:

```bash
# 克隆仓库
git clone https://github.com/yourusername/tableautools.git

# 进入目录
cd tableautools

# 使用任意 HTTP 服务器运行
# 方式1: 使用 Python
python -m http.server 8000

# 方式2: 使用 Node.js
npx serve

# 方式3: 直接用浏览器打开 index.html
```

访问 `http://localhost:8000` 即可使用。

## 🛠️ 技术栈

### 核心技术
- **纯前端**: HTML5 + CSS3 + JavaScript (ES6+)
- **样式框架**: TailwindCSS (CDN)
- **UI 设计**: 黄色系高级设计,玻璃拟态效果

### 主要库
- **JSZip** - 解析 .twbx 和 .tflx 压缩文件
- **SheetJS (XLSX)** - Excel 导出功能
- **html2canvas** - 图表截图导出
- **Cytoscape.js** - 依赖关系图可视化
  - cytoscape-dagre - 树状布局
  - cytoscape-cose-bilkent - 力导向布局
- **Mermaid.js** - 流程图渲染
- **Prism.js** - 代码语法高亮

### 图标
- **Material Symbols** - Google Material Design 图标

## 📁 项目结构

```
tableautools/
├── index.html              # 工作簿分析工具
├── Twb_Docs.html          # 文档生成工具
├── Tfl_Analysis.html      # 流程分析工具
├── css/
│   └── style.css          # 全局样式(玻璃拟态、动画等)
├── js/
│   ├── analyzer.js        # 工作簿分析逻辑
│   ├── docs.js            # 文档生成逻辑
│   ├── tfl_analyzer.js    # 流程分析逻辑
│   └── shared/
│       ├── theme.js       # Tailwind 配置和主题
│       └── ui.js          # 共享 UI 组件(Header、Footer、Toast)
└── icon.svg               # 网站图标
```

## 🎨 设计特点

- **黄色系配色**: 使用 Amber/Yellow 作为主色调,营造专业高级感
- **玻璃拟态**: 卡片和组件采用 Glassmorphism 设计
- **微交互**: 丰富的 hover 效果和过渡动画
- **响应式设计**: 完美适配桌面和移动设备
- **无障碍**: 语义化 HTML 和良好的对比度

## 🌐 浏览器兼容性

- ✅ Chrome (推荐)
- ✅ Edge
- ✅ Firefox
- ✅ Safari

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📧 联系方式

- GitHub: [@imgwho](https://github.com/imgwho)
- LinkedIn: [imgwho](https://linkedin.com/in/imgwho)

---

**Made with ❤️ for the Tableau Community**
