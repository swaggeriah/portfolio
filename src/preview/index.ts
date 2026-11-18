// The live preview in the /admin editor. It draws entries and projects with the same code
// (src/lib/render.ts) and the same stylesheet as the real website.
//
// This file is turned into public/admin/preview.js. After changing anything under src/lib,
// src/plugins or src/preview, rebuild it with:
//   npx esbuild src/preview/index.ts --bundle --minify --format=iife --alias:astro/zod=zod/v4 --outfile=public/admin/preview.js
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkSmartypants from 'remark-smartypants';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
// @ts-ignore: plain JavaScript file without type declarations
import remarkEmbeds from '../plugins/remark-embeds.mjs';
import { blocksSchema, pageSchema } from '../lib/blocks';
import { renderBlocks, pageStyles, styleString } from '../lib/render';
import { site } from '../site.config';

declare const CMS: any;

const esc = (text: unknown = '') =>
  String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const formatDate = (value: unknown) => {
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf())
    ? ''
    : date.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
};

// Same steps as the website's Markdown, plus the embed plugin for links on their own line.
function markdownToHtml(markdown: string, resolve: (path: string) => string): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkSmartypants)
      .use(remarkEmbeds, { resolve })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

// Whatever the editor knows about a referenced project or category (title, colours, ...).
function related(fieldsMetaData: any, field: string, collection: string, id: string): Record<string, any> {
  const found = fieldsMetaData?.getIn?.([field, collection, id]);
  return (found && (found.toJS ? found.toJS() : found)) || {};
}

const taskbar = `<header class="taskbar"><div class="taskbar-inner"><a class="btn start">${esc(site.name)}</a><nav><a class="btn">Projects</a><a class="btn">Key points</a><a class="btn">Contact</a></nav></div></header>`;
const statusbar = `<footer class="statusbar"><div class="statusbar-inner"><span class="cell">© ${new Date().getFullYear()} ${esc(site.name)}</span></div></footer>`;

const problems = (issues: Array<{ path: PropertyKey[]; message: string }>) =>
  `<div style="margin:16px;padding:12px;background:#fff0f0;border:2px solid #b00020;color:#600;font:14px sans-serif">` +
  `<strong>The preview can't draw this yet:</strong><ul>` +
  issues.slice(0, 5).map((issue) => `<li>${esc(issue.path.join(' › '))}: ${esc(issue.message)}</li>`).join('') +
  `</ul></div>`;

interface PageHtml {
  bodyStyle: string | undefined;
  html: string;
}

function drawPage(kind: 'entry' | 'project', props: any): PageHtml {
  const { entry, getAsset, fieldsMetaData } = props;
  const data = entry.get('data').toJS();

  // Files uploaded in the editor but not saved yet only exist as temporary addresses; getAsset finds them.
  const resolve = (path: string): string => {
    if (!path || /^(https?:)?\/\//.test(path) || path.startsWith('blob:')) return path;
    return getAsset(path)?.url ?? path;
  };

  const blocks = blocksSchema.safeParse(data.blocks ?? []);
  const page = pageSchema.safeParse(data.page ?? undefined);
  if (!blocks.success) return { bodyStyle: undefined, html: problems(blocks.error.issues) };
  if (!page.success) return { bodyStyle: undefined, html: problems(page.error.issues) };

  const textHtml = blocks.data.map((block) => (block.type === 'content' && block.text ? markdownToHtml(block.text, resolve) : ''));
  const blocksHtml = renderBlocks(blocks.data, { resolve, textHtml });
  const bodyHtml = data.body && String(data.body).trim() ? markdownToHtml(String(data.body), resolve) : '';
  const styles = pageStyles(page.data, kind === 'entry' ? '840px' : '920px', resolve);

  const project = related(fieldsMetaData, 'project', 'projects', data.project);
  const top = data.gradientTop || project.gradientTop;
  const bottom = data.gradientBottom || project.gradientBottom;
  const colours = styleString({ '--grad-top': top, '--grad-bottom': bottom });
  const colourAttr = colours ? ` style="${esc(colours)}"` : '';

  if (kind === 'project') {
    // The thumbnail is stored relative to the project file; show it only if the editor can find the file.
    const thumb = data.thumbnail ? (getAsset(data.thumbnail)?.url ?? '') : '';
    const html =
      taskbar +
      `<main style="${esc(styles.main)}"><nav class="crumbs"><a class="btn">← Home</a></nav>` +
      `<section class="window"${colourAttr}><h1 class="title-bar">${esc(data.title)}</h1><div class="window-body">` +
      `<div class="project-header">${thumb ? `<img class="logo" src="${esc(thumb)}" alt="" width="400">` : ''}` +
      `<p class="meta">${esc(formatDate(data.date))}</p>${bodyHtml ? `<div class="prose panel">${bodyHtml}</div>` : ''}</div>` +
      `${blocksHtml}</div></section></main>` +
      statusbar;
    return { bodyStyle: styles.body, html };
  }

  const ids: string[] = Array.isArray(data.categories) && data.categories.length ? data.categories : data.category ? [data.category] : [];
  const categories = (ids.length ? ids : ['Other']).map((id) => related(fieldsMetaData, 'categories', 'categories', id).title || id);
  const keyPoints: string[] = Array.isArray(data.keyPoints) ? data.keyPoints.filter(Boolean) : [];
  const html =
    taskbar +
    `<main style="${esc(styles.main)}"><nav class="crumbs"><a class="btn">Home</a><a class="btn">${esc(project.title || data.project || 'Project')}</a>` +
    categories.map((name) => `<span class="cell">${esc(name)}</span>`).join('') +
    `</nav><section class="window"${colourAttr}><h1 class="title-bar">${esc(data.title)}</h1><div class="window-body">` +
    `<p class="meta">${esc(formatDate(data.date))} · ${esc(categories.join(', '))}</p>` +
    (bodyHtml ? `<article class="prose panel">${bodyHtml}</article>` : '') +
    blocksHtml +
    (keyPoints.length ? `<ul class="tags">${keyPoints.map((point) => `<li>${esc(point)}</li>`).join('')}</ul>` : '') +
    `</div></section></main>` +
    statusbar;
  return { bodyStyle: styles.body, html };
}

const React = CMS.React;

function makePreview(kind: 'entry' | 'project') {
  return function Preview(props: any) {
    let drawn: PageHtml;
    try {
      drawn = drawPage(kind, props);
    } catch (error) {
      drawn = { bodyStyle: undefined, html: problems([{ path: [], message: String((error as Error).message || error) }]) };
    }
    // The website puts the desktop colour and picture on <body>; do the same inside the preview frame.
    React.useEffect(() => {
      const body = props.document?.body;
      if (!body) return;
      if (drawn.bodyStyle) body.setAttribute('style', drawn.bodyStyle);
      else body.removeAttribute('style');
    });
    return React.createElement('div', {
      dangerouslySetInnerHTML: { __html: drawn.html },
      // Links and buttons in the preview should not navigate the preview frame away.
      onClick: (event: any) => {
        if (event.target?.closest?.('a')) event.preventDefault();
      },
    });
  };
}

// The stylesheet is generated from the website's own CSS (see src/pages/admin/preview.css.ts).
CMS.registerPreviewStyle(new URL('preview.css', window.location.href).href);
CMS.registerPreviewTemplate('entries', makePreview('entry'));
CMS.registerPreviewTemplate('projects', makePreview('project'));
