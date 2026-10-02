"""
낱장 프레임(PixelLab animate_image 결과)을 게임 스트립으로: public/sprites/<name>_<anim>.png + src/render/sprites.json 항목.
전투 화면은 그림을 가로 가운데, 발을 높이의 84%에 맞춰 그리므로 같은 규칙으로 여백을 넣는다.

사용: python scripts/frames-to-strip.py <name> <anim> <frames-glob> <canvas W> <canvas H> <offset x> <offset y>
예:   python scripts/frames-to-strip.py werewolf idle "art/monsters/new3/ww_idle_*.png" 72 72 4 0
"""
import glob
import json
import re
import sys

from PIL import Image

name, anim, pattern = sys.argv[1], sys.argv[2], sys.argv[3]
W, H, ox, oy = (int(v) for v in sys.argv[4:8])
files = sorted(glob.glob(pattern), key=lambda p: int(re.findall(r'(\d+)\.png$', p)[0]))
frames = []
for f in files:
    im = Image.open(f).convert('RGBA')
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    c.alpha_composite(im, (ox, oy))
    frames.append(c)
strip = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
x0 = y0 = 10**9
x1 = y1 = -1
for i, fr in enumerate(frames):
    strip.alpha_composite(fr, (i * W, 0))
    b = fr.getbbox()
    if b:
        x0, y0, x1, y1 = min(x0, b[0]), min(y0, b[1]), max(x1, b[2]), max(y1, b[3])
out = f'public/sprites/{name}_{anim}.png'
strip.save(out)
path = 'src/render/sprites.json'
data = json.load(open(path, encoding='utf-8'))
data[f'{name}_{anim}'] = {'frames': len(frames), 'w': W, 'h': H, 'box': [x0, y0, x1 - x0, y1 - y0]}
json.dump(data, open(path, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
open(path, 'a', encoding='utf-8').write('\n')
print(out, len(frames), 'frames', W, 'x', H)
