# IAL 清理功能修复说明

## 问题描述

在使用 Kramdown 解析器时发现，某些块会保留 IAL (Inline Attribute List) 属性信息，例如：

```markdown
1. {: id="20251106140708-noc3gik" updated="20251106140708" fold="1" heading-fold="1"}列表项内容
* {: id="20201225220955-2nn1mns"}新建笔记本
`行内代码`{: id="xxx"}
```

这些 IAL 属性应该在转换为标准 Markdown 时被清理掉。

## 根本原因

原有的 `cleanIALAttributes()` 函数只处理了**独立行的 IAL**：

```markdown
段落内容
{: id="20210101-abc1234" style="color:red"}
```

但思源笔记的 Kramdown 格式中，IAL 还有**行内形式**：

```markdown
* {: id="xxx"}列表项内容          ← 列表项开头
1. {: id="xxx"}有序列表            ← 有序列表开头  
`代码`{: id="xxx"}                 ← 行内元素后
段落文本{: style="color:red"}      ← 文本中间
```

原正则表达式 `/^[ \t]*\{:.*?\}\s*$/gm` 只匹配行首到行尾都是 IAL 的情况，无法处理行内 IAL。

## 解决方案

修改 `cleanIALAttributes()` 函数，按顺序处理所有 IAL 类型：

### 1. 清理列表项开头的 IAL

```typescript
// "* {: id=\"xxx\"}内容" → "* 内容"
result = result.replace(/^(\s*[-*+]\s+)\{:.*?\}/gm, '$1');
```

### 2. 清理有序列表开头的 IAL

```typescript
// "1. {: id=\"xxx\"}内容" → "1. 内容"
result = result.replace(/^(\s*\d+\.\s+)\{:.*?\}/gm, '$1');
```

### 3. 清理所有行内 IAL

```typescript
// "文本{: attr=\"value\"}文本" → "文本文本"
result = result.replace(/\{:\s*[^}]*?\}/g, '');
```

### 4. 清理独立行 IAL

```typescript
// 整行都是 IAL 的情况
result = result.replace(/^[ \t]*\{:.*?\}\s*$/gm, '');
```

### 5. 清理空白行

```typescript
// 清理仅包含空格的行（步骤 4 可能产生）
result = result.replace(/^[ \t]+$/gm, '');

// 清理多余空行（保留最多两个连续换行）
result = result.replace(/\n{3,}/g, '\n\n');
```

## 测试验证

创建了专门的测试脚本 `test-ial.js`，包含以下测试用例：

1. ✅ 列表项开头的 IAL
2. ✅ 有序列表的 IAL
3. ✅ 行内代码的 IAL
4. ✅ 独立行 IAL
5. ✅ 混合类型（多种 IAL 同时存在）

所有测试均通过。

## 影响范围

### 修改的文件

1. **src/utils/kramdown-parser.ts**
   - 修改 `cleanIALAttributes()` 函数实现
   - 添加更详细的注释说明

2. **src/utils/kramdown-parser.test.ts**
   - 新增行内 IAL 测试用例
   - 新增混合类型测试用例

3. **docs/KRAMDOWN_IMPLEMENTATION.md**
   - 更新 IAL 格式说明
   - 补充行内 IAL 示例

4. **test-ial.js** (新增)
   - 独立的快速测试脚本
   - 可用于验证修复效果

### 向后兼容性

✅ 完全兼容，不影响现有功能：
- 原有的独立行 IAL 清理逻辑保留
- 新增的行内 IAL 清理不会破坏其他内容
- 所有原有测试用例仍然通过

## 使用示例

### 修复前

```markdown
输入：
1. {: id="20251106140708-noc3gik" updated="20251106140708"}列表项
   {: id="sub-item"}

输出：
1. {: id="20251106140708-noc3gik" updated="20251106140708"}列表项  ← ❌ IAL 未清理
```

### 修复后

```markdown
输入：
1. {: id="20251106140708-noc3gik" updated="20251106140708"}列表项
   {: id="sub-item"}

输出：
1. 列表项  ← ✅ IAL 已清理
```

## 正则表达式说明

### 列表项 IAL 清理

```typescript
/^(\s*[-*+]\s+)\{:.*?\}/gm
```

- `^` - 行首
- `(\s*[-*+]\s+)` - 捕获列表标记（`-`、`*`、`+`）及其前后空格
- `\{:.*?\}` - 匹配 IAL 块（非贪婪）
- `gm` - 全局多行模式
- 替换为 `$1` 保留列表标记

### 有序列表 IAL 清理

```typescript
/^(\s*\d+\.\s+)\{:.*?\}/gm
```

- `\d+\.` - 匹配数字和点号（如 `1.`、`2.`）
- 其他同上

### 通用行内 IAL 清理

```typescript
/\{:\s*[^}]*?\}/g
```

- `\{:` - IAL 起始
- `\s*` - 可选空格
- `[^}]*?` - 任意非 `}` 字符（非贪婪）
- `\}` - IAL 结束
- 全局替换为空字符串

## 后续优化建议

1. **性能优化**
   - 如果文档很大（>10000 字），可考虑使用 Web Worker 异步处理
   - 对正则表达式进行性能测试

2. **边界情况**
   - 测试包含大量嵌套 IAL 的复杂文档
   - 验证特殊字符（如 `}`）在 IAL 属性值中的处理

3. **日志记录**
   - 添加调试日志记录被清理的 IAL 数量
   - 便于排查解析问题

## 参考资料

- [思源笔记 API 文档](../../siyuan/API_zh_CN.md) - getBlockKramdown 接口
- [Kramdown 语法规范](https://kramdown.gettalong.org/syntax.html#inline-attribute-lists)
- [AGENTS.md](../AGENTS.md) - 插件开发速查手册

---

**修复日期**: 2025-11-08  
**版本**: v1.0.1  
**状态**: ✅ 已完成并测试通过
