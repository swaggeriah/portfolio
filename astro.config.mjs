import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkEmbeds from './src/plugins/remark-embeds.mjs';

// 1. Your GitHub Pages address.
const SITE = 'https://swaggeriah.github.io';
const BASE = '/portfolio';

export default defineConfig({
  site: SITE,
  base: BASE || undefined,
  markdown: {
    processor: unified({
      remarkPlugins: [[remarkEmbeds, { base: BASE }]],
    }),
  },
});