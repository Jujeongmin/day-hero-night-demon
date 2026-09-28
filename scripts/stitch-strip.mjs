import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

// 사용법: node scripts/stitch-strip.mjs <unit_anim> <frame1.png> <frame2.png> ...
const [name, ...frames] = process.argv.slice(2);
if (!name || frames.length === 0) {
  console.error('usage: node scripts/stitch-strip.mjs <unit_anim> <frames...>');
  process.exit(1);
}
const imgs = frames.map((f) => PNG.sync.read(fs.readFileSync(f)));
const { width: w, height: h } = imgs[0];
for (const im of imgs) {
  if (im.width !== w || im.height !== h) throw new Error(`frame size mismatch in ${name}`);
}
const out = new PNG({ width: w * imgs.length, height: h });
imgs.forEach((im, i) => PNG.bitblt(im, out, 0, 0, w, h, i * w, 0));
fs.mkdirSync('public/sprites', { recursive: true });
fs.writeFileSync(path.join('public/sprites', `${name}.png`), PNG.sync.write(out));
const manifestPath = 'public/sprites/manifest.json';
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
manifest[name] = { frames: imgs.length, w, h };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`${name}: ${imgs.length} frames ${w}x${h}`);
