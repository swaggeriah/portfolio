// Turns a link on its own line into an embed:
//   YouTube / Vimeo / TikTok links  -> player
//   .mp4 / .webm / .mov links       -> <video>
//   .png / .jpg / .gif / .webp links -> <img>
// Also lets you write ![caption](/media/clip.mp4) for a local video file.

const VIDEO_FILE = /\.(mp4|webm|mov|m4v|ogv)$/i;
const IMAGE_FILE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const PLAYER_PERMISSIONS =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';

const esc = (text = '') =>
  String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const isLocal = (url) => url.startsWith('/') && !url.startsWith('//');
const bareHost = (u) => u.hostname.replace(/^(www|m)\./, '');

function youtubeId(u) {
  const host = bareHost(u);
  if (host === 'youtu.be') return u.pathname.split('/')[1] || null;
  if (host !== 'youtube.com') return null;
  if (u.pathname === '/watch') return u.searchParams.get('v');
  const match = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/);
  return match ? match[1] : null;
}

function vimeoId(u) {
  if (bareHost(u) !== 'vimeo.com') return null;
  const match = u.pathname.match(/^\/(\d+)/);
  return match ? match[1] : null;
}

function tiktokId(u) {
  if (bareHost(u) !== 'tiktok.com') return null;
  const match = u.pathname.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

const player = (src, title, extraClass) =>
  `<div class="embed ${extraClass}"><iframe src="${src}" title="${esc(title)}" loading="lazy" allowfullscreen allow="${PLAYER_PERMISSIONS}"></iframe></div>`;

const caption = (text) => (text ? `<figcaption>${esc(text)}</figcaption>` : '');

// Returns { kind, html } or null when the URL is not something we embed.
function embedFor(raw, alt, base) {
  let u;
  try {
    u = new URL(raw, 'https://placeholder.invalid');
  } catch {
    return null;
  }
  const local = isLocal(raw);
  const src = local ? base + raw : raw;

  if (!local) {
    const yt = youtubeId(u);
    if (yt) {
      return { kind: 'player', html: player(`https://www.youtube-nocookie.com/embed/${yt}`, alt || 'YouTube video', 'embed-wide') };
    }
    const vimeo = vimeoId(u);
    if (vimeo) {
      return { kind: 'player', html: player(`https://player.vimeo.com/video/${vimeo}`, alt || 'Vimeo video', 'embed-wide') };
    }
    const tiktok = tiktokId(u);
    if (tiktok) {
      return { kind: 'player', html: player(`https://www.tiktok.com/embed/v2/${tiktok}`, alt || 'TikTok video', 'embed-tiktok') };
    }
  }
  if (VIDEO_FILE.test(u.pathname)) {
    return {
      kind: 'video',
      html: `<figure class="embed-file"><video src="${esc(src)}" controls playsinline preload="metadata"></video>${caption(alt)}</figure>`,
    };
  }
  if (IMAGE_FILE.test(u.pathname)) {
    return {
      kind: 'image',
      html: `<figure class="embed-file"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" />${caption(alt)}</figure>`,
    };
  }
  return null;
}

// If a paragraph holds only a bare link, a bare URL or an image, return its embed html.
function embedFromParagraph(paragraph, base) {
  if (paragraph.children.length !== 1) return null;
  const only = paragraph.children[0];

  if (only.type === 'link') {
    const label = only.children.length === 1 && only.children[0].type === 'text' ? only.children[0].value : null;
    if (label !== only.url) return null; // a normal [text](url) link stays a link
    return embedFor(only.url, '', base)?.html ?? null;
  }
  if (only.type === 'text' && /^https?:\/\/\S+$/.test(only.value.trim())) {
    return embedFor(only.value.trim(), '', base)?.html ?? null;
  }
  if (only.type === 'image') {
    const embed = embedFor(only.url, only.alt ?? '', base);
    // Plain images stay normal Markdown images; only videos and players get replaced.
    return embed && embed.kind !== 'image' ? embed.html : null;
  }
  return null;
}

function visit(parent, base) {
  parent.children.forEach((node, index) => {
    if (node.type === 'paragraph') {
      const html = embedFromParagraph(node, base);
      if (html) {
        parent.children[index] = { type: 'html', value: html };
        return;
      }
    }
    if (node.type === 'image' && base && isLocal(node.url)) {
      node.url = base + node.url;
    }
    if (node.children) visit(node, base);
  });
}

export default function remarkEmbeds({ base = '' } = {}) {
  const prefix = base.replace(/\/$/, '');
  return (tree) => visit(tree, prefix);
}