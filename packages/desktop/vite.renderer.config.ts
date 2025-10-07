import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  esbuild: {
    loader: 'tsx',
    include: /src\/.*\.[tj]sx?$/,
  },
});
