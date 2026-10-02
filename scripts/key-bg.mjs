import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

// 사용법: node scripts/key-bg.mjs <unit_anim> <r,g,b>
// PixelLab 템플릿 애니가 가끔 불투명 회색 바탕을 붙여 온다. art/frames/<unit_anim>/ 의 프레임마다
// 바깥(투명·가장자리)에 닿은 그 색 영역만 지우고 스트립을 다시 붙인다.
const [name, rgb] = process.argv.slice(2);
const key = rgb.split(',').map(Number);
const dir = path.join('art/frames', name);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(dir, f));
for (const file of files) {
  const p = PNG.sync.read(fs.readFileSync(file));
  const { width: w, height: h, data } = p;
  const isKey = (i) => data[i * 4 + 3] > 0 && data[i * 4] === key[0] && data[i * 4 + 1] === key[1] && data[i * 4 + 2] === key[2];
  const open = (x, y) => x < 0 || y < 0 || x >= w || y >= h || data[(y * w + x) * 4 + 3] === 0;
  const stack = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (isKey(i) && (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) stack.push(i);
  }
  let n = 0;
  while (stack.length) {
    const i = stack.pop();
    if (!isKey(i)) continue;
    data[i * 4 + 3] = 0;
    n++;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  fs.writeFileSync(file, PNG.sync.write(p));
  console.log(file, `${n} px cleared`);
}
execFileSync('node', ['scripts/stitch-strip.mjs', name, ...files], { stdio: 'inherit' });
