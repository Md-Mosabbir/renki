// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // Nothing here should ever be linted.
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },

  eslint.configs.recommended,

  // Type-aware linting: these rules use the TypeScript compiler, so they can
  // catch things like floating promises that plain syntax rules cannot.
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow `_unused` parameters — common for Express middleware signatures
      // like (err, req, res, next) where you must accept an argument you ignore.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // Config files at the root are plain JS and are not part of tsconfig.
  {
    files: ['**/*.mjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Must stay last: turns off any rule that fights Prettier.
  prettier
);
