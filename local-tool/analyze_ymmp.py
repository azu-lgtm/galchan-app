import json, sys, os
sys.stdout.reconfigure(encoding='utf-8')
from collections import Counter

# テンプレートymmpを解析
path = 'E:/ガルyt/ガルちゃんYMM4テンプレート/テンプレ2026-2-25.ymmp'
with open(path, 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

items = data['Timelines'][0]['Items']
type_key = '$type'

types = Counter(i.get(type_key,'').split('.')[-1].replace(', YukkuriMovieMaker','') for i in items)
print('=== テンプレート アイテム種別 ===')
for t, c in types.most_common():
    print(f'  {t}: {c}件')

img_items = [i for i in items if 'ImageItem' in i.get(type_key,'')]
print(f'\n=== テンプレート ImageItem ({len(img_items)}件) ===')
for img in img_items:
    fp = str(img.get('FilePath','')).split('\\')[-1]
    zoom = img.get('Zoom', {})
    rot = img.get('Rotation', {})
    x_p = img.get('X', {})
    y_p = img.get('Y', {})
    print(f'\n  File: {fp}')
    print(f'  Frame={img.get("Frame")} Layer={img.get("Layer")} Len={img.get("Length")}')
    print(f'  Zoom: Values={zoom.get("Values")} AnimationType={zoom.get("AnimationType")} Span={zoom.get("Span")}')
    print(f'  Rotation: Values={rot.get("Values")} AnimationType={rot.get("AnimationType")} Span={rot.get("Span")}')
    print(f'  X: Values={x_p.get("Values")} AnimationType={x_p.get("AnimationType")} Span={x_p.get("Span")}')
    print(f'  Y: Values={y_p.get("Values")} AnimationType={y_p.get("AnimationType")} Span={y_p.get("Span")}')
    vfx = img.get('VideoEffects', [])
    print(f'  VideoEffects: {len(vfx)}件 {vfx[:2] if vfx else ""}')
