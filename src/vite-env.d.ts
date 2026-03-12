/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SANITY_PROJECT_ID: string
  readonly VITE_SANITY_DATASET: string
  readonly VITE_SANITY_ORGANIZATION_ID: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
