import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/polyhedral-maze/',
  build: {
    rollupOptions: {
      // Three pages, one deployment: the solids at the root, the turning maze
      // at /turning/, and the folding one at /fold/. They share `core/` and
      // most of `render/`, so another entry costs a page, not another app.
      //
      // `/kinetic/` is the fourth entry and not a fourth page: it is where the
      // turning maze used to live, and it is still built so that links to it
      // land somewhere. It carries the query string across.
      input: {
        main: resolve(__dirname, 'index.html'),
        turning: resolve(__dirname, 'turning/index.html'),
        kinetic: resolve(__dirname, 'kinetic/index.html'),
        fold: resolve(__dirname, 'fold/index.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
