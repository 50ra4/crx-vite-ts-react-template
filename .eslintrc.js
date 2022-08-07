module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      node: {
        extensions: ['.ts', '.tsx'],
        paths: ['./src'],
      },
    },
  },
  plugins: ['react', '@typescript-eslint'],
  ignorePatterns: ['.eslintrc.js', '*.config.ts'],
  rules: {
    'import/no-unresolved': 'off',
    'sort-imports': 'off',
    'import/order': ['error', { alphabetize: { order: 'asc' } }],
  },
};
