import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    '.next/**',
    '.vite/**',
    '.wrangler/**',
    'dist/**',
    'node_modules/**',
    'playwright-report/**',
    'work/**',
  ]),
]);
