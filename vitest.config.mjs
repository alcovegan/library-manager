import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.{js,ts}'],
    environment: 'node',
    globals: true,
    setupFiles: ['tests/setup/global.mjs'],
    reporters: 'default',
    clearMocks: true,
  },
});
