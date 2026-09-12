import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/polyhedral-maze/',
  build: {
    rollupOptions: {
      // Two pages, one deployment: the solids at the root and the moving maze
      // at /kinetic/. They share `core/` and most of `render/`, so a second
      // entry costs a page, not a second app.
      input: {
        main: resolve(__dirname, 'index.html'),
        kinetic: resolve(__dirname, 'kinetic/index.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
