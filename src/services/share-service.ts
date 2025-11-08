import { showMessage } from "siyuan";
import type SharePlugin from "../index";
import type { BatchDeleteShareResponse, BlockReference, KramdownResponse, ShareOptions, ShareRecord, ShareResponse } from "../types";
import { BlockReferenceResolver } from "../utils/block-reference-resolver";
import { parseKramdownToMarkdown } from "../utils/kramdown-parser";

export class ShareService {
    private plugin: SharePlugin;
    // 导出内容缓存：会话级，避免短时间重复导出同一文档
    private contentCache = new Map<string, { content: string; ts: number }>();
    private contentPromiseCache = new Map<string, Promise<string | null>>();

    constructor(plugin: SharePlugin) {
        this.plugin = plugin;
    }

    /**
     * 创建分享
     */
    async createShare(options: ShareOptions): Promise<ShareRecord> {
        const config = this.plugin.settings.getConfig();

        // 检查配置
        if (!config.serverUrl || !config.apiToken) {
            throw new Error(this.plugin.i18n.shareErrorNotConfigured);
        }

        if (!config.siyuanToken) {
            throw new Error(this.plugin.i18n.shareErrorSiyuanTokenMissing || "请先配置思源内核 Token");
        }

        // 1. 导出文档内容及引用块
        const { content, references } = await this.exportDocContentWithRefs(options.docId);
        if (!content) {
            throw new Error(this.plugin.i18n.shareErrorExportFailed);
        }

        // 2. 构造请求数据
        const payload = {
            docId: options.docId,
            docTitle: options.docTitle,
            content: content,
            requirePassword: options.requirePassword,
            password: options.requirePassword ? options.password ?? "" : "",
            expireDays: options.expireDays,
            isPublic: options.isPublic,
            references: references, // 包含引用块信息
        };

        // 3. 调用后端 API
        try {
            const response = await this.callShareAPI(config.serverUrl, config.apiToken, payload);
            
            if (response.code !== 0) {
                throw new Error(response.msg || this.plugin.i18n.shareErrorUnknown);
            }

            // 4. 保存分享记录到本地
            const shareData = response.data;
            const record: ShareRecord = {
                id: shareData.shareId,
                docId: shareData.docId || options.docId,
                docTitle: shareData.docTitle || options.docTitle,
                shareUrl: shareData.shareUrl,
                requirePassword: shareData.requirePassword,
                expireAt: new Date(shareData.expireAt).getTime(),
                isPublic: shareData.isPublic,
                createdAt: new Date(shareData.createdAt).getTime(),
                updatedAt: new Date(shareData.updatedAt).getTime(),
                reused: shareData.reused,
            };

            await this.plugin.shareRecordManager.addRecord(record);

            return record;
        } catch (error) {
            console.error("Share creation failed:", error);
            throw error;
        }
    }

    /**
     * 导出文档内容及引用块(使用 Kramdown 源码)
     * @returns 文档内容和引用块列表
     */
    private async exportDocContentWithRefs(docId: string): Promise<{ content: string; references: BlockReference[] }> {
        const config = this.plugin.settings.getConfig();
        
        try {
            // 1. 获取文档的 Kramdown 内容
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20_000);
            
            const response = await fetch("/api/block/getBlockKramdown", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${config.siyuanToken}`,
                },
                body: JSON.stringify({ 
                    id: docId,
                    mode: "md"
                }),
                signal: controller.signal,
            });
            
            clearTimeout(timeout);

            if (!response.ok) {
                const errorMsg = `Kramdown API 调用失败: HTTP ${response.status} ${response.statusText}`;
                console.error(errorMsg);
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return { content: "", references: [] };
            }

            const result: KramdownResponse = await response.json();
            
            if (result.code !== 0) {
                const errorMsg = `Kramdown API 返回错误: ${result.msg || '未知错误'}`;
                console.error(errorMsg, { docId, code: result.code });
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return { content: "", references: [] };
            }
            
            if (!result.data || !result.data.kramdown) {
                console.error("Kramdown API 返回数据为空", { docId, data: result.data });
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return { content: "", references: [] };
            }

            const kramdownContent = result.data.kramdown;

            // 2. 解析文档中的所有引用块
            const resolver = new BlockReferenceResolver({
                siyuanToken: config.siyuanToken,
                maxDepth: 5,
            });

            const references = await resolver.resolveDocumentReferences(kramdownContent);

            console.debug("文档引用解析完成:", {
                docId,
                引用块数量: references.length,
                引用块ID列表: references.map(r => r.blockId),
            });

            // 3. 将 Kramdown 转换为 Markdown
            const markdown = parseKramdownToMarkdown(kramdownContent);
            
            if (!markdown) {
                console.error("Kramdown 解析结果为空", { docId, kramdownLength: kramdownContent.length });
                showMessage(this.plugin.i18n.kramdownParseError, 4000, "error");
                return { content: "", references: [] };
            }

            return { content: markdown, references };
        } catch (error) {
            console.error("导出文档时发生异常:", error, { docId });
            
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    showMessage(this.plugin.i18n.kramdownTimeout, 4000, "error");
                } else {
                    showMessage(this.plugin.i18n.kramdownApiFailed + ": " + error.message, 4000, "error");
                }
            } else {
                showMessage(this.plugin.i18n.shareErrorUnknown, 4000, "error");
            }
            
            return { content: "", references: [] };
        }
    }

    /**
     * 导出文档内容(使用 Kramdown 源码) - 旧版方法,保留用于向后兼容
     */
    private async exportDocContent(docId: string): Promise<string | null> {
        // 短期缓存命中（60s）
        const cached = this.contentCache.get(docId);
        if (cached && Date.now() - cached.ts < 60_000) {
            return cached.content;
        }
        const inflight = this.contentPromiseCache.get(docId);
        if (inflight) return inflight;

        const p = (async (): Promise<string | null> => {
        const config = this.plugin.settings.getConfig();
        
        try {
            // 使用思源内核 Token 调用 Kramdown API
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20_000);
            
            const response = await fetch("/api/block/getBlockKramdown", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${config.siyuanToken}`,
                },
                body: JSON.stringify({ 
                    id: docId,
                    mode: "md" // 使用 md 模式，链接 URL 不编码空格
                }),
                signal: controller.signal,
            });
            
            clearTimeout(timeout);

            if (!response.ok) {
                const errorMsg = `Kramdown API 调用失败: HTTP ${response.status} ${response.statusText}`;
                console.error(errorMsg);
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return null;
            }

            const result: KramdownResponse = await response.json();
            
            if (result.code !== 0) {
                const errorMsg = `Kramdown API 返回错误: ${result.msg || '未知错误'}`;
                console.error(errorMsg, { docId, code: result.code });
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return null;
            }
            
            if (!result.data || !result.data.kramdown) {
                console.error("Kramdown API 返回数据为空", { docId, data: result.data });
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return null;
            }

            // 使用解析器将 Kramdown 转换为 Markdown
            try {
                const markdown = parseKramdownToMarkdown(result.data.kramdown);
                
                if (!markdown) {
                    console.error("Kramdown 解析结果为空", { docId, kramdownLength: result.data.kramdown.length });
                    showMessage(this.plugin.i18n.kramdownParseError, 4000, "error");
                    return null;
                }
                
                // 缓存转换后的内容
                this.contentCache.set(docId, { content: markdown, ts: Date.now() });
                console.debug("文档导出成功", { 
                    docId, 
                    kramdownLength: result.data.kramdown.length,
                    markdownLength: markdown.length 
                });
                
                return markdown;
            } catch (parseError) {
                console.error("Kramdown 解析失败:", parseError, { 
                    docId, 
                    kramdownPreview: result.data.kramdown.substring(0, 200) 
                });
                showMessage(this.plugin.i18n.kramdownParseError, 4000, "error");
                return null;
            }
        } catch (error) {
            // 网络错误或超时
            console.error("导出文档时发生异常:", error, { docId });
            
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    showMessage(this.plugin.i18n.kramdownTimeout, 4000, "error");
                } else {
                    showMessage(this.plugin.i18n.kramdownApiFailed + ": " + error.message, 4000, "error");
                }
            } else {
                showMessage(this.plugin.i18n.shareErrorUnknown, 4000, "error");
            }
            
            return null;
        } finally {
            this.contentPromiseCache.delete(docId);
        }
        })();

        this.contentPromiseCache.set(docId, p);
        return p;
    }



    /**
     * 调用分享 API
     */
    private async callShareAPI(serverUrl: string, apiToken: string, payload: any): Promise<ShareResponse> {
        const base = serverUrl.replace(/\/$/, "");
        try {
            const response = await fetch(`${base}/api/share/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiToken}`,
                    // 明确传递 Base URL（后端也会自动推断，双轨兼容）
                    "X-Base-URL": base,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            return result as ShareResponse;
        } catch (error: any) {
            console.error("API call failed:", error);
            if (error.message) {
                throw new Error(this.plugin.i18n.shareErrorNetworkFailed + ": " + error.message);
            }
            throw new Error(this.plugin.i18n.shareErrorNetworkFailed + ": " + String(error));
        }
    }

    /**
     * 删除分享
     */
    async deleteShare(shareId: string): Promise<void> {
        const config = this.plugin.settings.getConfig();

        if (!config.serverUrl || !config.apiToken) {
            throw new Error(this.plugin.i18n.shareErrorNotConfigured);
        }

        const base = config.serverUrl.replace(/\/$/, "");
        // 调用后端 API 删除分享
        const resp = await fetch(`${base}/api/share/${encodeURIComponent(shareId)}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${config.apiToken}`,
            },
        });
        if (!resp.ok) {
            if (resp.status === 404) {
                await this.plugin.shareRecordManager.removeRecord(shareId);
                return;
            }
            const text = await resp.text();
            console.error("Delete share failed:", resp.status, text);
            throw new Error(this.plugin.i18n.shareErrorNetworkFailed + `: HTTP ${resp.status}`);
        }

        // 从本地记录中删除
        await this.plugin.shareRecordManager.removeRecord(shareId);
    }

    /**
     * 批量删除分享（传入 shareIds 时逐个删除，否则删除全部）
     */
    async deleteShares(shareIds?: string[]): Promise<BatchDeleteShareResponse["data"]> {
        const config = this.plugin.settings.getConfig();

        if (!config.serverUrl || !config.apiToken) {
            throw new Error(this.plugin.i18n.shareErrorNotConfigured);
        }

        const base = config.serverUrl.replace(/\/$/, "");

        const response = await fetch(`${base}/api/share/batch`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiToken}`,
            },
            body: shareIds ? JSON.stringify({ shareIds }) : JSON.stringify({ shareIds: [] }),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => response.statusText);
            throw new Error(this.plugin.i18n.shareErrorNetworkFailed + `: HTTP ${response.status} ${text}`);
        }

        const result = (await response.json()) as BatchDeleteShareResponse;
        if (result.code !== 0) {
            throw new Error(result.msg || this.plugin.i18n.shareErrorUnknown);
        }

        const data = result.data || {};
        if (shareIds && shareIds.length) {
            const deleted = data.deleted ?? [];
            const notFound = data.notFound ?? [];
            const toRemove = [...deleted, ...notFound];
            if (toRemove.length) {
                await this.plugin.shareRecordManager.removeRecords(toRemove);
            }
        } else {
            await this.plugin.shareRecordManager.clearAll();
        }

        return data;
    }
}
