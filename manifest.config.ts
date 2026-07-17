import { defineManifest } from '@crxjs/vite-plugin';
import { name, version } from './package.json';

const EXTENSION_NAMES = {
  build: name,
  serve: `[DEV] ${name}`,
} as const;

const createIconFileSuffix = (command: 'build' | 'serve') =>
  command === 'serve' ? '-dev' : '';

// import to `vite.config.ts`
export default defineManifest(({ command }) => ({
  version,
  manifest_version: 3,
  name: EXTENSION_NAMES[command],
  description: '',
  icons: {
    '16': `public/logo/icon16${createIconFileSuffix(command)}.png`,
    '48': `public/logo/icon48${createIconFileSuffix(command)}.png`,
    '128': `public/logo/icon128${createIconFileSuffix(command)}.png`,
  },
  action: {
    default_popup: 'popup.html',
  },
  options_ui: {
    page: 'options.html',
  },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';",
  },
  // Declare only permissions for Chrome APIs that the extension actually uses.
  // Keep the allowlists in scripts/verify-manifest.mjs in sync when adding one.
  permissions: [],
  content_scripts: [
    {
      matches: ['https://example.com/*'],
      js: ['src/entrypoints/content/sample.tsx'],
    },
  ],
  background: {
    service_worker: 'src/entrypoints/background/background.ts',
  },
}));
