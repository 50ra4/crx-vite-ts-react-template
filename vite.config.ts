import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // output file at '/index.html'
        welcome: resolve(__dirname, 'index.html'),
      },
    },
  },
  plugins: [react()],
});
