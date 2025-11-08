# 块引用链接实现说明

## 实现方式

点击引用时,打开**新的独立URL页面**展示引用块内容,而不是在同一页面内锚点跳转。

## 数据流程

### 1. 原始文档

```markdown
# title

> 描述内容

((20251108094416-arwps1t 'hello'))
```

### 2. 前端处理

插件提取引用并获取内容:
```typescript
references: [
  {
    blockId: "20251108094416-arwps1t",
    content: "world",
    displayText: "hello",
    refCount: 1
  }
]
```

### 3. 后端创建分享

#### 主文档分享
```
ID: a93a17caa294becc865bcdc054706fb2
DocID: 20251107091012-5z3fb33
Content: "# title\n\n> 描述内容\n\n((20251108094416-arwps1t 'hello'))"
References: '[{"blockId":"20251108094416-arwps1t","content":"world","refCount":1}]'
```

#### 为每个引用块创建子分享
```
ID: b1234567890abcdef (自动生成)
DocID: 20251108094416-arwps1t (使用 blockId)
DocTitle: "引用块: 20251108094416-arwps1t"
Content: "world"
ParentShareID: a93a17caa294becc865bcdc054706fb2
ExpireAt: (继承主分享)
RequirePassword: (继承主分享)
PasswordHash: (继承主分享)
```

### 4. 查看时替换引用

用户访问主文档 `GET /api/s/a93a17caa294becc865bcdc054706fb2` 时:

1. 查找引用块对应的分享记录:
   ```sql
   SELECT * FROM shares 
   WHERE user_id = 'xxx' 
     AND doc_id = '20251108094416-arwps1t' 
   ORDER BY created_at DESC 
   LIMIT 1
   ```

2. 替换引用语法为分享链接:
   ```markdown
   原始: ((20251108094416-arwps1t 'hello'))
   替换为: [hello](http://localhost:8080/s/b1234567890abcdef)
   ```

3. 返回处理后的内容:
   ```markdown
   # title
   
   > 描述内容
   
   [hello](http://localhost:8080/s/b1234567890abcdef)
   ```

### 5. 用户交互

- 用户访问: `http://localhost:8080/s/a93a17caa294becc865bcdc054706fb2`
- 看到文档内容,其中 "hello" 是一个链接
- 点击 "hello" 链接
- **打开新页面**: `http://localhost:8080/s/b1234567890abcdef`
- 显示引用块内容: "world"

## 数据库结构

### shares 表新增字段

```sql
ALTER TABLE shares ADD COLUMN parent_share_id VARCHAR(64);
CREATE INDEX idx_parent_share_id ON shares(parent_share_id);
```

- `parent_share_id`: 父分享ID,标识这是一个引用块的分享
- 主文档分享: `parent_share_id = ""`
- 引用块分享: `parent_share_id = "主文档的shareId"`

## 核心代码

### 创建引用块分享 (share.go)

```go
// 为引用块创建子分享
if len(req.References) > 0 {
    for _, ref := range req.References {
        // 检查是否已存在该块的分享
        existingBlockShare, _ := models.FindActiveShareByDoc(userIDStr, ref.BlockID)
        
        var blockShare *models.Share
        if existingBlockShare != nil && !existingBlockShare.IsExpired() {
            // 更新已有的块分享
            blockShare = existingBlockShare
            blockShare.Content = ref.Content
            blockShare.ExpireAt = share.ExpireAt
            blockShare.ParentShareID = share.ID
            models.DB.Save(blockShare)
        } else {
            // 创建新的块分享
            blockShare = &models.Share{
                ID:              generateShareID(),
                UserID:          userIDStr,
                DocID:           ref.BlockID,
                DocTitle:        "引用块: " + ref.BlockID,
                Content:         ref.Content,
                ParentShareID:   share.ID,
                RequirePassword: share.RequirePassword,
                PasswordHash:    share.PasswordHash,
                ExpireAt:        share.ExpireAt,
                IsPublic:        share.IsPublic,
            }
            models.DB.Create(blockShare)
        }
    }
}
```

### 替换引用为URL (view.go)

```go
func replaceBlockReferences(content string, refs []models.BlockReference, baseURL string, userID string) string {
    blockRefPattern := regexp.MustCompile(`\(\(([0-9]{14,}-[0-9a-z]{7,})(?:\s+["']([^"']+)["'])?\)\)`)
    
    return blockRefPattern.ReplaceAllStringFunc(content, func(match string) string {
        blockID := matches[1]
        displayText := matches[2]
        
        // 查找该块的分享记录
        var blockShare models.Share
        err := models.DB.Where("user_id = ? AND doc_id = ?", userID, blockID).
            Order("created_at DESC").
            First(&blockShare).Error
        
        if err != nil {
            return displayText // 降级处理
        }
        
        // 生成指向块分享的 URL
        blockShareURL := baseURL + "/s/" + blockShare.ID
        
        return "[" + displayText + "](" + blockShareURL + ")"
    })
}
```

## 优势

1. **独立访问**: 每个引用块有自己的分享链接,可单独访问
2. **权限继承**: 引用块继承主文档的密码和过期时间
3. **链接稳定**: 块分享链接不会因主文档更新而失效
4. **SEO友好**: 每个引用块是独立页面,可被搜索引擎索引
5. **便于分享**: 可以直接分享引用块的链接

## 示例

### 数据库实际数据

主文档分享:
```
id: a93a17caa294becc865bcdc054706fb2
user_id: user_1c46b8be3dc2c4a147f9b20e0c5a65a0
doc_id: 20251107091012-5z3fb33
doc_title: GPT 导出文档
content: # title\n\n> 描述内容\n\n((20251108094416-arwps1t 'hello'))
references: [{"blockId":"20251108094416-arwps1t","content":"world","refCount":1}]
parent_share_id: (空)
expire_at: 2025-11-15 13:16:31
```

引用块分享:
```
id: b1234567890abcdef
user_id: user_1c46b8be3dc2c4a147f9b20e0c5a65a0
doc_id: 20251108094416-arwps1t
doc_title: 引用块: 20251108094416-arwps1t
content: world
references: (空)
parent_share_id: a93a17caa294becc865bcdc054706fb2
expire_at: 2025-11-15 13:16:31
```

### URL访问流程

1. 访问主文档: `http://localhost:8080/s/a93a17caa294becc865bcdc054706fb2`
2. 看到内容:
   ```
   title
   
   描述内容
   
   hello ← 这是一个链接
   ```
3. 点击 "hello" 链接
4. 浏览器跳转到: `http://localhost:8080/s/b1234567890abcdef`
5. 看到引用块内容:
   ```
   引用块: 20251108094416-arwps1t
   
   world
   ```

## 后续优化

1. **面包屑导航**: 在引用块页面显示"返回主文档"链接
2. **引用树**: 显示引用关系链
3. **批量删除**: 删除主文档时自动删除关联的引用块分享
4. **引用计数**: 统计每个块被引用的次数
5. **预览模式**: 悬停显示引用块内容预览

---

**实现日期**: 2025-11-08  
**版本**: v2.0.0  
**状态**: ✅ 已实现 - 独立URL方式
