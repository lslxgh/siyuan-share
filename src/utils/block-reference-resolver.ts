/**
 * 块引用解析器
 * 负责获取引用块内容并递归处理嵌套引用
 */

import type { BlockReference, KramdownResponse } from "../types";
import { extractBlockReferences, parseKramdownToMarkdown } from "./kramdown-parser";

/**
 * 块引用解析器选项
 */
export interface ResolverOptions {
    siyuanToken: string;
    maxDepth?: number; // 最大递归深度,防止循环引用
}

/**
 * 块引用解析器
 */
export class BlockReferenceResolver {
    private siyuanToken: string;
    private maxDepth: number;
    private resolvedBlocks = new Map<string, BlockReference>(); // 缓存已解析的块
    private resolving = new Set<string>(); // 正在解析的块ID,用于检测循环引用

    constructor(options: ResolverOptions) {
        this.siyuanToken = options.siyuanToken;
        this.maxDepth = options.maxDepth || 5;
    }

    /**
     * 获取块内容
     */
    private async getBlockContent(blockId: string): Promise<string | null> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch("/api/block/getBlockKramdown", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${this.siyuanToken}`,
                },
                body: JSON.stringify({
                    id: blockId,
                    mode: "md"
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                console.error(`获取块内容失败: HTTP ${response.status}`, blockId);
                return null;
            }

            const result: KramdownResponse = await response.json();

            if (result.code !== 0 || !result.data?.kramdown) {
                console.error("块内容API返回错误:", result.msg, blockId);
                return null;
            }

            // 将 Kramdown 转换为 Markdown
            const markdown = parseKramdownToMarkdown(result.data.kramdown);
            return markdown;
        } catch (error) {
            console.error("获取块内容异常:", error, blockId);
            return null;
        }
    }

    /**
     * 递归解析块及其引用(深度优先)
     * @param blockId 块ID
     * @param displayText 显示文本(可选)
     * @param depth 当前递归深度
     * @returns 解析后的块引用信息
     */
    private async resolveBlockRecursive(
        blockId: string,
        displayText?: string,
        depth: number = 0
    ): Promise<BlockReference | null> {
        // 检查缓存
        if (this.resolvedBlocks.has(blockId)) {
            const cached = this.resolvedBlocks.get(blockId)!;
            cached.refCount = (cached.refCount || 0) + 1;
            // 如果有新的 displayText 且缓存中没有,更新它
            if (displayText && !cached.displayText) {
                cached.displayText = displayText;
            }
            return cached;
        }

        // 检测循环引用
        if (this.resolving.has(blockId)) {
            console.warn("检测到循环引用,跳过:", blockId);
            return null;
        }

        // 检查递归深度
        if (depth >= this.maxDepth) {
            console.warn("达到最大递归深度,跳过:", blockId, depth);
            return null;
        }

        this.resolving.add(blockId);

        try {
            // 获取块内容
            const content = await this.getBlockContent(blockId);
            if (!content) {
                return null;
            }

            // 提取该块中的引用
            const refs = extractBlockReferences(content);

            // 递归解析子引用
            if (refs.length > 0) {
                await Promise.all(
                    refs.map(ref => this.resolveBlockRecursive(ref.blockId, ref.displayText, depth + 1))
                );
            }

            // 构建块引用信息
            const blockRef: BlockReference = {
                blockId,
                content,
                displayText, // 保存显示文本
                refCount: 1,
            };

            this.resolvedBlocks.set(blockId, blockRef);
            return blockRef;
        } finally {
            this.resolving.delete(blockId);
        }
    }

    /**
     * 解析文档内容及其所有引用
     * @param docContent 文档内容(Kramdown)
     * @returns 所有引用块的信息数组(按依赖顺序)
     */
    async resolveDocumentReferences(docContent: string): Promise<BlockReference[]> {
        // 清空缓存
        this.resolvedBlocks.clear();
        this.resolving.clear();

        // 提取文档中的直接引用
        const directRefs = extractBlockReferences(docContent);

        if (directRefs.length === 0) {
            return [];
        }

        // 并行解析所有直接引用(及其嵌套引用)
        await Promise.all(
            directRefs.map(ref => this.resolveBlockRecursive(ref.blockId, ref.displayText))
        );

        // 返回所有已解析的块(按引用次数排序,被引用越多的越靠前)
        const allRefs = Array.from(this.resolvedBlocks.values());
        
        // 按依赖顺序排序:被引用多的块应该先发送
        allRefs.sort((a, b) => (b.refCount || 0) - (a.refCount || 0));

        console.debug("解析完成:", {
            直接引用数: directRefs.length,
            总引用数: allRefs.length,
            引用块列表: allRefs.map(r => ({ id: r.blockId, displayText: r.displayText, refCount: r.refCount }))
        });

        return allRefs;
    }
}
