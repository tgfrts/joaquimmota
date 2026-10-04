import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://joaquimmota.pt',
  trailingSlash: 'never',
  build: { format: 'file' },
});
