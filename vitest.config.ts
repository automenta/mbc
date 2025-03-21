import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['{src,lib}/**/*.{test,spec}.ts'], // Adjust if necessary
    exclude: ['lib/net/test/Executor.test.cjs'], // Exclude CJS test initially
  },
});
