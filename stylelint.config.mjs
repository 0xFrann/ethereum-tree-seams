const config = {
  extends: ['stylelint-config-standard'],
  ignoreFiles: [
    '.next/**',
    '.vite/**',
    '.wrangler/**',
    'dist/**',
    'node_modules/**',
    'work/**',
  ],
  rules: {
    'custom-property-empty-line-before': null,
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
    'value-keyword-case': null,
  },
};

export default config;
