import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { cordisWebBoot } from './vite-plugin.ts';

export default defineConfig({
  plugins: [cordisWebBoot(), react()],
});
