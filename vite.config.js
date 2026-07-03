import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the built site works when served from a GitHub Pages
  // project subpath (https://user.github.io/<repo>/) as well as at the root.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
