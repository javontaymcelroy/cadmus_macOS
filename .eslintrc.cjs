module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: 'detect' } },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['out', 'dist', 'node_modules', '*.cjs'],
  rules: {
    // tsc already reports unused variables (noUnusedLocals / noUnusedParameters).
    '@typescript-eslint/no-unused-vars': 'off',
    // TypeScript checks prop types.
    'react/prop-types': 'off',
    // React escapes JSX text; apostrophes and quotes in copy are fine.
    'react/no-unescaped-entities': 'off',
    // Allow `while (true)` read/retry loops.
    'no-constant-condition': ['error', { checkLoops: false }],
    // Only ask for const when every destructured binding could be const.
    'prefer-const': ['error', { destructuring: 'all' }],
    // Existing code uses `any` widely; flag it without failing the build.
    '@typescript-eslint/no-explicit-any': 'warn',
  },
}
