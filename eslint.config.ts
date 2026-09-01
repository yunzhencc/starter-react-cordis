import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: ['.superpowers/**', 'docs/**'],
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
)
