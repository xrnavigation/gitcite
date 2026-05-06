import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.mjs', 'tests/component/**/*.test.mjs'],
    globals: false,
  },
});
