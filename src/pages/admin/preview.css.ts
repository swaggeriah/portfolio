// The editor's live preview loads this: the website's own stylesheet, with the background
// texture pointing at the right file. Because it is the same CSS, the preview always matches.
import css from '../../styles/global.css?raw';
import texture from '../../assets/texture.png';

export function GET() {
  const fixed = css.replace("url('../assets/texture.png')", `url('${texture.src}')`);
  return new Response(fixed, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
}
