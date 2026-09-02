import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { cordisWebBoot } from '../agent/vite-plugin.ts';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [
      cordisWebBoot({
        configPath: resolve(import.meta.dirname, 'cordis.yml'),
        virtualModuleId: 'virtual:cordis-eagle-boot',
      }),
      react(),
    ],
  },
});
