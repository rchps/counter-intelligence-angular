// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const pluginCypress = require('eslint-plugin-cypress');

module.exports = defineConfig([
  {
    files: ['**/*.ts', '**/*.mts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    // Cypress's own lint rules for its best-practices guide (on.cypress.io/best-practices). Selectors
    // must use data-* attributes, as an error rather than the plugin's suggested warning: every element
    // the specs touch has a data-cy hook, so a class or tag selector is a mistake, not a necessity.
    files: ['cypress/**/*.ts'],
    extends: [pluginCypress.configs.recommended],
    rules: {
      'cypress/require-data-selectors': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
