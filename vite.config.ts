import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/polyhedral-maze/',
  build: {
    rollupOptions: {
      // Three pages, one deployment: the solids at the root, the kinetic maze
      // at /kinetic/, and the folding one at /fold/. They share `core/` and
      // most of `render/`, so another entry costs a page, not another app.
      input: {
        main: resolve(__dirname, 'index.html'),
        kinetic: resolve(__dirname, 'kinetic/index.html'),
        fold: resolve(__dirname, 'fold/index.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
