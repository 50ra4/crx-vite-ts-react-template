import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';

import manifest from './manifest.config';

// https://vitejs.dev/config/
export default defineConfig(({ command, ...config }) => ({
  ...config,
  build: {
    outDir: command === 'build' ? 'extension' : 'dist',
    rollupOptions: {
      input: {
        ...(command === 'serve'
          ? {
              // output file at '/index.html'
              'dev-server': resolve(__dirname, 'index.html'),
            }
          : {}),
        popup: resolve(__dirname, 'popup.html'),
        devTools: resolve(__dirname, 'devTools.html'),
        options: resolve(__dirname, 'options.html'),
      },
    },
  },
  plugins: [crx({ manifest })],
}));
