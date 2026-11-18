import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'atlas-bundle-provenance',
      generateBundle(_options, bundle) {
        // Opt-in source-module inventory on actual Rollup production chunks.
        if (process.env.ATLAS_BUNDLE_AUDIT !== '1') return;
        const moduleIds = Object.values(bundle).flatMap((item) =>
          item.type === 'chunk' ? Object.keys(item.modules) : []
        );
        const affected = moduleIds.filter((id) =>
          /(?:^|[\\/])node_modules[\\/]picomatch(?:[\\/]|$)/.test(id)
        );
        console.log(`[atlas-bundle-audit] Source module references: ${moduleIds.length}; picomatch: ${affected.length}`);
        if (affected.length) {
          this.error('P0: picomatch is included in generated production chunks');
        }
      }
    }
  ],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react')) return 'react-vendor';
          return undefined;
        }
      }
    }
  }
});
