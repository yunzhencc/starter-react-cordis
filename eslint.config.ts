import antfu from '@antfu/eslint-config';

export default antfu(
  {
    ignores: ['.superpowers/**', 'docs/**'],
    stylistic: {
      semi: true,
      indent: 2,
      quotes: 'single',
    },
    react: true,
  },
  {
    files: ['apps/web/index.test.ts'],
    rules: {
      'no-eval': 'off',
    },
  },
  {
    files: ['packages/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['pnpm-workspace.yaml'],
    rules: {
      'pnpm/yaml-enforce-settings': 'off',
    },
  },
);
