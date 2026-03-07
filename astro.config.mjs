import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bxmo.org',
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
