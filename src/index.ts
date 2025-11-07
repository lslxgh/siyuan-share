import {
    getAllEditor,
    getFrontend,
    openSetting,
    Plugin,
    showMessage
} from "siyuan";
import { ShareDialog } from "./components/share-dialog";
import "./index.scss";
import { ShareRecordManager } from "./services/share-record";
import { ShareService } from "./services/share-service";
import { ShareSettings } from "./settings";

export default class SharePlugin extends Plugin {

    private isMobile: boolean;
    public settings: ShareSettings;
    public shareService: ShareService;
    public shareRecordManager: ShareRecordManager;



    async onload() {
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        
        // 添加分享图标
        this.addIcons(`<symbol id="iconShare" viewBox="0 0 32 32">
<path d="M24 20c-1.607 0-3.04 0.78-3.947 1.973l-7.167-3.593c0.18-0.56 0.28-1.16 0.28-1.78 0-0.62-0.1-1.22-0.28-1.78l7.167-3.593c0.907 1.193 2.34 1.973 3.947 1.973 2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5c0 0.62 0.1 1.22 0.28 1.78l-7.167 3.593c-0.907-1.193-2.34-1.973-3.947-1.973-2.76 0-5 2.24-5 5s2.24 5 5 5c1.607 0 3.04-0.78 3.947-1.973l7.167 3.593c-0.18 0.56-0.28 1.16-0.28 1.78 0 2.76 2.24 5 5 5s5-2.24 5-5-2.24-5-5-5z"></path>
</symbol>`);

        // 初始化设置与服务
        this.settings = new ShareSettings(this);
        await this.settings.load();
        this.shareRecordManager = new ShareRecordManager(this);
        await this.shareRecordManager.load();
        this.shareRecordManager.startAutoSync();
        this.shareService = new ShareService(this);

        // 设置面板
        this.setting = this.settings.createSettingPanel();

        // 监听文档树菜单添加分享入口
        this.eventBus.on("open-menu-doctree", (evt: any) => {
            const { detail } = evt;
            if (!detail || !detail.menu || !detail.doc) return;
            const docId = detail.doc.id;
            const docTitle = detail.doc.title || detail.doc.name || "Untitled";
            detail.menu.addSeparator();
            detail.menu.addItem({
                icon: "iconShare",
                label: this.i18n.shareMenuShareDoc || "Share Document",
                click: () => {
                    if (!this.settings.isConfigured()) {
                        showMessage(this.i18n.shareErrorNotConfigured, 4000, "error");
                        openSetting(this.app);
                        return;
                    }
                    const dialog = new ShareDialog(this, docId, docTitle);
                    dialog.show();
                }
            });
        });
    }

    onLayoutReady() {
        // 顶栏分享按钮
        const shareTopBar = this.addTopBar({
            icon: "iconShare",
            title: this.i18n.shareTopBarTitle || "Share",
            position: "right",
            callback: async () => {
                const editor = this.getEditor();
                if (!editor) return;
                const docId = editor.protyle.block.rootID;
                
                if (!this.settings.isConfigured()) {
                    showMessage(this.i18n.shareErrorNotConfigured, 4000, "error");
                    openSetting(this.app);
                    return;
                }

                // 获取真实的文档标题
                const docTitle = await this.getDocTitle(docId);
                const d = new ShareDialog(this, docId, docTitle);
                d.show();
            }
        });
    }

    onunload() {
        console.log(this.i18n.byePlugin);
        if (this.shareRecordManager) {
            this.shareRecordManager.stopAutoSync();
        }
    }

    uninstall() {
        console.log("uninstall");
    }

    /**
     * 显示消息提示
     */
    showMessage(msg: string, timeout: number = 3000, type: "info" | "error" = "info") {
        showMessage(msg, timeout, type);
    }

    private getEditor() {
        const editors = getAllEditor();
        if (editors.length === 0) {
            showMessage("please open doc first");
            return;
        }
        return editors[0];
    }

    /**
     * 获取文档标题
     */
    private async getDocTitle(docId: string): Promise<string> {
        try {
            const config = this.settings.getConfig();
            const response = await fetch("/api/attr/getBlockAttrs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${config.siyuanToken}`,
                },
                body: JSON.stringify({ id: docId }),
            });

            if (!response.ok) {
                console.warn("Failed to get document title:", response.status);
                return docId;
            }

            const result = await response.json();
            if (result.code === 0 && result.data) {
                // 尝试从属性中获取标题
                const title = result.data.title || result.data.name;
                if (title) {
                    return title;
                }
            }
        } catch (error) {
            console.error("Error fetching document title:", error);
        }

        // 降级：如果无法获取标题，使用 SQL 查询
        try {
            const config = this.settings.getConfig();
            const response = await fetch("/api/query/sql", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${config.siyuanToken}`,
                },
                body: JSON.stringify({ 
                    stmt: `SELECT content FROM blocks WHERE id = '${docId}' AND type = 'd' LIMIT 1`
                }),
            });

            if (!response.ok) {
                console.warn("Failed to query document title:", response.status);
                return docId;
            }

            const result = await response.json();
            if (result.code === 0 && result.data && result.data.length > 0) {
                return result.data[0].content || docId;
            }
        } catch (error) {
            console.error("Error querying document title:", error);
        }

        // 最终降级：返回文档ID
        return docId;
    }
}
