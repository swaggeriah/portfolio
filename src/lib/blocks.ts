import { z } from 'astro/zod';

// The editor saves empty boxes as "" (or leaves them out); treat both as "not set".
const clean = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema);

const text = clean(z.string().optional());
const pick = <const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  clean(z.enum(values).default(fallback));
const whole = (fallback: number, min: number, max: number) =>
  clean(z.coerce.number().min(min).max(max).default(fallback));

// Colours end up inside style attributes, so only plain colour syntax is accepted:
// #rrggbb, a colour name, or rgb(...) / hsl(...).
const COLOUR = /^(#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%/]+\))$/i;
const colour = clean(
  z
    .string()
    .trim()
    .regex(COLOUR, 'Use a colour like #ff8800, a colour name such as red, or rgb(255, 136, 0)')
    .optional(),
);

export const ANCHORS = [
  'top-left', 'top', 'top-right',
  'left', 'center', 'right',
  'bottom-left', 'bottom', 'bottom-right',
] as const;

// ---------- Backdrops (the box behind a block or behind its text) ----------

const boxFields = {
  backdrop: pick(['none', 'panel', 'raised', 'window', 'flat', 'outline', 'dashed'], 'none'),
  title: text, // title bar text, used by the "window" backdrop
  color: colour,
  opacity: whole(100, 0, 100),
  image: text,
  imageMode: pick(['tile', 'cover', 'contain', 'center'], 'tile'),
  padding: pick(['auto', 'none', 'small', 'medium', 'large', 'xl'], 'auto'),
};

const textFields = {
  textColor: colour,
  font: pick(['default', 'sans', 'serif', 'mono', 'cursive'], 'default'),
  size: pick(['small', 'normal', 'large', 'huge'], 'normal'),
  align: pick(['left', 'center', 'right'], 'left'),
};

const blockFields = {
  ...boxFields,
  width: pick(['full', 'wide', 'medium', 'narrow'], 'full'),
  align: pick(['left', 'center', 'right'], 'center'),
  spaceAbove: whole(0, -150, 300),
  spaceBelow: whole(0, -150, 300),
};

const blockStyle = z.object(blockFields).prefault({});
const textBoxStyle = z.object({ ...boxFields, ...textFields }).prefault({});

// ---------- Decorations (loose pictures placed on a block) ----------

const decoration = z.object({
  image: text,
  anchor: pick(ANCHORS, 'top-left'),
  x: whole(0, -1500, 1500),
  y: whole(0, -1500, 1500),
  width: whole(140, 8, 1600),
  rotate: whole(0, -180, 180),
  opacity: whole(100, 0, 100),
  flip: clean(z.coerce.boolean().default(false)),
  layer: pick(['behind', 'middle', 'front'], 'front'),
});

// ---------- Media (images, video, audio, embeds) ----------

const mediaItem = z.object({
  src: text,
  caption: text,
  alt: text,
  frame: pick(['none', 'raised', 'sunken', 'outline'], 'none'),
  size: whole(100, 10, 100),
  align: pick(['left', 'center', 'right'], 'center'),
});

const common = {
  style: blockStyle,
  decorations: z.array(decoration).default([]),
};

// ---------- The block types ----------

const contentBlock = z.object({
  type: z.literal('content'),
  text,
  media: z.array(mediaItem).default([]),
  mediaSide: pick(['right', 'left', 'above', 'below'], 'right'),
  mediaWidth: whole(45, 15, 85),
  valign: pick(['top', 'center', 'bottom'], 'top'),
  gap: whole(20, 0, 120),
  textBox: textBoxStyle,
  ...common,
});

const galleryBlock = z.object({
  type: z.literal('gallery'),
  images: z.array(mediaItem).default([]),
  columns: whole(3, 1, 6),
  gap: whole(12, 0, 60),
  ...common,
});

const dividerBlock = z.object({
  type: z.literal('divider'),
  kind: pick(['line', 'groove', 'dotted', 'dashed', 'stars'], 'groove'),
  color: colour,
  thickness: whole(2, 1, 12),
  width: whole(100, 10, 100),
  spaceAbove: whole(0, -150, 300),
  spaceBelow: whole(0, -150, 300),
});

const spacerBlock = z.object({
  type: z.literal('spacer'),
  height: whole(60, 0, 1000),
  ...common,
});

const buttonsBlock = z.object({
  type: z.literal('buttons'),
  items: z
    .array(z.object({ label: text, url: text, newTab: clean(z.coerce.boolean().default(false)) }))
    .default([]),
  align: pick(['left', 'center', 'right'], 'center'),
  ...common,
});

export const blockSchema = z.discriminatedUnion('type', [
  contentBlock,
  galleryBlock,
  dividerBlock,
  spacerBlock,
  buttonsBlock,
]);

export const blocksSchema = z.array(blockSchema).default([]);

// ---------- Page-wide settings (outside the blocks) ----------

export const pageSchema = z
  .object({
    desktopColor: colour,
    desktopImage: text,
    desktopImageMode: pick(['tile', 'cover', 'center', 'none'], 'tile'),
    windowWidth: clean(z.enum(['narrow', 'medium', 'wide', 'full']).optional()),
  })
  .prefault({});

export type Block = z.infer<typeof blockSchema>;
export type ContentBlock = z.infer<typeof contentBlock>;
export type GalleryBlock = z.infer<typeof galleryBlock>;
export type DividerBlock = z.infer<typeof dividerBlock>;
export type SpacerBlock = z.infer<typeof spacerBlock>;
export type ButtonsBlock = z.infer<typeof buttonsBlock>;
export type BoxStyle = z.infer<z.ZodObject<typeof boxFields>>;
export type TextBoxStyle = z.infer<typeof textBoxStyle>;
export type BlockStyle = z.infer<typeof blockStyle>;
export type Decoration = z.infer<typeof decoration>;
export type MediaItem = z.infer<typeof mediaItem>;
export type PageSettings = z.infer<typeof pageSchema>;
