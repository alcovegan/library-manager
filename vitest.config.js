const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.js'],
    globals: true,
    reporters: 'default',
    clearMocks: true,
  },
});
