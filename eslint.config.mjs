import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**', '**/.next/**', '**/node_modules/**', '**/generated/**', '.dev/**', 'test-results/**',
      'playwright-report/**', 'apps/web/next-env.d.ts', 'apps/web/src/app/tokens.css',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts}'],
    rules: {
      // Prisma JSON columns and third-party payloads are typed at the validation boundary.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.mjs', 'apps/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', setTimeout: 'readonly', setInterval: 'readonly', Buffer: 'readonly', URL: 'readonly', fetch: 'readonly', document: 'readonly', window: 'readonly' },
    },
  },
);
