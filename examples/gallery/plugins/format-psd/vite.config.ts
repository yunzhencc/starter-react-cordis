import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        'thumbnail/psd.worker': resolve(import.meta.dirname, 'src/thumbnail.worker.ts'),
        'viewer/psd': resolve(import.meta.dirname, 'src/viewer.html'),
      },
      output: { entryFileNames: '[name].js' },
    },
  },
});
