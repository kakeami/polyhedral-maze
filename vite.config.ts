import { defineConfig } from 'vite';

export default defineConfig({
  base: '/polyhedral-maze/',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
