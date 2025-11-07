# 思源-分享插件

> 思源笔记的分享插件，支持将笔记分享为到公网进行访问。
> 该插件需要在思源笔记中安装。

# 思源插件与后端 API 速查手册

> 目的：集中整理“思源-分享插件”开发中会用到的 API 信息，涵盖后端 HTTP API 与前端插件 API（UI/事件/存储/网络）。本文仅为开发速查，不含实现代码。

最后更新：2025-11-07

---

## 0. 概述与认证

- 后端 HTTP API
  - 统一使用 POST（除文件上传等特殊情况）
  - 认证：`Authorization: Token <token>`（内核 Token），返回统一结构：`{ code, msg, data }`
  - 典型返回字段：`code === 0` 表示成功
- 前端插件 API
  - 来源于官方类型库（petal）与插件示例（plugin-sample）
  - 常见能力：UI 注入、命令/快捷键、事件、编辑器访问、存储、图标、窗口/面板等

---

## 1. 后端 HTTP API（按功能分类）

> 注：路径来自官方仓库 API 文档（英文/中文对照）。参数精简为开发常用字段。

### 1.1 笔记本 / 文档树（filetree）

| 端点 | 功能 | 关键参数 | 备注 |
|------|------|----------|------|
| /api/notebook/lsNotebooks | 列出笔记本 | - | 选择发布范围 |
| /api/notebook/openNotebook | 打开笔记本 | notebook | - |
| /api/notebook/closeNotebook | 关闭笔记本 | notebook | - |
| /api/filetree/createDocWithMd | 以 Markdown 创建文档 | notebook, path, markdown | - |
| /api/filetree/renameDoc | 按路径改名 | notebook, path, title | - |
| /api/filetree/renameDocByID | 按 ID 改名 | id, title | - |
| /api/filetree/removeDoc | 按路径删除 | notebook, path | - |
| /api/filetree/removeDocByID | 按 ID 删除 | id | - |
| /api/filetree/moveDocs | 移动文档（路径） | fromPaths[], toNotebook, toPath | - |
| /api/filetree/moveDocsByID | 移动文档（ID） | fromIDs[], toID | - |
| /api/filetree/getHPathByID | 取人类可读路径 | id | 生成 slug/相对链接 |
| /api/filetree/getIDsByHPath | 路径反查 ID 列表 | notebook, path | - |

### 1.2 块（block）与结构

| 端点 | 功能 | 关键参数 | 备注 |
|------|------|----------|------|
| /api/block/insertBlock | 插入块 | data, dataType, previousID/parentID | dataType: markdown/dom |
| /api/block/prependBlock | 前插块 | data, dataType, id | - |
| /api/block/appendBlock | 后插块 | data, dataType, id | - |
| /api/block/updateBlock | 更新块内容 | id, data, dataType | - |
| /api/block/deleteBlock | 删除块 | id | - |
| /api/block/moveBlock | 移动块 | id, previousID/parentID | - |
| /api/block/getChildBlocks | 获取子块列表 | id | 构建目录/TOC |
| /api/block/getBlockKramdown | 获取 Kramdown | id | 原始标记结构（含引用） |
| /api/block/transferBlockRef | 转移引用 | fromID, toID, refIDs[] | 反链维护 |

### 1.3 属性（attr）与查询

| 端点 | 功能 | 关键参数 | 备注 |
|------|------|----------|------|
| /api/attr/getBlockAttrs | 获取块属性 | id | 含 updated 时间戳 |
| /api/attr/setBlockAttrs | 设置块属性 | id, attrs | - |
| /api/query/sql | SQL 查询 | stmt | 增量：`SELECT id, updated FROM blocks ...` |

### 1.4 模板/渲染（template）

| 端点 | 功能 | 关键参数 | 备注 |
|------|------|----------|------|
| /api/template/render | 渲染模板 | id/path 或 template | 导出前处理可用 |
| /api/template/renderSprig | Sprig 模板渲染 | template, data | 可选 |

### 1.5 文件（file）与资源

| 端点 | 功能 | 关键参数 | 备注 |
|------|------|----------|------|
| /api/file/getFile | 读文件 | path | 获取 .sy/资源等 |
| /api/file/putFile | 写文件/目录 | multipart | 官方建议经由 API 而非直接 IO |
| /api/file/readDir | 列目录 | path | 资源枚举 |
| /api/file/removeFile | 删除文件 | path | - |
| /api/file/renameFile | 重命名文件 | path, newPath | - |

### 1.6 导出/转换（export/convert）

| 端点 | 功能 | 关键参数 | 备注 |
|------|------|----------|------|
| /api/export/exportMdContent | 导出文档 Markdown | id | 返回 hPath + content |
| /api/export/exportResources | 打包文件/目录 | paths[], name | 输出 zip 路径 |
| /api/convert/pandoc | 调用 Pandoc 转换 | dir, args | EPUB/Docx→MD 等（环境需具备） |

> 说明：是否存在直接导出 PDF/Word/Image 的统一端点“待验证”。当前通常以 Markdown/资源为基座，必要时借助 Pandoc/前端渲染生成。

### 1.7 通知/网络/系统

| 端点 | 功能 | 关键参数 | 备注 |
|------|------|----------|------|
| /api/notification/pushMsg | 推送 UI 提示 | msg, timeout | 过程反馈 |
| /api/notification/pushErrMsg | 推送错误提示 | msg, timeout | 错误反馈 |
| /api/network/forwardProxy | 转发外部请求 | url, method, headers, payload | 解决跨域与秘钥隐藏 |
| /api/system/version | 获取内核版本 | - | 版本兼容判断 |
| /api/system/currentTime | 当前时间 | - | 构建元数据 |

---

## 2. 前端插件 API（UI/命令/事件/编辑器/存储/常量）

> 类型与名称基于官方类型库（petal/types）与示例插件，个别细节以版本为准。

### 2.1 UI 注入与窗口/面板

- addTopBar / addStatusBar：添加顶栏或状态栏按钮
- addDock / addTab / addFloatLayer：添加停靠面板、页签或浮层（展示发布面板/进度）
- openWindow({doc}) / openTab({doc|custom})：打开文档或自定义视图
- Dialog：`new Dialog(options)` 创建对话框（确认/配置）

### 2.2 菜单与命令/快捷键

- Menu：`new Menu()` 构建菜单，`addItem({label, icon, click, ...})` 注入项
- addCommand({ name, langId, hotkey, callback })：注册命令与快捷键
- 典型用法：向文档树/编辑器右键菜单注入“分享此文档/此块”

### 2.3 编辑器访问（Protyle）

- getAllEditor()：获取当前打开的编辑器实例列表（Protyle）
- Protyle 相关：`insert()`、`transaction()`、`focus()` 等（更多以示例为准）
- 用途：定位当前文档/块 ID，提供上下文信息（导出主流程多走 HTTP API）

### 2.4 存储与配置

- 插件私有：`plugin.saveData(key, value)`、`loadData(key)`、`removeData(key)`
  - 用于保存用户配置、发布策略、第三方凭证（尽量避免保存内核 Token）
- 全局 LocalStorage：使用官方常量键（如 `LOCAL_*`）仅在需要复用时使用，避免冲突

### 2.5 图标与资源

- addIcons(svgSymbols)：注入自定义 SVG Symbol，便于按钮/菜单复用

### 2.6 环境与事件总线

- getFrontend() / getBackend()：判断运行端（桌面/移动/网页等）
- eventBus.on(name, callback) / off(name, callback)：监听/取消事件（名称见下）

### 2.7 常用常量（节选）

- 导出/对话框/键位/主题等常量，来源于 `constants.ts`
- 代码高亮主题：`SIYUAN_CONFIG_APPEARANCE_DARK_CODE` / `...LIGHT_CODE`（数组）
- 本地布局与 Dock：`LOCAL_LAYOUTS` / `LOCAL_PLUGIN_DOCKS`
- 导出相关本地缓存键：`LOCAL_EXPORTPDF` / `LOCAL_EXPORTWORD` / `LOCAL_EXPORTIMG`（可用性需版本验证）

---

## 3. 前端事件（示例与用途）

> 事件未完整文档化，以下来源于类型与示例代码，具体以版本为准。

| 事件名（示例） | 用途 |
|----------------|------|
| ws-main | WebSocket 主通道消息（全局） |
| click-blockicon | 点击块图标（可扩展“分享此块”） |
| loaded-protyle-static / loaded-protyle-dynamic | 编辑器加载完成（初始化） |
| switch-protyle | 切换编辑上下文（更新当前文档 ID） |
| open-menu-doctree | 构建文档树菜单（可注入分享项） |
| open-menu-blockref / open-menu-tag / open-menu-link | 相关菜单构建点 |
| paste | 粘贴事件（敏感检测） |
| opened-notebook / closed-notebook | 笔记本开关（刷新范围） |
| DIALOG_*（如 DIALOG_COMMANDPANEL） | 对话框类型标识（联动逻辑） |

---

## 4. 网络与跨域

- 直接 fetch：在桌面/浏览器环境可用；谨慎处理第三方凭证（不要硬编码）
- forwardProxy（/api/network/forwardProxy）：由内核代理外部请求，便于隐藏源头与处理 CORS
- CORS：本地 127.0.0.1 通常无严格限制；上线部署按平台策略配置

---

## 5. 存储策略

- 首选插件私有存储：隔离命名空间，避免与其他插件冲突
- 敏感信息：不保存内核 Token；外部平台凭证可在本机加密保存或按需输入
- 临时缓存：使用内存/会话级变量存放一次性状态，降低泄露面

---

## 6. 导出与增量（与 API 的结合点）

- 用 `/api/export/exportMdContent` 导出 Markdown（含 hPath）作为内容基座
- 用 `/api/file/getFile` / `/api/file/readDir` / `/api/export/exportResources` 复制图片/附件等静态资源
- 用 `/api/attr/getBlockAttrs` 的 `updated` 或 `/api/query/sql` 查询 `blocks.updated` 做增量判定
- 生成 `manifest.json`（记录每文档 id、updated、hash、路径）用于差异上传与缓存命中

---

## 7. 参考文档链接

- 插件示例（中文）：https://raw.githubusercontent.com/siyuan-note/plugin-sample/main/README_zh_CN.md
- 插件示例（英文）：https://raw.githubusercontent.com/siyuan-note/plugin-sample/master/README.md
- plugin.json 示例：https://raw.githubusercontent.com/siyuan-note/plugin-sample/master/plugin.json
- 后端 HTTP API（中文）：https://raw.githubusercontent.com/siyuan-note/siyuan/master/API_zh_CN.md
- 后端 HTTP API（英文）：https://raw.githubusercontent.com/siyuan-note/siyuan/master/API.md
- 前端类型（入口）：https://raw.githubusercontent.com/siyuan-note/petal/master/README.md
- 常量/事件类型（节选）：
  - constants.ts：https://raw.githubusercontent.com/siyuan-note/petal/master/types/constants.ts
  - events.d.ts：https://raw.githubusercontent.com/siyuan-note/petal/master/types/events.d.ts
  - index.d.ts：https://raw.githubusercontent.com/siyuan-note/petal/master/types/index.d.ts

---

## 8. 待验证清单（与 API 相关）

1. 是否存在官方直接导出 PDF/Word/Image 的稳定端点（目前建议走 Markdown + 外部转换/前端渲染）
2. 事件总线完整列表与版本稳定性（命名可能在版本间有差异）
3. `constants.ts` 中导出/对话框等常量的可触发性与兼容性
4. 主题 CSS 官方推荐获取方式（是否统一通过导出资源打包）
5. OceanPress 与导出链路是否完全基于后端 API（不直接读数据目录）
6. plugin.json 中 i18n/字段的最新要求与规范（随模板升级而更新）

---

## 9. 使用建议（与“分享插件”实现相关）

- 优先使用后端 API 拉取内容与资源，避免直接读取数据目录
- 发布前二次确认：清单展示 + 敏感词/属性过滤（避免误发布）
- 不在前端脚本中保存内核 Token；第三方平台发布使用用户提供的 PAT/AK/SK
- 增量构建：配合 `updated`/hash 与 `manifest.json`，显著缩短重复发布时间
- CDN/缓存：静态资源生成 hash 文件名；入口 `index.html` 短缓存 + 版本 query 强制更新
