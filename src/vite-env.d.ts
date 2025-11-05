/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_WORKSPACE_ID: string;
  readonly VITE_META_APP_ID?: string;
  readonly VITE_META_APP_SECRET?: string;
  readonly VITE_META_ACCESS_TOKEN?: string;
  readonly VITE_META_AD_ACCOUNT_ID?: string;
  readonly VITE_GTM_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
