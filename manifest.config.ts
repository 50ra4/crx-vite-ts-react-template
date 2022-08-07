import { defineManifest } from '@crxjs/vite-plugin';
import { name, version, author } from './package.json';

const EXTENSION_NAMES = {
  build: name,
  serve: `[DEV] ${name}`,
} as const;

const createIconFileSuffix = (command: 'build' | 'serve') =>
  command === 'serve' ? '-dev' : '';

// import to `vite.config.ts`
export default defineManifest(({ command, mode, ...manifest }) => ({
  ...manifest,
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
  devtools_page: 'devTools.html',
  author,
  permissions: ['background'],
  content_scripts: [
    {
      matches: ['https://example.com/*'],
      js: ['src/content_scripts/sample.tsx'],
    },
  ],
  background: {
    service_worker: 'src/background.ts',
  },
}));
