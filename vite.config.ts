import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const defineMap: Record<string, string> = {};
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = env[k];
      if (v !== undefined) return v;
    }
    return undefined;
  };
  const setDef = (key: string, val: string | undefined) => {
    if (val !== undefined) defineMap[key] = JSON.stringify(val);
  };
  setDef('import.meta.env.VITE_SUPABASE_URL', pick('VITE_SUPABASE_URL', 'SUPABASE_URL'));
  setDef('import.meta.env.VITE_SUPABASE_ANON_KEY', pick('VITE_SUPABASE_ANON_KEY'));
  setDef('import.meta.env.VITE_WORKSPACE_ID', pick('VITE_WORKSPACE_ID', 'WORKSPACE_ID'));
  setDef('import.meta.env.VITE_GTM_ID', pick('VITE_GTM_ID', 'GTM_ID'));
  setDef('import.meta.env.VITE_API_URL', pick('VITE_API_URL', 'API_URL'));
  setDef('import.meta.env.VITE_DISABLE_AUTH', pick('VITE_DISABLE_AUTH'));

  const devProxyTarget = pick('API_URL') || 'http://localhost:3001';
  return ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [".ngrok-free.dev", ".trycloudflare.com"],
    proxy: {
      '/api': {
        target: devProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: defineMap,
  });
});
