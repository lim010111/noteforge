import { defineConfig } from 'vitest/config';

// Two projects:
//   1. The default project (everything except theme-default) runs with a
//      plain Vitest setup — fast, plugin-free.
//   2. `theme-default` needs Astro's Vite pipeline so tests can import
//      `*.astro` via experimental_AstroContainer; its config wraps Astro's
//      `getViteConfig` to inject the .astro compiler.
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'default',
          include: ['packages/**/*.{test,spec}.ts', 'apps/**/*.{test,spec}.ts'],
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.astro/**',
            'packages/theme-default/**',
          ],
          globals: false,
          environment: 'node',
        },
      },
      './packages/theme-default/vitest.config.mts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/**/src/**'],
    },
  },
});
