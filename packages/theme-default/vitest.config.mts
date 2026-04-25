/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';

// Astro's `getViteConfig` wires the .astro compiler into Vite so theme tests
// can import `*.astro` files directly via experimental_AstroContainer.
//
// We point Astro's `root` at this package and disable `configFile` lookup —
// there is no astro.config here (the dogfood blog has its own at apps/blog/),
// and bare-root operation is acceptable for tests that never render a route.
export default getViteConfig(
  {
    test: {
      name: 'theme-default',
      include: ['tests/**/*.{test,spec}.ts'],
      globals: false,
      environment: 'node',
      passWithNoTests: true,
      pool: 'threads',
    },
  } as Parameters<typeof getViteConfig>[0],
  {
    root: fileURLToPath(new URL('.', import.meta.url)),
    configFile: false,
    logLevel: 'error',
  },
);
