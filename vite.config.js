import { defineConfig } from 'vite';

// Project-site base path: site is hosted at /solar-system-web/
export default defineConfig({
  base: '/solar-system-web/',
  build: {
    target: 'es2020',
  },
});
