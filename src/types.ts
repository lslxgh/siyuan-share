export interface ShareOptions {
    docId: string;
    docTitle: string;
    requirePassword: boolean;
    password?: string;
    expireDays: number;
    isPublic: boolean;
}

/**
 * 引用块信息
 */
export interface BlockReference {
    blockId: string;
    content: string;
    displayText?: string;
    refCount?: number;
}

/**
 * 文档内容及其引用块
 */
export interface DocContentWithRefs {
    content: string;
    references: BlockReference[];
}

export interface ShareRecord {
    id: string;
    docId: string;
    docTitle: string;
    shareUrl: string;
    requirePassword: boolean;
    expireAt: number;
    isPublic: boolean;
    createdAt: number;
    updatedAt: number;
    viewCount?: number;
    reused?: boolean;
}

export interface ShareResponse {
    code: number;
    msg: string;
    data: {
        shareId: string;
        shareUrl: string;
        docId: string;
        docTitle: string;
        requirePassword: boolean;
        expireAt: string;
        isPublic: boolean;
        createdAt: string;
        updatedAt: string;
        reused: boolean;
    };
}

export interface ShareListResponse {
    code: number;
    msg: string;
    data: {
        shares: ShareRecord[];
    };
}

export interface SiyuanKernelResponse<T = any> {
    code: number;
    msg: string;
    data: T;
}

/**
 * Kramdown API 响应格式
 */
export interface KramdownResponse {
    code: number;
    msg: string;
    data: {
        id: string;
        kramdown: string;
    };
}

/**
 * 块属性查询响应
 */
export interface BlockAttrsResponse {
    code: number;
    msg: string;
    data: Record<string, string>;
}

/**
 * SQL 查询响应
 */
export interface SqlQueryResponse {
    code: number;
    msg: string;
    data: Array<Record<string, any>>;
}

export interface BatchDeleteShareResponseData {
    deleted?: string[];
    notFound?: string[];
    failed?: Record<string, string>;
    deletedAllCount?: number;
}

export interface BatchDeleteShareResponse {
    code: number;
    msg: string;
    data: BatchDeleteShareResponseData;
}
