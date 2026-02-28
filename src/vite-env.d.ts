/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BEDROCK_API_KEY: string
  // Add more env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
