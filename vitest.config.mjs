import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.{js,ts}'],
    environment: 'node',
    globals: true,
    reporters: 'default',
    clearMocks: true,
  },
});
