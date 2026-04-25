import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  noExternal: [
    '@obpub/core',
    'gray-matter',
    'hast-util-to-html',
    'mdast-util-from-markdown',
    'mdast-util-to-hast',
    'micromatch',
    'picomatch',
    'zod',
  ],
  banner: {
    js: "import { createRequire as __obpubCreateRequire } from 'node:module'; const require = __obpubCreateRequire(import.meta.url);",
  },
});
