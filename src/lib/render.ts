// Draws layout blocks as HTML text. It has no Astro-specific code, so the very same function is
// used when the website is built AND by the live preview in the /admin editor.
// If you change how blocks look, change it here (and in global.css) and both stay identical.
import type { Block, BoxStyle, Decoration, MediaItem, PageSettings } from './blocks';
// @ts-ignore: plain JavaScript file without type declarations
import { mediaFor } from '../plugins/remark-embeds.mjs';

export interface RenderContext {
  // Turns a file path such as /media/photo.png into an address that works where the page is shown.
  resolve: (path: string) => string;
  // The block texts already converted from Markdown to HTML, one entry per block ('' if none).
  textHtml: string[];
}

type CssValues = Record<string, string | number | undefined | null | false>;

const esc = (text: unknown = '') =>
  String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cls = (...parts: Array<string | false | undefined | null>) => parts.filter(Boolean).join(' ');
const attr = (name: string, value: string | undefined) => (value === undefined ? '' : ` ${name}="${esc(value)}"`);

// { '--a': 1, color: 'red', hidden: undefined } -> "--a:1;color:red"
export function styleString(values: CssValues): string | undefined {
  const parts = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== '')
    .map(([key, value]) => `${key}:${value}`);
  return parts.length ? parts.join(';') : undefined;
}

// Safe to drop into url(...): spaces, quotes and brackets are percent-encoded.
export const cssUrl = (path: string, resolve: (path: string) => string) =>
  `url(${resolve(path).replace(/["'()\\\s]/g, (char) => encodeURIComponent(char))})`;

// ---------- Backdrops ----------

const PADDING: Record<string, string> = { none: '0', small: '8px', medium: '16px', large: '28px', xl: '44px' };
// "auto": no padding without a backdrop, comfortable padding with one.
const autoPadding = (backdrop: string) =>
  backdrop === 'none' ? '0' : backdrop === 'window' ? '12px' : '14px 16px';

const IMAGE_LAYOUT: Record<string, { size: string; repeat: string; position: string }> = {
  tile: { size: 'auto', repeat: 'repeat', position: '0 0' },
  cover: { size: 'cover', repeat: 'no-repeat', position: 'center' },
  contain: { size: 'contain', repeat: 'no-repeat', position: 'center' },
  center: { size: 'auto', repeat: 'no-repeat', position: 'center' },
};

// CSS variables that global.css reads to paint a backdrop.
function boxVars(box: BoxStyle, resolve: RenderContext['resolve']): CssValues {
  const mode = IMAGE_LAYOUT[box.imageMode] ?? IMAGE_LAYOUT.tile;
  return {
    '--bd-color': box.color,
    '--bd-opacity': box.opacity < 100 ? box.opacity / 100 : undefined,
    '--bd-image': box.image ? cssUrl(box.image, resolve) : undefined,
    '--bd-size': box.image ? mode.size : undefined,
    '--bd-repeat': box.image ? mode.repeat : undefined,
    '--bd-position': box.image ? mode.position : undefined,
    '--pad': box.padding === 'auto' ? autoPadding(box.backdrop) : PADDING[box.padding],
  };
}

function box(style: BoxStyle, className: string, extra: CssValues, inner: string, ctx: RenderContext) {
  const css = styleString({ ...boxVars(style, ctx.resolve), ...extra });
  const titleBar = style.backdrop === 'window' ? `<div class="title-bar">${esc(style.title)}</div>` : '';
  return `<div class="${cls('box', `bd-${style.backdrop}`, className)}"${attr('style', css)}>${titleBar}<div class="box-inner">${inner}</div></div>`;
}

// ---------- Decorations ----------

const ANCHOR_POINT: Record<string, [number, number]> = {
  'top-left': [0, 0], top: [50, 0], 'top-right': [100, 0],
  left: [0, 50], center: [50, 50], right: [100, 50],
  'bottom-left': [0, 100], bottom: [50, 100], 'bottom-right': [100, 100],
};

// The picture's anchor point sits on the same point of the block; x and y then nudge it
// (x to the right, y downwards). Rotation happens around the picture's centre.
function decorationStyle(deco: Decoration) {
  const [px, py] = ANCHOR_POINT[deco.anchor] ?? [0, 0];
  return styleString({
    left: `${px}%`,
    top: `${py}%`,
    translate: `calc(${-px}% + ${deco.x}px) calc(${-py}% + ${deco.y}px)`,
    rotate: deco.rotate ? `${deco.rotate}deg` : undefined,
    scale: deco.flip ? '-1 1' : undefined,
    opacity: deco.opacity < 100 ? deco.opacity / 100 : undefined,
    '--w': `${deco.width}px`,
  });
}

function decorations(items: Decoration[], layer: Decoration['layer'], ctx: RenderContext) {
  return items
    .filter((deco) => deco.image && deco.layer === layer)
    .map(
      (deco) =>
        `<img class="deco deco-${layer}" src="${esc(ctx.resolve(deco.image!))}" alt="" aria-hidden="true" loading="lazy"${attr('style', decorationStyle(deco))}>`,
    )
    .join('');
}

// ---------- Media ----------

function mediaItem(item: MediaItem, fill: boolean, ctx: RenderContext) {
  if (!item.src) return '';
  const media = mediaFor(item.src, item.alt ?? item.caption ?? '', '', ctx.resolve) as { kind: string; html: string } | null;
  const css = fill ? undefined : styleString({ '--w': `${item.size}%` });
  const classes = cls('media', `frame-${item.frame}`, `align-${item.align}`, media?.kind && `kind-${media.kind}`, fill && 'fill');
  const inner = media
    ? media.html
    : `<a href="${esc(ctx.resolve(item.src))}">${esc(item.caption || item.src.split('/').pop())}</a>`;
  const caption = item.caption && media ? `<figcaption>${esc(item.caption)}</figcaption>` : '';
  return `<figure class="${classes}"${attr('style', css)}>${inner}${caption}</figure>`;
}

// ---------- Blocks ----------

const WIDTH = { full: '100%', wide: '86%', medium: '68%', narrow: '48%' };
const SELF = { left: 'flex-start', center: 'center', right: 'flex-end' };
const FONTS: Record<string, string | undefined> = {
  default: undefined,
  sans: 'Arial, Helvetica, sans-serif',
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
  cursive: "'Segoe Script', 'Brush Script MT', cursive",
};
const SIZES: Record<string, string | undefined> = { small: '0.875rem', normal: undefined, large: '1.25rem', huge: '1.8rem' };
const VALIGN = { top: 'flex-start', center: 'center', bottom: 'flex-end' };
const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };

// Only ordinary links are allowed on buttons. Site paths like /projects/x/ get the base path.
const safeHref = (href: string, ctx: RenderContext) =>
  /^(https?:|mailto:|tel:|#)/i.test(href) ? href : href.startsWith('/') ? ctx.resolve(href) : undefined;

type FramedBlock = Exclude<Block, { type: 'divider' }>;

function framed(block: FramedBlock, inner: string, ctx: RenderContext) {
  const s = block.style;
  const wrap = styleString({
    '--block-w': WIDTH[s.width],
    'align-self': SELF[s.align],
    'margin-top': s.spaceAbove ? `${s.spaceAbove}px` : undefined,
    'margin-bottom': s.spaceBelow ? `${s.spaceBelow}px` : undefined,
  });
  const middle = decorations(block.decorations, 'middle', ctx);
  return (
    `<section class="block block-${block.type}"${attr('style', wrap)}>` +
    decorations(block.decorations, 'behind', ctx) +
    box(s, 'block-box', {}, middle + inner, ctx) +
    decorations(block.decorations, 'front', ctx) +
    `</section>`
  );
}

function renderBlock(block: Block, textHtml: string, ctx: RenderContext): string {
  if (block.type === 'content') {
    const media = block.media.filter((item) => item.src);
    const hasText = Boolean(block.text?.trim());
    const stacked = block.mediaSide === 'above' || block.mediaSide === 'below';
    const t = block.textBox;
    const row = styleString({
      '--media-w': `${block.mediaWidth}%`,
      '--gap': `${block.gap}px`,
      '--valign': VALIGN[block.valign],
    });
    const text = hasText
      ? `<div class="text">${box(
          t,
          'text-box',
          { color: t.textColor, 'font-family': FONTS[t.font], 'font-size': SIZES[t.size], 'text-align': t.align },
          `<div class="rich">${textHtml}</div>`,
          ctx,
        )}</div>`
      : '';
    const side = media.length ? `<div class="media-col">${media.map((item) => mediaItem(item, false, ctx)).join('')}</div>` : '';
    const rowClass = cls('row', `side-${block.mediaSide}`, stacked && 'stacked', media.length === 0 && 'text-only', !hasText && 'media-only');
    return framed(block, `<div class="${rowClass}"${attr('style', row)}>${text}${side}</div>`, ctx);
  }

  if (block.type === 'gallery') {
    const images = block.images.filter((item) => item.src);
    const css = styleString({ '--cols': block.columns, '--gap': `${block.gap}px` });
    return framed(
      block,
      `<div class="${cls('gallery', block.columns > 2 && 'many')}"${attr('style', css)}>${images.map((item) => mediaItem(item, true, ctx)).join('')}</div>`,
      ctx,
    );
  }

  if (block.type === 'buttons') {
    const items = block.items.filter((item) => item.label && item.url && safeHref(item.url, ctx));
    const css = styleString({ 'justify-content': JUSTIFY[block.align] });
    const links = items
      .map(
        (item) =>
          `<a class="btn" href="${esc(safeHref(item.url!, ctx))}"${item.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(item.label)}</a>`,
      )
      .join('');
    return framed(block, `<div class="buttons"${attr('style', css)}>${links}</div>`, ctx);
  }

  if (block.type === 'spacer') {
    return framed(block, `<div class="spacer" style="height:${block.height}px"></div>`, ctx);
  }

  // divider
  const wrap = styleString({
    'margin-top': block.spaceAbove ? `${block.spaceAbove}px` : undefined,
    'margin-bottom': block.spaceBelow ? `${block.spaceBelow}px` : undefined,
  });
  const line =
    block.kind === 'stars'
      ? `<div class="divider divider-stars" aria-hidden="true"${attr('style', styleString({ color: block.color, width: `${block.width}%` }))}>✦ ✦ ✦</div>`
      : `<hr class="divider divider-${block.kind}"${attr('style', styleString({ '--c': block.color, '--t': `${block.thickness}px`, width: `${block.width}%` }))}>`;
  return `<div class="block block-divider"${attr('style', wrap)}>${line}</div>`;
}

export function renderBlocks(blocks: Block[], ctx: RenderContext): string {
  if (blocks.length === 0) return '';
  return `<div class="blocks">${blocks.map((block, i) => renderBlock(block, ctx.textHtml[i] ?? '', ctx)).join('')}</div>`;
}

// ---------- Page-wide settings: desktop colour and picture, window width ----------

const WIDTHS: Record<string, string> = { narrow: '700px', medium: '840px', wide: '1100px', full: '3000px' };

export function pageStyles(page: PageSettings | undefined, defaultWidth: string, resolve: RenderContext['resolve']) {
  const mode = page?.desktopImageMode ?? 'tile';
  const layout = IMAGE_LAYOUT[mode] ?? IMAGE_LAYOUT.tile;
  const hasPicture = Boolean(page?.desktopImage) && mode !== 'none';
  const body = styleString({
    '--desktop': page?.desktopColor,
    'background-image': hasPicture ? cssUrl(page!.desktopImage!, resolve) : mode === 'none' ? 'none' : undefined,
    'background-size': hasPicture ? layout.size : undefined,
    'background-repeat': hasPicture ? layout.repeat : undefined,
    'background-position': hasPicture ? layout.position : undefined,
  });
  const main = styleString({ '--page-width': WIDTHS[page?.windowWidth ?? ''] ?? defaultWidth });
  return { body, main };
}
