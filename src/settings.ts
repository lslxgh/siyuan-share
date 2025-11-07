import { Setting } from "siyuan";
import type SharePlugin from "./index";

export interface ShareConfig {
    serverUrl: string;
    apiToken: string;
    siyuanToken: string;
    defaultPassword: boolean;
    defaultExpireDays: number;
    defaultPublic: boolean;
}

export const DEFAULT_CONFIG: ShareConfig = {
    serverUrl: "",
    apiToken: "",
    siyuanToken: "",
    defaultPassword: false,
    defaultExpireDays: 7,
    defaultPublic: true,
};

export class ShareSettings {
    private plugin: SharePlugin;
    private config: ShareConfig;

    constructor(plugin: SharePlugin) {
        this.plugin = plugin;
        this.config = { ...DEFAULT_CONFIG };
    }

    async load(): Promise<void> {
        const savedConfig = await this.plugin.loadData("share-config");
        if (savedConfig) {
            this.config = { ...DEFAULT_CONFIG, ...savedConfig };
        }
    }

    async save(): Promise<void> {
        await this.plugin.saveData("share-config", this.config);
    }

    getConfig(): ShareConfig {
        return { ...this.config };
    }

    updateConfig(config: Partial<ShareConfig>): void {
        this.config = { ...this.config, ...config };
    }

    createSettingPanel(): Setting {
        // 创建输入元素
        const serverUrlInput = document.createElement("input");
        serverUrlInput.className = "b3-text-field fn__block";
        serverUrlInput.placeholder = "https://share.example.com";
        serverUrlInput.value = this.config.serverUrl;
        
        const apiTokenInput = document.createElement("input");
        apiTokenInput.className = "b3-text-field fn__block";
        apiTokenInput.type = "password";
        apiTokenInput.placeholder = this.plugin.i18n.settingApiTokenPlaceholder;
        apiTokenInput.value = this.config.apiToken;
        
        const siyuanTokenInput = document.createElement("input");
        siyuanTokenInput.className = "b3-text-field fn__block";
        siyuanTokenInput.type = "password";
        siyuanTokenInput.placeholder = this.plugin.i18n.settingSiyuanTokenPlaceholder || "思源笔记内核 API Token";
        siyuanTokenInput.value = this.config.siyuanToken;
        
        const defaultPasswordCheckbox = document.createElement("input");
        defaultPasswordCheckbox.type = "checkbox";
        defaultPasswordCheckbox.className = "b3-switch fn__flex-center";
        defaultPasswordCheckbox.checked = this.config.defaultPassword;
        
        const defaultExpireInput = document.createElement("input");
        defaultExpireInput.className = "b3-text-field fn__block";
        defaultExpireInput.type = "number";
        defaultExpireInput.min = "1";
        defaultExpireInput.max = "365";
        defaultExpireInput.value = this.config.defaultExpireDays.toString();
        
        const defaultPublicCheckbox = document.createElement("input");
        defaultPublicCheckbox.type = "checkbox";
        defaultPublicCheckbox.className = "b3-switch fn__flex-center";
        defaultPublicCheckbox.checked = this.config.defaultPublic;

        // 创建 Setting 对象并传入保存回调
        const setting = new Setting({
            confirmCallback: async () => {
                this.config.serverUrl = serverUrlInput.value.trim();
                this.config.apiToken = apiTokenInput.value.trim();
                this.config.siyuanToken = siyuanTokenInput.value.trim();
                this.config.defaultPassword = defaultPasswordCheckbox.checked;
                this.config.defaultExpireDays = parseInt(defaultExpireInput.value) || 7;
                this.config.defaultPublic = defaultPublicCheckbox.checked;
                
                await this.save();
            }
        });
        
        // 服务端 URL
        setting.addItem({
            title: this.plugin.i18n.settingServerUrl,
            description: this.plugin.i18n.settingServerUrlDesc,
            createActionElement: () => serverUrlInput,
        });

        // API Token
        setting.addItem({
            title: this.plugin.i18n.settingApiToken,
            description: this.plugin.i18n.settingApiTokenDesc,
            createActionElement: () => apiTokenInput,
        });

        // 思源内核 Token
        setting.addItem({
            title: this.plugin.i18n.settingSiyuanToken || "思源内核 Token",
            description: this.plugin.i18n.settingSiyuanTokenDesc || "用于调用思源笔记内部 API 的认证令牌（设置 -> 关于 -> API token）",
            createActionElement: () => siyuanTokenInput,
        });

        // 测试连接按钮
        const testButton = document.createElement("button");
        testButton.className = "b3-button b3-button--outline fn__block";
        testButton.textContent = this.plugin.i18n.settingTestConnection;
        testButton.addEventListener("click", async () => {
            testButton.disabled = true;
            testButton.textContent = this.plugin.i18n.testConnectionTesting;
            
            try {
                // 使用输入框的当前值进行测试,而不是已保存的配置
                const testConfig = {
                    serverUrl: serverUrlInput.value.trim(),
                    apiToken: apiTokenInput.value.trim(),
                    siyuanToken: siyuanTokenInput.value.trim(),
                };
                const result = await this.testConnection(testConfig);
                if (result.success) {
                    this.plugin.showMessage(this.plugin.i18n.testConnectionSuccess + "\n" + result.message, 4000);
                } else {
                    this.plugin.showMessage(this.plugin.i18n.testConnectionFailed + "\n" + result.message, 6000, "error");
                }
            } catch (error: any) {
                this.plugin.showMessage(this.plugin.i18n.testConnectionFailed + ": " + error.message, 5000, "error");
            } finally {
                testButton.disabled = false;
                testButton.textContent = this.plugin.i18n.settingTestConnection;
            }
        });

        setting.addItem({
            title: this.plugin.i18n.settingTestConnection,
            description: this.plugin.i18n.settingTestConnectionDesc,
            createActionElement: () => testButton,
        });

        // 默认启用密码保护
        setting.addItem({
            title: this.plugin.i18n.settingDefaultPassword,
            description: this.plugin.i18n.settingDefaultPasswordDesc,
            createActionElement: () => defaultPasswordCheckbox,
        });

        // 默认有效期（天）
        setting.addItem({
            title: this.plugin.i18n.settingDefaultExpire,
            description: this.plugin.i18n.settingDefaultExpireDesc,
            createActionElement: () => defaultExpireInput,
        });

        // 默认公开分享
        setting.addItem({
            title: this.plugin.i18n.settingDefaultPublic,
            description: this.plugin.i18n.settingDefaultPublicDesc,
            createActionElement: () => defaultPublicCheckbox,
        });

        return setting;
    }

    isConfigured(): boolean {
        return !!(this.config.serverUrl && this.config.apiToken && this.config.siyuanToken);
    }

    /**
     * 测试连接
     * @param testConfig 可选的测试配置,如果不提供则使用当前保存的配置
     */
    async testConnection(testConfig?: { serverUrl: string; apiToken: string; siyuanToken: string }): Promise<{ success: boolean; message: string }> {
        const config = testConfig || this.config;
        const results: string[] = [];
        let hasError = false;

        // 1. 测试后端 API Token
        if (!config.serverUrl || !config.apiToken) {
            results.push("❌ " + this.plugin.i18n.testBackendFailed + ": 配置缺失");
            hasError = true;
        } else {
            try {
                const base = config.serverUrl.replace(/\/$/, "");
                const response = await fetch(`${base}/api/health`, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${config.apiToken}`,
                    },
                });

                if (response.status === 401 || response.status === 403) {
                    // 明确的认证失败
                    results.push("❌ " + this.plugin.i18n.testBackendFailed + ": Token 无效或未授权");
                    hasError = true;
                } else if (!response.ok) {
                    // 其他错误
                    const errorText = await response.text().catch(() => response.statusText);
                    results.push(`❌ ${this.plugin.i18n.testBackendFailed}: HTTP ${response.status} - ${errorText}`);
                    hasError = true;
                } else {
                    // 验证响应格式
                    const result = await response.json();
                    if (result.code === 0 && result.data) {
                        results.push("✅ " + this.plugin.i18n.testBackendSuccess + ` (用户: ${result.data.userID})`);
                    } else {
                        results.push("✅ " + this.plugin.i18n.testBackendSuccess);
                    }
                }
            } catch (error: any) {
                results.push(`❌ ${this.plugin.i18n.testBackendFailed}: ${error.message}`);
                hasError = true;
            }
        }

        // 2. 测试思源内核 API Token
        if (!config.siyuanToken) {
            results.push("❌ " + this.plugin.i18n.testSiyuanFailed + ": Token 缺失");
            hasError = true;
        } else {
            try {
                const response = await fetch("/api/system/version", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Token ${config.siyuanToken}`,
                    },
                    body: JSON.stringify({}),
                });

                if (response.status === 401 || response.status === 403) {
                    // Token 无效
                    results.push("❌ " + this.plugin.i18n.testSiyuanFailed + ": Token 无效");
                    hasError = true;
                } else if (!response.ok) {
                    results.push(`❌ ${this.plugin.i18n.testSiyuanFailed}: HTTP ${response.status}`);
                    hasError = true;
                } else {
                    const result = await response.json();
                    if (result.code !== 0) {
                        results.push(`❌ ${this.plugin.i18n.testSiyuanFailed}: ${result.msg || '未知错误'}`);
                        hasError = true;
                    } else {
                        results.push(`✅ ${this.plugin.i18n.testSiyuanSuccess} (版本: ${result.data || 'unknown'})`);
                    }
                }
            } catch (error: any) {
                results.push(`❌ ${this.plugin.i18n.testSiyuanFailed}: ${error.message}`);
                hasError = true;
            }
        }

        return {
            success: !hasError,
            message: results.join("\n"),
        };
    }
}
