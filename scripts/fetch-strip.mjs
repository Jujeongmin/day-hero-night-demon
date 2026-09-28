import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// 사용법: node scripts/fetch-strip.mjs <unit_anim> <frame URL 앞부분(…/east/)> <프레임 수>
// PixelLab 프레임 0.png…N-1.png 를 art/frames/<unit_anim>/ 에 받고 스트립으로 붙인다.
const [name, prefix, countArg] = process.argv.slice(2);
const count = Number(countArg);
if (!name || !prefix || !Number.isInteger(count) || count < 1) {
  console.error('usage: node scripts/fetch-strip.mjs <unit_anim> <url-prefix> <count>');
  process.exit(1);
}
const dir = path.join('art/frames', name);
fs.mkdirSync(dir, { recursive: true });
const files = [];
for (let i = 0; i < count; i++) {
  const res = await fetch(`${prefix}${i}.png`);
  if (!res.ok) throw new Error(`${name} frame ${i}: HTTP ${res.status}`);
  const file = path.join(dir, `${String(i).padStart(3, '0')}.png`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  files.push(file);
}
execFileSync('node', ['scripts/stitch-strip.mjs', name, ...files], { stdio: 'inherit' });
