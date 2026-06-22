import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'android', 'capacitor.config.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // These eslint-plugin-react-hooks@7 / react-refresh rules are enforced as
      // errors. The codebase follows the patterns they require: data-loading
      // effects use a local async function (or a reload counter) instead of a
      // synchronous setState, time values are captured in state/lazy
      // initializers rather than read with Date.now() during render, and
      // context files export only hooks/context (providers live in *-provider
      // files) so fast-refresh stays intact.
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/purity': 'error',
      'react-refresh/only-export-components': 'error',
    },
  },
])
