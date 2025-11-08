# 块引用处理实现文档

## 概述

实现了思源笔记分享插件的块引用处理功能,能够在分享文档时自动识别、解析并处理文档中的块引用,将引用转换为可点击的锚点链接。

## 功能特性

1. **自动识别块引用**: 识别 `((blockId))` 和 `((blockId "显示文本"))` 格式
2. **递归解析**: 自动解析被引用块中的嵌套引用
3. **依赖排序**: 按引用次数排序,优先发送被多次引用的块
4. **循环检测**: 防止循环引用导致的无限递归
5. **锚点链接**: 在分享页面中将引用替换为 `[文本](#block-id)` 格式的链接

## 实现架构

### 前端 (TypeScript)

#### 1. 类型定义 (`src/types.ts`)

```typescript
// 引用块信息
export interface BlockReference {
    blockId: string;
    content: string;
    displayText?: string;
    refCount?: number;
}

// 文档内容及其引用块
export interface DocContentWithRefs {
    content: string;
    references: BlockReference[];
}
```

#### 2. 引用提取器 (`src/utils/kramdown-parser.ts`)

```typescript
/**
 * 提取文档中的所有块引用 ID
 */
export function extractBlockReferences(content: string): Array<{
    blockId: string;
    displayText?: string;
}>;
```

**功能**:
- 使用正则表达式匹配块引用: `/\(\(([0-9]{14,}-[0-9a-z]{7,})(?:\s+["']([^"']+)["'])?\)\)/g`
- 支持两种格式:
  - `((20251108094416-arwps1t))` - 无显示文本
  - `((20251108094416-arwps1t 'hello'))` - 带显示文本
- 自动去重

#### 3. 块引用解析器 (`src/utils/block-reference-resolver.ts`)

```typescript
export class BlockReferenceResolver {
    constructor(options: { siyuanToken: string; maxDepth?: number });
    
    /**
     * 解析文档内容及其所有引用
     */
    async resolveDocumentReferences(docContent: string): Promise<BlockReference[]>;
}
```

**核心流程**:
1. 提取文档中的直接引用
2. 对每个引用递归获取块内容
3. 检测并处理嵌套引用
4. 检测循环引用(使用 `resolving` Set)
5. 限制递归深度(默认5层)
6. 按引用次数排序返回

**API调用**:
- `/api/block/getBlockKramdown` - 获取块的 Kramdown 内容
- 使用思源内核 Token 认证

#### 4. 分享服务 (`src/services/share-service.ts`)

```typescript
private async exportDocContentWithRefs(docId: string): Promise<{
    content: string;
    references: BlockReference[];
}>;
```

**主要步骤**:
1. 获取文档 Kramdown 内容
2. 使用 `BlockReferenceResolver` 解析所有引用
3. 将 Kramdown 转换为 Markdown
4. 返回文档内容和引用块列表

**调用示例**:
```typescript
const { content, references } = await this.exportDocContentWithRefs(docId);

// 构造请求
const payload = {
    docId,
    docTitle,
    content,
    references, // 包含引用块信息
    // ... 其他字段
};
```

### 后端 (Go)

#### 1. 数据模型 (`models/share.go`)

```go
// Share 分享记录模型
type Share struct {
    // ... 其他字段
    Content    string `gorm:"type:text" json:"content"`
    References string `gorm:"type:text" json:"references"` // JSON 字符串
}

// BlockReference 引用块信息
type BlockReference struct {
    BlockID     string `json:"blockId"`
    Content     string `json:"content"`
    DisplayText string `json:"displayText,omitempty"`
    RefCount    int    `json:"refCount,omitempty"`
}
```

#### 2. 创建分享接口 (`controllers/share.go`)

```go
type CreateShareRequest struct {
    // ... 其他字段
    References []BlockReferenceReq `json:"references"`
}

type BlockReferenceReq struct {
    BlockID     string `json:"blockId"`
    Content     string `json:"content"`
    DisplayText string `json:"displayText,omitempty"`
    RefCount    int    `json:"refCount,omitempty"`
}
```

**处理逻辑**:
```go
// 序列化引用块为 JSON
if len(req.References) > 0 {
    refsJSON, err := json.Marshal(req.References)
    if err != nil {
        return err
    }
    share.References = string(refsJSON)
}
```

#### 3. 查看分享接口 (`controllers/view.go`)

```go
// replaceBlockReferences 替换内容中的块引用为实际链接
func replaceBlockReferences(content string, refs []models.BlockReference, shareID string) string
```

**替换逻辑**:
1. 构建 blockId → BlockReference 映射
2. 使用正则匹配块引用
3. 对每个引用:
   - 查找对应的块信息
   - 生成显示文本(优先级: 引用中的 displayText > 块的 displayText > 块内容前30字符)
   - 替换为锚点链接: `[显示文本](#block-blockId)`

**正则表达式**:
```go
blockRefPattern := regexp.MustCompile(`\(\(([0-9]{14,}-[0-9a-z]{7,})(?:\s+["']([^"']+)["'])?\)\)`)
```

**链接格式**:
- 锚点格式: `#block-{blockId}`
- Markdown 链接: `[显示文本](#block-{blockId})`

### 前端展示 (React)

文档内容通过 `react-markdown` 渲染,自动处理:
- 锚点链接点击跳转
- rehype-slug 插件生成 heading id
- 目录(TOC)功能配合锚点导航

## 使用示例

### 原始文档内容

```markdown
# 标题

> 描述内容

　　

　　((20251108094416-arwps1t 'hello'))

这是一段包含引用的文本。
```

### 处理流程

1. **前端提取引用**:
   ```json
   [
     {
       "blockId": "20251108094416-arwps1t",
       "displayText": "hello"
     }
   ]
   ```

2. **获取引用块内容**:
   - 调用 `/api/block/getBlockKramdown`
   - 递归处理嵌套引用
   
3. **发送到后端**:
   ```json
   {
     "docId": "...",
     "content": "# 标题\n\n> 描述内容\n\n((20251108094416-arwps1t 'hello'))\n\n这是一段包含引用的文本。",
     "references": [
       {
         "blockId": "20251108094416-arwps1t",
         "content": "这是被引用块的内容",
         "displayText": "hello",
         "refCount": 1
       }
     ]
   }
   ```

4. **后端替换引用**:
   ```markdown
   # 标题
   
   > 描述内容
   
   [hello](#block-20251108094416-arwps1t)
   
   这是一段包含引用的文本。
   ```

5. **前端渲染**:
   - 显示为可点击的链接
   - 点击跳转到 `#block-20251108094416-arwps1t` 锚点

## 配置选项

### 递归深度限制

```typescript
const resolver = new BlockReferenceResolver({
    siyuanToken: config.siyuanToken,
    maxDepth: 5, // 默认5层,防止过深递归
});
```

### 超时控制

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000); // 10秒超时
```

## 错误处理

### 循环引用检测

```typescript
if (this.resolving.has(blockId)) {
    console.warn("检测到循环引用,跳过:", blockId);
    return null;
}
```

### 引用块不存在

```go
if !exists {
    // 保留显示文本或使用默认文本
    if displayText != "" {
        return displayText
    }
    return "[引用]"
}
```

## 性能优化

1. **并行解析**: 使用 `Promise.all` 并行获取多个引用块
2. **缓存机制**: 已解析的块存入 `resolvedBlocks` Map
3. **去重处理**: 同一块只获取一次,记录引用次数
4. **依赖排序**: 按 refCount 降序,被引用多的块优先发送

## 调试信息

```typescript
console.debug("解析完成:", {
    直接引用数: directRefs.length,
    总引用数: allRefs.length,
    引用块列表: allRefs.map(r => ({ id: r.blockId, refCount: r.refCount }))
});
```

## 数据库迁移

需要为 `shares` 表添加 `references` 字段:

```sql
ALTER TABLE shares ADD COLUMN references TEXT;
```

或在下次启动时由 GORM 自动迁移。

## 测试要点

1. **基础引用**: `((blockId))`
2. **带文本引用**: `((blockId "文本"))`
3. **嵌套引用**: 引用块中包含其他引用
4. **循环引用**: A→B→A
5. **深层引用**: 超过 maxDepth 限制
6. **引用不存在**: 块ID无效或已删除
7. **特殊字符**: 引用文本包含引号、括号等

## 后续优化

1. **引用块独立展示区**: 在页面底部添加"引用内容"区域
2. **双向链接**: 显示哪些块引用了当前块
3. **引用预览**: 鼠标悬停显示引用块内容
4. **图片引用**: 处理引用块中的图片资源
5. **增量更新**: 只更新变化的引用块

## 参考资料

- [思源 API 文档](../../siyuan/API_zh_CN.md)
- [AGENTS.md](../AGENTS.md) - 后端 API 速查
- [Kramdown 解析器](../src/utils/kramdown-parser.ts)

---

**实现日期**: 2025-11-08  
**版本**: v1.0.0  
**状态**: ✅ 已完成
