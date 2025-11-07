import api from './index'

export interface ShareData {
  id: string
  docTitle: string
  content: string
  requirePassword: boolean
  expireAt: string
  viewCount: number
  createdAt: string
}

export interface ShareResponse {
  code: number
  msg: string
  data?: ShareData
}

/**
 * 获取分享内容
 */
export const getShare = async (shareId: string, password?: string): Promise<ShareResponse> => {
  const params = password ? { password } : {}
  return api.get(`/api/s/${shareId}`, { params })
}
