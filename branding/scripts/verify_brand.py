#!/usr/bin/env python3
"""Fidelark brand asset verification - standard library + Pillow; never executes SVG scripts."""
from pathlib import Path
from collections import Counter
import sys, json, hashlib, xml.etree.ElementTree as ET
try:
 from PIL import Image
except ImportError:
 print('Install pillow to validate PNG dimensions');sys.exit(2)
ROOT=Path(__file__).resolve().parents[1]; assert ROOT.name=='branding',ROOT
problems=[];stats=Counter()
for p in ROOT.rglob('*'):
 if not p.is_file():continue
 ext=p.suffix.lower();stats[ext]+=1
 if ext=='.svg':
  try:
   tree=ET.parse(p)
   root=tree.getroot()
   assert root.tag.endswith('svg')
   assert 'viewBox' in root.attrib
   for node in root.iter():
    local=node.tag.split('}')[-1]
    if local in {'script','foreignObject'}:raise ValueError('active SVG element '+local)
    for k,v in node.attrib.items():
     if k.lower().startswith('on'):raise ValueError('inline event handler')
     if (k.endswith('href') or k=='href') and ('http:' in v or 'https:' in v):raise ValueError('remote SVG reference')
  except Exception as e:problems.append(f'SVG {p.relative_to(ROOT)}: {e}')
 elif ext=='.png':
  try:
   with Image.open(p) as im:
    im.verify()
   with Image.open(p) as im:
    if min(im.size)<16:problems.append(f'PNG too small: {p}')
  except Exception as e:problems.append(f'PNG {p.relative_to(ROOT)}: {e}')
for r in ['README.md','assets/logo/svg/lockup-ink.svg','assets/logo/svg/symbol-paper.svg','assets/posters/brand-system-3840x2160.png','brandbook/Fidelark_Brand_Identity_Guidelines_v1.pdf','tokens/brand.css','ui/demo.html','quality/contrast-audit.json']:
 if not (ROOT/r).exists():problems.append('Missing '+r)
a=json.loads((ROOT/'quality/contrast-audit.json').read_text())
for row in a['results']:
 if not row['pass']:problems.append('Contrast fails '+row['pair'])
expected={
 'assets/posters/brand-system-3840x2160.png':(3840,2160),
 'assets/social/og-1200x630.png':(1200,630),
 'assets/social/banner-1584x396.png':(1584,396),
 'assets/social/github-1280x640.png':(1280,640),
 'assets/favicon/icon-512.png':(512,512),
}
for p,size in expected.items():
 try:
  with Image.open(ROOT/p) as im:
   if im.size!=size:problems.append(f'Dimension mismatch {p} {im.size} vs {size}')
 except Exception as e:problems.append(str(e))
print('Assets:',dict(stats),'\nProblems:',len(problems))
for p in problems:print('ERROR:',p)
sys.exit(bool(problems))
