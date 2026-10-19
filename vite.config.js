import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000,
  },
  server: {
    port: 3000,
    open: true
  }
});
