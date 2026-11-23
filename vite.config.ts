import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/polyhedral-maze/',
  build: {
    rollupOptions: {
      // Four pages, one deployment: the solids at the root, the turning maze
      // at /turning/, the folding one at /fold/, and the interchange maze —
      // the folding ring played across its shapes — at /interchange/. They
      // share `core/` and most of `render/`, so another entry costs a page,
      // not another app.
      //
      // `/kinetic/` is an entry and not a page: it is where the
      // turning maze used to live, and it is still built so that links to it
      // land somewhere. It carries the query string across.
      input: {
        main: resolve(__dirname, 'index.html'),
        turning: resolve(__dirname, 'turning/index.html'),
        kinetic: resolve(__dirname, 'kinetic/index.html'),
        fold: resolve(__dirname, 'fold/index.html'),
        interchange: resolve(__dirname, 'interchange/index.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
