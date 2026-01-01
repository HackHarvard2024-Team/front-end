import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginCypress from 'eslint-plugin-cypress/flat'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

const nodeGlobals = {
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  fetch: 'readonly',
  Headers: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
}

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs,jsx,vue}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  
  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },
  
  {
    ...pluginCypress.configs.recommended,
    files: [
      'cypress/e2e/**/*.{cy,spec}.{js,ts,jsx,tsx}',
      'cypress/support/**/*.{js,ts,jsx,tsx}' // use single quotes as in the other configs
    ],
  },
  {
    name: 'app/netlify-functions',
    files: ['netlify/functions/**/*.js'],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  skipFormatting,
]
