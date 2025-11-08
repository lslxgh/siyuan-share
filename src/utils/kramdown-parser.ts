/**
 * Kramdown 解析器
 * 将思源笔记的 Kramdown 格式转换为标准 Markdown
 */

/**
 * 解析器配置选项（预留未来扩展）
 */
export interface ParserOptions {
    /**
     * 是否保留块引用原始语法（预留）
     */
    preserveBlockRefs?: boolean;
    
    /**
     * 是否解析并展开嵌入查询（预留）
     */
    expandEmbedQueries?: boolean;
}

/**
 * 解析 Kramdown 为 Markdown
 * @param kramdown Kramdown 源码字符串
 * @param options 解析选项
 * @returns 转换后的 Markdown 字符串
 */
export function parseKramdownToMarkdown(kramdown: string, options?: ParserOptions): string {
    if (!kramdown || typeof kramdown !== 'string') {
        return '';
    }

    let result = kramdown;

    // 1. 清理 IAL 属性块 {: id="..." ...}
    result = cleanIALAttributes(result);

    // 2. 转换块引用 ((id)) 或 ((id "文本"))
    result = convertBlockReferences(result, options?.preserveBlockRefs);

    // 3. 清理嵌入查询语法 {{SELECT ...}}（初版仅移除，不展开）
    result = cleanEmbedQueries(result);

    // 4. 其他基础清理
    result = cleanBasicSyntax(result);
    
    // 5. 清理全角空格(思源笔记特有)
    result = cleanFullWidthSpaces(result);

    return result.trim();
}

/**
 * 清理 IAL (Inline Attribute List) 属性
 * 
 * IAL 有两种形式：
 * 1. 独立行: "段落内容\n{: id=\"20210101-abc\" style=\"color:red\"}\n"
 * 2. 行内: "* {: id=\"xxx\"}列表项内容" 或 "`代码`{: id=\"xxx\"}"
 * 
 * 示例输入: "段落内容\n{: id=\"20210101-abc\" style=\"color:red\"}\n"
 * 示例输出: "段落内容\n"
 */
function cleanIALAttributes(content: string): string {
    let result = content;
    
    // 1. 处理列表项开头的 IAL: "* {: id=\"xxx\"}内容" → "* 内容"
    result = result.replace(/^(\s*[-*+]\s+)\{:.*?\}/gm, '$1');
    
    // 2. 处理有序列表开头的 IAL: "1. {: id=\"xxx\"}内容" → "1. 内容"
    result = result.replace(/^(\s*\d+\.\s+)\{:.*?\}/gm, '$1');
    
    // 3. 处理其他行内 IAL（包括代码、链接等后面的）
    result = result.replace(/\{:\s*[^}]*?\}/g, '');
    
    // 4. 移除独立行的 IAL 属性块（可能有缩进）
    // 注意：清理后可能留下空行，后续统一处理
    const ialPattern = /^[ \t]*\{:.*?\}\s*$/gm;
    result = result.replace(ialPattern, '');
    
    // 5. 清理仅包含空格的行（IAL 清理后可能产生）
    // 包括半角空格、制表符和全角空格
    result = result.replace(/^[ \t\u3000]+$/gm, '');
    
    // 6. 清理多余空行（但保留必要的段落间距）
    result = result.replace(/\n{3,}/g, '\n\n');
    
    return result;
}

/**
 * 转换块引用语法
 * 格式1: ((20210101-abc))
 * 格式2: ((20210101-abc "显示文本"))
 * 
 * 转换策略：
 * - 有显示文本: ((id "文本")) → [文本]
 * - 无显示文本: ((id)) → [引用]
 * 
 * @param preserveRefs 是否保留为特殊标记（预留参数）
 */
function convertBlockReferences(content: string, preserveRefs?: boolean): string {
    // 匹配块引用: ((id)) 或 ((id "text"))
    // 块 ID 格式: 20位字符串，yyyyMMddHHmmss-7位字符
    const blockRefPattern = /\(\(([0-9]{14,}-[0-9a-z]{7,})(?:\s+"([^"]+)")?\)\)/g;
    
    return content.replace(blockRefPattern, (match, blockId, displayText) => {
        if (displayText) {
            // 有显示文本，转为纯文本
            return `[${displayText}]`;
        } else {
            // 无显示文本，使用通用占位符
            return '[引用]';
        }
        
        // 预留: 未来可能需要查询块内容或保留为标记
        // if (preserveRefs) {
        //     return `[block-ref:${blockId}]`;
        // }
    });
}

/**
 * 清理嵌入查询语法
 * 格式: {{SELECT * FROM blocks WHERE ...}}
 * 
 * 初版策略：直接移除（后续可实现查询展开）
 */
function cleanEmbedQueries(content: string): string {
    // 匹配嵌入块语法 {{...}}（使用 [\s\S] 代替 . 以匹配换行）
    const embedPattern = /\{\{[\s\S]+?\}\}/g;
    
    return content.replace(embedPattern, (match) => {
        // 记录被移除的嵌入查询（调试用）
        console.debug('[Kramdown Parser] Removed embed query:', match.substring(0, 50) + '...');
        return ''; // 直接移除
    });
}

/**
 * 基础语法清理
 * - 移除可能的 YAML front matter
 * - 移除思源特有的元数据行
 * - 清理多余空行
 */
function cleanBasicSyntax(content: string): string {
    const lines = content.split('\n');
    const filteredLines: string[] = [];
    let inFrontMatter = false;
    
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        
        // YAML front matter 检测
        if (trimmed === '---') {
            if (i === 0 || (i === 1 && !filteredLines.length)) {
                inFrontMatter = true;
                continue;
            } else if (inFrontMatter) {
                inFrontMatter = false;
                continue;
            }
        }
        
        if (inFrontMatter) {
            continue;
        }
        
        // 跳过独立的元数据行
        if (trimmed.startsWith('title:') || 
            trimmed.startsWith('date:') || 
            trimmed.startsWith('lastmod:') ||
            trimmed.startsWith('updated:')) {
            continue;
        }
        
        filteredLines.push(lines[i]);
    }
    
    return filteredLines.join('\n');
}

/**
 * 清理全角空格
 * 思源笔记在某些情况下会使用全角空格(U+3000)作为缩进或占位
 * 将全角空格转换为普通空格或移除
 */
function cleanFullWidthSpaces(content: string): string {
    // 全角空格字符: 　 (U+3000)
    // 策略:
    // 1. 行首的全角空格转为普通空格(保留缩进语义)
    // 2. 仅包含全角空格的行删除
    // 3. 文本中间的全角空格保留为普通空格
    
    const lines = content.split('\n');
    const processedLines = lines.map(line => {
        // 仅包含全角空格的行,删除
        if (/^[\u3000]+$/.test(line)) {
            return '';
        }
        
        // 行首的全角空格转为普通空格(保持缩进)
        // 例: "　　文本" → "  文本"
        line = line.replace(/^[\u3000]+/, (match) => ' '.repeat(match.length));
        
        // 行尾的全角空格删除
        line = line.replace(/[\u3000]+$/, '');
        
        // 连续的全角空格转为单个普通空格
        line = line.replace(/[\u3000]+/g, ' ');
        
        return line;
    });
    
    return processedLines.join('\n');
}

/**
 * 提取文档中的所有块引用 ID
 * @param content Kramdown 或 Markdown 内容
 * @returns 块引用 ID 数组(去重)
 */
export function extractBlockReferences(content: string): Array<{ blockId: string; displayText?: string }> {
    if (!content || typeof content !== 'string') {
        return [];
    }

    const blockRefPattern = /\(\(([0-9]{14,}-[0-9a-z]{7,})(?:\s+["']([^"']+)["'])?\)\)/g;
    const refs: Array<{ blockId: string; displayText?: string }> = [];
    const seen = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = blockRefPattern.exec(content)) !== null) {
        const blockId = match[1];
        const displayText = match[2];
        
        if (!seen.has(blockId)) {
            seen.add(blockId);
            refs.push({ blockId, displayText });
        }
    }

    return refs;
}

/**
 * 解析块引用并获取实际内容(预留接口)
 * 未来可用于查询块内容并展开引用
 * 
 * @param blockId 块 ID
 * @returns 块内容文本或 null
 */
export async function resolveBlockRef(blockId: string): Promise<string | null> {
    // TODO: 调用 /api/block/getBlockKramdown 获取块内容
    // 或使用 /api/query/sql 查询块
    console.warn('[Kramdown Parser] resolveBlockRef not implemented yet:', blockId);
    return null;
}
