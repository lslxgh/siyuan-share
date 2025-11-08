# Kramdown 解析器实现说明

## 概述

本次更新将文档导出方式从 `/api/export/exportMdContent` 改为 `/api/block/getBlockKramdown`，通过前端 JavaScript 解析器将 Kramdown 源码转换为 Markdown 后传递给后端。

## 主要变更

### 1. 新增文件

#### `src/utils/kramdown-parser.ts`
Kramdown → Markdown 转换器核心模块

**主要功能：**
- `parseKramdownToMarkdown(kramdown, options?)`: 主解析函数
- `cleanIALAttributes()`: 清理 IAL 属性块 `{: id="..." ...}`
- `convertBlockReferences()`: 转换块引用 `((id))` → `[引用]` 或 `((id "文本"))` → `[文本]`
- `cleanEmbedQueries()`: 移除嵌入查询 `{{SELECT ...}}`
- `cleanBasicSyntax()`: 清理 YAML front matter 和元数据行
- `resolveBlockRef()`: 预留接口，用于未来查询块内容并展开引用

**设计特点：**
- 模块化：每个转换步骤独立函数
- 可扩展：通过 `ParserOptions` 预留配置接口
- 防御性：处理空输入、异常格式

#### `src/utils/kramdown-parser.test.ts`
测试用例文件（可选，用于开发调试）

包含 8 个测试用例，覆盖：
- IAL 属性清理
- 块引用转换（带/不带显示文本）
- 嵌入查询移除
- YAML front matter 清理
- 复杂嵌套结构
- 边界情况（空输入、仅属性）

### 2. 修改文件

#### `src/services/share-service.ts`
- **API 端点变更**: `/api/export/exportMdContent` → `/api/block/getBlockKramdown`
- **请求参数**: 添加 `mode: "md"` 参数（标准 Markdown 模式，链接 URL 不编码空格）
- **响应解析**: 从 `data.content` 改为 `data.kramdown`
- **集成解析器**: 调用 `parseKramdownToMarkdown()` 转换内容
- **错误处理**: 
  - 区分 API 调用失败、响应错误、解析失败
  - 使用 `showMessage()` 向用户显示友好提示
  - 使用 `console.error()` 记录详细错误日志（包含 docId、错误堆栈、内容预览）
- **移除代码**: 删除 `cleanMarkdownContent()` 方法（功能迁移至解析器）

#### `src/types.ts`
- 新增 `KramdownResponse` 接口（对应 API 返回格式）
- 预留 `ParserOptions` 接口（通过 kramdown-parser.ts 导出）

#### `src/i18n/zh_CN.json` & `src/i18n/en_US.json`
添加错误提示文案：
- `kramdownApiFailed`: API 调用失败
- `kramdownParseError`: 解析失败
- `kramdownTimeout`: 导出超时

## 技术要点

### Kramdown 格式特点

1. **IAL (Inline Attribute List)**
   
   IAL 有两种形式：
   
   **独立行 IAL**（块级属性）：
   ```kramdown
   段落内容
   {: id="20210101-abc1234" custom-attr="value"}
   ```
   
   **行内 IAL**（元素内属性）：
   ```kramdown
   * {: id="20201225220955-2nn1mns"}列表项内容
   1. {: id="20251106140708-noc3gik" updated="20251106140708" fold="1"}有序列表
   `行内代码`{: id="xxx"}
   段落文本{: style="color:red"}继续
   ```
   
   两种形式都会被解析器清理掉。
   
2. **块引用**
   ```kramdown
   ((20210101-abc1234))               → [引用]
   ((20210101-abc1234 "显示文本"))    → [显示文本]
   ```

3. **嵌入查询**
   ```kramdown
   {{SELECT * FROM blocks WHERE ...}}  → 移除
   ```

### API 对比

| 特性 | exportMdContent | getBlockKramdown |
|------|-----------------|------------------|
| 返回格式 | 标准 Markdown | Kramdown / Markdown (mode 参数) |
| 块属性 | 不包含 | 完整保留 (IAL) |
| 块引用 | 已转换为文本 | 保留原始语法 |
| 资源链接 | assets/ 路径 | assets/ 路径 |
| 适用场景 | 跨平台分享 | 保留思源特性 |

### 错误处理策略

```typescript
try {
    // 1. API 调用
    const response = await fetch("/api/block/getBlockKramdown", {...});
    
    // 2. HTTP 状态检查
    if (!response.ok) {
        showMessage(i18n.kramdownApiFailed, 4000, "error");
        return null;
    }
    
    // 3. 业务状态检查
    const result: KramdownResponse = await response.json();
    if (result.code !== 0) {
        console.error("API 返回错误:", result.msg, { docId, code: result.code });
        showMessage(i18n.kramdownApiFailed, 4000, "error");
        return null;
    }
    
    // 4. 解析处理
    const markdown = parseKramdownToMarkdown(result.data.kramdown);
    if (!markdown) {
        console.error("解析结果为空", { docId, kramdownLength });
        showMessage(i18n.kramdownParseError, 4000, "error");
        return null;
    }
    
    return markdown;
} catch (parseError) {
    // 5. 解析异常
    console.error("解析失败:", parseError, { docId, kramdownPreview });
    showMessage(i18n.kramdownParseError, 4000, "error");
    return null;
} catch (error) {
    // 6. 网络异常/超时
    if (error.name === 'AbortError') {
        showMessage(i18n.kramdownTimeout, 4000, "error");
    }
    return null;
}
```

## 后续扩展方向

### 1. 块引用展开（短期）
```typescript
// 在 kramdown-parser.ts 中实现
async function resolveBlockRef(blockId: string): Promise<string | null> {
    const response = await fetch("/api/block/getBlockKramdown", {
        method: "POST",
        body: JSON.stringify({ id: blockId }),
        // ...
    });
    // 返回块内容文本
}

// 在 convertBlockReferences 中调用
if (options?.expandRefs) {
    const refContent = await resolveBlockRef(blockId);
    return refContent || `[引用:${blockId}]`;
}
```

### 2. 嵌入查询执行（中期）
```typescript
function cleanEmbedQueries(content: string, options?: ParserOptions): string {
    if (options?.expandEmbedQueries) {
        return content.replace(embedPattern, async (match) => {
            const sql = extractSQL(match);
            const result = await executeSiyuanSQL(sql);
            return formatQueryResult(result);
        });
    }
    return content.replace(embedPattern, ''); // 当前：直接移除
}
```

### 3. 资源处理（长期）
- 检测 `assets/` 路径
- 复制图片/附件到分享服务
- 替换为 CDN 链接或 Base64 内联

### 4. 性能优化
- 测试大文档（>10000 字）解析耗时
- 如果 >200ms，考虑 Web Worker 异步解析
- 增加解析进度提示

### 5. 增量更新支持
- 记录文档的 `updated` 时间戳
- 对比本地缓存决定是否重新导出
- 生成 manifest.json 用于差异上传

## 测试建议

### 本地测试
```typescript
// 在浏览器控制台运行
window.testKramdownParser(); // 运行基础测试

// 测试实际文档
const service = plugin.shareService;
const content = await service.exportDocContent("20210101-abc1234");
console.log(content);
```

### 性能测试
```typescript
// 测试不同规模文档
const testDocs = [
    { size: "小 (<1000字)", id: "..." },
    { size: "中 (1000-5000字)", id: "..." },
    { size: "大 (5000-10000字)", id: "..." },
];

for (const doc of testDocs) {
    const start = performance.now();
    await service.exportDocContent(doc.id);
    const duration = performance.now() - start;
    console.log(`${doc.size}: ${duration.toFixed(2)}ms`);
}
```

### 集成测试
1. 分享包含块引用的文档
2. 分享包含嵌入查询的文档
3. 分享包含图片/附件的文档
4. 测试错误场景（无效 docId、网络断开、Token 过期）

## 兼容性说明

### 后端 API
- 继续接收 `content` 字段（Markdown 格式）
- 无需修改数据库模型
- 无需修改前端 Web 应用渲染逻辑

### 思源版本
- 依赖 `/api/block/getBlockKramdown` 端点
- 建议思源版本 >= 2.8.0（需验证 API 可用性）

### 浏览器
- TypeScript 编译目标需支持 ES2015+
- 使用标准 fetch API（需 Polyfill 支持旧浏览器）

## 回退方案

如果 Kramdown 方案出现问题，可快速回退：

```typescript
// 1. 恢复 API 端点
const response = await fetch("/api/export/exportMdContent", {...});

// 2. 恢复响应解析
const result = await response.json();
const content = result.data.content;

// 3. 恢复清理逻辑
const cleaned = this.cleanMarkdownContent(content);
```

Git 操作：
```bash
# 查看改动
git diff src/services/share-service.ts

# 回退特定文件
git checkout HEAD -- src/services/share-service.ts
```

## 参考文档

- [思源 API 文档](../../siyuan/API_zh_CN.md) - `/api/block/getBlockKramdown` 端点说明
- [AGENTS.md](../../AGENTS.md) - 插件开发 API 速查手册
- [Kramdown 规范](https://kramdown.gettalong.org/) - IAL 语法参考

---

**更新日期**: 2025-11-08  
**版本**: v1.0.0  
**状态**: ✅ 基础实现完成，待测试验证
