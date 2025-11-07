export interface ShareOptions {
    docId: string;
    docTitle: string;
    requirePassword: boolean;
    password?: string;
    expireDays: number;
    isPublic: boolean;
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
