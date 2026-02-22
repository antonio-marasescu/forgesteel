import { defineConfig } from 'eslint/config';

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig({
  ignores: ['build', 'dist', 'node_modules', '.opencode', '.idea', '.github'],
  extends: [js.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  plugins: {
    'react-hooks': reactHooks,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    // Errors
    // Warnings
    'no-console': [
      'warn',
      {
        allow: ['warn', 'error'],
      },
    ],
    'no-debugger': 'warn',
    'no-warning-comments': [
      'warn',
      {
        terms: ['todo', 'hack', 'fix', 'fixme', 'xxx'],
      },
    ],
    'sort-imports': [
      'warn',
      {
        allowSeparatedGroups: true,
        memberSyntaxSortOrder: ['all', 'multiple', 'single', 'none'],
      },
    ],
    // Off
    'react-hooks/set-state-in-effect': ['off'],
  },
});
