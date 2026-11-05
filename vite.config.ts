import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { sourcemap: false, target: 'es2022', modulePreload: { polyfill: false } },
  server: { host: '127.0.0.1', hmr: false },
  preview: { host: '127.0.0.1' },
});
