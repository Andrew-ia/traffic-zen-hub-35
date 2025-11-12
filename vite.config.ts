import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Critical: React must be in a single vendor chunk to avoid duplication
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }

          // Vendor chunks for large libraries
          if (id.includes('node_modules/recharts')) return 'recharts';
          if (id.includes('node_modules/@dnd-kit')) return 'dnd-kit';
          if (id.includes('node_modules/googleapis')) return 'googleapis';
          if (id.includes('node_modules/@google/generative-ai')) return 'generative-ai';
          if (id.includes('node_modules/openai')) return 'openai';
          if (id.includes('node_modules/@anthropic-ai')) return 'anthropic-ai';
          if (id.includes('node_modules/google-ads-api')) return 'google-ads';

          // Radix UI components
          if (id.includes('node_modules/@radix-ui')) return 'radix-ui';

          // Page-specific chunks
          if (id.includes('src/pages/MetaAds')) return 'pages-meta';
          if (id.includes('src/pages/Instagram')) return 'pages-instagram';
          if (id.includes('src/pages/ProjectManagement')) return 'pages-pm';
          if (id.includes('src/pages/AIChat')) return 'pages-ai';
          if (id.includes('src/pages/Cashflow')) return 'pages-cashflow';
          if (id.includes('src/pages/GA4')) return 'pages-ga4';

          // AI components chunk
          if (id.includes('src/components/ai/')) return 'components-ai';
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
