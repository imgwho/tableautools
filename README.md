# Tableau 字段关系分析工具

一个简单而强大的工具，用于可视化和分析 Tableau 工作簿中的字段依赖关系。

## 功能特点

- 📊 自动提取 TWBX 文件中的字段关系
- 🎯 可视化字段依赖关系
- 📥 多种导出格式支持
- 🌐 纯前端实现，无需后端服务

### 主要功能

1. **字段关系提取**
   - 支持 TWBX 文件解析
   - 自动识别计算字段
   - 分析字段间依赖关系

2. **可视化展示**
   - 使用 Mermaid.js 生成关系图
   - 直观展示字段依赖
   - 支持大规模数据可视化

3. **多格式导出**
   - SVG 格式导出
   - PNG 格式导出
   - Excel 表格导出
   - PDF 报告导出

## 使用方法

1. 访问工具网站：[tbexport.imgwho.cc](https://tbexport.imgwho.cc)
2. 点击"选择 TWBX 文件"上传您的 Tableau 工作簿
3. 等待分析完成后自动显示字段关系图
4. 使用工具栏按钮导出需要的格式

## 本地部署

打开即用。

## 技术栈
Mermaid.js - 关系图渲染  
TailwindCSS - 页面样式  
JSZip - TWBX 文件解析  
SheetJS - Excel 导出  
jsPDF - PDF 导出  
浏览器兼容性

Chrome (推荐)  
Firefox
Edge
Safari

