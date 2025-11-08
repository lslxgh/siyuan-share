/**
 * Kramdown 解析器测试
 * 用于验证基础转换功能
 */

import { parseKramdownToMarkdown } from './kramdown-parser';

/**
 * 测试用例
 */
const testCases = [
    {
        name: "基础 IAL 属性清理",
        input: `段落内容
{: id="20210101-abc1234" style="color:red"}
另一段内容
{: id="20210102-def5678"}`,
        expected: `段落内容

另一段内容`
    },
    {
        name: "行内 IAL - 列表项",
        input: `* {: id="20201225220955-2nn1mns"}新建笔记本，在笔记本下新建文档
  {: id="20210131155408-3t627wc"}
* {: id="20201225220955-uwhqnug"}在编辑器中输入 <kbd>/</kbd> 触发功能菜单`,
        expected: `* 新建笔记本，在笔记本下新建文档

* 在编辑器中输入 <kbd>/</kbd> 触发功能菜单`
    },
    {
        name: "行内 IAL - 有序列表",
        input: `1. {: id="20251106140708-noc3gik" updated="20251106140708"}第一项
2. {: id="20251106140709-xyz1234" fold="1"}第二项`,
        expected: `1. 第一项
2. 第二项`
    },
    {
        name: "行内 IAL - 代码和其他元素",
        input: `这是一段文本，包含\`行内代码\`{: id="xxx"}和其他内容{: style="color:red"}。`,
        expected: `这是一段文本，包含\`行内代码\`和其他内容。`
    },
    {
        name: "块引用转换 - 带显示文本",
        input: `这是一个引用 ((20210101-abc1234 "参考资料")) 的示例。`,
        expected: `这是一个引用 [参考资料] 的示例。`
    },
    {
        name: "块引用转换 - 无显示文本",
        input: `查看 ((20210101-abc1234)) 了解详情。`,
        expected: `查看 [引用] 了解详情。`
    },
    {
        name: "嵌入查询移除",
        input: `以下是查询结果：
{{SELECT * FROM blocks WHERE content LIKE '%测试%'}}
查询结束`,
        expected: `以下是查询结果：

查询结束`
    },
    {
        name: "YAML Front Matter 清理",
        input: `---
title: 测试文档
date: 2021-01-01
---
正文内容`,
        expected: `正文内容`
    },
    {
        name: "复杂嵌套结构",
        input: `* {: id="20201225220955-2nn1mns"}新建笔记本，在笔记本下新建文档
  {: id="20210131155408-3t627wc"}
* {: id="20201225220955-uwhqnug"}在编辑器中输入 <kbd>/</kbd> 触发功能菜单
  {: id="20210131155408-btnfw88"}
* 查看 ((20200813131152-0wk5akh "快捷键")) 了解更多`,
        expected: `* 新建笔记本，在笔记本下新建文档

* 在编辑器中输入 <kbd>/</kbd> 触发功能菜单

* 查看 [快捷键] 了解更多`
    },
    {
        name: "混合 IAL 类型",
        input: `1. {: id="item1"}列表项一
   {: id="sub1"}
2. {: id="item2" fold="1" heading-fold="1"}列表项二

段落内容{: style="color:blue"}继续。
{: id="para1" updated="20251106140708"}`,
        expected: `1. 列表项一

2. 列表项二

段落内容继续。`
    },
    {
        name: "空输入处理",
        input: "",
        expected: ""
    },
    {
        name: "仅 IAL 属性",
        input: `{: id="20210101-abc1234"}
{: id="20210102-def5678"}`,
        expected: ``
    }
];

/**
 * 运行测试
 */
function runTests() {
    console.log("🧪 开始运行 Kramdown 解析器测试...\n");
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        const result = parseKramdownToMarkdown(testCase.input);
        const success = result.trim() === testCase.expected.trim();
        
        if (success) {
            console.log(`✅ ${testCase.name}`);
            passed++;
        } else {
            console.log(`❌ ${testCase.name}`);
            console.log(`   期望: ${JSON.stringify(testCase.expected)}`);
            console.log(`   实际: ${JSON.stringify(result)}`);
            failed++;
        }
    }
    
    console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);
    
    if (failed === 0) {
        console.log("🎉 所有测试通过！");
    }
}

// 导出测试函数（可在控制台手动调用）
if (typeof window !== 'undefined') {
    (window as any).testKramdownParser = runTests;
}
