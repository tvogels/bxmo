import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tvogels.github.io',
  base: '/',
  output: 'static',
  build: {
    format: 'directory',
  },
  vite: {
    ssr: {
      noExternal: ['js-yaml'],
    },
  },
});
