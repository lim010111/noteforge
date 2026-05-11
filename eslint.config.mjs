import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.astro/**', '**/node_modules/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  // Cross-package seam discipline: outside `packages/core` itself, all imports
  // of `@noteforge/core` must go through the package root. Subpath imports
  // (`@noteforge/core/pipeline`, `@noteforge/core/privacy/...`, etc.) bypass
  // the public interface and let architectural deepening regress silently.
  // `.astro` files are not parsed by ESLint here, so the rule covers .ts/.mjs
  // — Astro files import logic indirectly via co-located .types.ts modules,
  // which are caught by this rule.
  {
    files: ['**/*.{ts,tsx,mts,mjs}'],
    ignores: ['packages/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@noteforge/core/*'],
              message:
                'Import from `@noteforge/core` directly — subpath imports bypass the package seam. If a symbol you need is missing, add it to packages/core/src/index.ts.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
