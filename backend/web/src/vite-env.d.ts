/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  // 在此添加更多环境变量类型定义
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
