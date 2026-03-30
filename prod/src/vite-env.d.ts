/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DECOR_API_URL: string
  readonly VITE_DECOR_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
