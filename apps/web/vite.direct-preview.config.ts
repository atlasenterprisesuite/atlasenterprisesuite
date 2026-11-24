import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: resolve(process.cwd(), 'apps/web'),
  plugins: [react()],
  build: {
    outDir: resolve(process.cwd(), 'dist-direct-preview'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(process.cwd(), 'apps/web/direct-preview.html') },
  },
});
