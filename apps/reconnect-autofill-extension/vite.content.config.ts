import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  publicDir: false,
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(root, 'src/content.ts'),
      name: 'AtlasReconnectContent',
      formats: ['iife'],
      fileName: () => 'content.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
