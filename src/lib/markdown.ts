import { createMarkdownProcessor } from '@astrojs/markdown-remark';
// @ts-ignore: plain JavaScript file without type declarations
import remarkEmbeds from '../plugins/remark-embeds.mjs';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;

// Turns Markdown text from a layout block into HTML, with the same embed rules as the rest of the site.
export async function renderMarkdown(text: string): Promise<string> {
  processor ??= createMarkdownProcessor({ remarkPlugins: [[remarkEmbeds, { base }]] });
  const result = await (await processor).render(text);
  return result.code;
}
