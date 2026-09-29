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
// 모든 프레임에서 그림이 있는 영역(목록 초상화를 꽉 채워 그릴 때 쓴다)
let x0 = w, y0 = h, x1 = -1, y1 = -1;
for (const im of imgs) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (im.data[(y * w + x) * 4 + 3] === 0) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
}
imgs.forEach((im, i) => PNG.bitblt(im, out, 0, 0, w, h, i * w, 0));
fs.mkdirSync('public/sprites', { recursive: true });
fs.writeFileSync(path.join('public/sprites', `${name}.png`), PNG.sync.write(out));
const manifestPath = 'src/render/sprites.json';
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
manifest[name] = { frames: imgs.length, w, h, ...(x1 >= 0 ? { box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] } : {}) };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`${name}: ${imgs.length} frames ${w}x${h}`);
