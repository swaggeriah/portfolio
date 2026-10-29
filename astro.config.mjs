import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkEmbeds from './src/plugins/remark-embeds.mjs';

// 1. Your GitHub Pages address.
const SITE = 'https://YOUR-USERNAME.github.io';

// 2. Leave BASE empty if your repository is named YOUR-USERNAME.github.io.
//    Otherwise set it to '/your-repository-name' (leading slash, no trailing slash).
const BASE = '';

export default defineConfig({
  site: SITE,
  base: BASE || undefined,
  markdown: {
    processor: unified({
      remarkPlugins: [[remarkEmbeds, { base: BASE }]],
    }),
  },
});