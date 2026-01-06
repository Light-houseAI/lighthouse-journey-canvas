import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' })],
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          config: path.resolve(__dirname, './tailwind.config.cjs'),
        }),
        autoprefixer(),
      ],
    },
  },
  build: {
    outDir: '../../dist/ui',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:5004',
        changeOrigin: true,
      },
    },
  },
});
