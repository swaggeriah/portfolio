import type { BoxStyle, Decoration, PageSettings } from './blocks';
import { url } from './content';

type CssValues = Record<string, string | number | undefined | null | false>;

// { '--a': 1, color: 'red', hidden: undefined } -> "--a:1;color:red"
export function styleString(values: CssValues): string | undefined {
  const parts = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== '')
    .map(([key, value]) => `${key}:${value}`);
  return parts.length ? parts.join(';') : undefined;
}

// Files in /media/... need the site's base path in front. Full web addresses stay as they are.
export const publicUrl = (path: string) =>
  /^(https?:)?\/\//.test(path) || !path.startsWith('/') ? path : url(path);

// Safe to drop into url(...): spaces, quotes and brackets are percent-encoded.
export const cssUrl = (path: string) =>
  `url(${publicUrl(path).replace(/["'()\\\s]/g, (char) => encodeURIComponent(char))})`;

const PADDING: Record<string, string> = {
  none: '0',
  small: '8px',
  medium: '16px',
  large: '28px',
  xl: '44px',
};
// "auto": no padding without a backdrop, comfortable padding with one.
const autoPadding = (backdrop: string) =>
  backdrop === 'none' ? '0' : backdrop === 'window' ? '12px' : '14px 16px';

const REPEAT: Record<string, { size: string; repeat: string; position: string }> = {
  tile: { size: 'auto', repeat: 'repeat', position: '0 0' },
  cover: { size: 'cover', repeat: 'no-repeat', position: 'center' },
  contain: { size: 'contain', repeat: 'no-repeat', position: 'center' },
  center: { size: 'auto', repeat: 'no-repeat', position: 'center' },
};

// CSS variables that global.css reads to paint a backdrop.
export function boxStyle(box: BoxStyle): CssValues {
  const mode = REPEAT[box.imageMode] ?? REPEAT.tile;
  return {
    '--bd-color': box.color,
    '--bd-opacity': box.opacity < 100 ? box.opacity / 100 : undefined,
    '--bd-image': box.image ? cssUrl(box.image) : undefined,
    '--bd-size': box.image ? mode.size : undefined,
    '--bd-repeat': box.image ? mode.repeat : undefined,
    '--bd-position': box.image ? mode.position : undefined,
    '--pad': box.padding === 'auto' ? autoPadding(box.backdrop) : PADDING[box.padding],
  };
}

const ANCHOR_POINT: Record<string, [number, number]> = {
  'top-left': [0, 0], top: [50, 0], 'top-right': [100, 0],
  left: [0, 50], center: [50, 50], right: [100, 50],
  'bottom-left': [0, 100], bottom: [50, 100], 'bottom-right': [100, 100],
};

// The picture's anchor point sits on the same point of the block; x and y then nudge it
// (x to the right, y downwards). Rotation happens around the picture's centre.
export function decorationStyle(deco: Decoration): string | undefined {
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

// Settings that change the whole page: desktop colour and picture, and the window width.
const WIDTHS: Record<string, string> = { narrow: '700px', medium: '840px', wide: '1100px', full: '3000px' };

export function pageStyles(page: PageSettings | undefined, defaultWidth: string) {
  const mode = page?.desktopImageMode ?? 'tile';
  const bg = REPEAT[mode] ?? REPEAT.tile;
  const body = styleString({
    '--desktop': page?.desktopColor,
    'background-image': page?.desktopImage
      ? mode === 'none'
        ? 'none'
        : cssUrl(page.desktopImage)
      : mode === 'none'
        ? 'none'
        : undefined,
    'background-size': page?.desktopImage && mode !== 'none' ? bg.size : undefined,
    'background-repeat': page?.desktopImage && mode !== 'none' ? bg.repeat : undefined,
    'background-position': page?.desktopImage && mode !== 'none' ? bg.position : undefined,
  });
  const main = styleString({
    '--page-width': WIDTHS[page?.windowWidth ?? ''] ?? defaultWidth,
  });
  return { body, main };
}
