import os,subprocess
IMG='/home/claude/finnoybu-press/public/images/'
F='/tmp/aplus/node_modules/@fontsource/source-serif-4/files/'
covers={n:IMG+f for f in os.listdir(IMG) for n in [f[6:8]] if f.startswith('cover-') and (f.endswith('-2027.jpg') or f=='cover-29-ai-for-3d-modeling.jpg') and f[6:8].isdigit()}
covers={int(k):v for k,v in covers.items()}
CSS=f"""
@font-face{{font-family:SS;src:url(file://{F}source-serif-4-latin-600-normal.woff2);font-weight:600}}
@font-face{{font-family:SS;src:url(file://{F}source-serif-4-latin-400-normal.woff2);font-weight:400}}
@font-face{{font-family:SS;src:url(file://{F}source-serif-4-latin-400-italic.woff2);font-style:italic}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#f7f3ec;color:#1a1614;font-family:Inter,sans-serif;overflow:hidden}}
.serif{{font-family:SS,Georgia,serif}}
img.c{{display:block;box-shadow:0 6px 18px rgba(26,22,20,.28);border-radius:2px}}
"""
def render(name,w,h,body):
    p=f'/tmp/aplus/{name}.html'
    open(p,'w').write(f'<!doctype html><html><head><meta charset=utf-8><style>{CSS}</style></head><body style="width:{w}px;height:{h}px">{body}</body></html>')
    subprocess.run(['google-chrome','--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=2',f'--window-size={w},{h}',f'--screenshot=/tmp/aplus/out/{name}.png','--virtual-time-budget=3000','file://'+p],check=True,capture_output=True)

# Header 970x600: text left, cover wall right
wall=''.join(f'<img class=c src="file://{covers[n]}" style="width:92px;height:147px">' for n in [1,3,5,7,9,16,20,26,22,11,13,29,27,28,15])
render('header',970,600,f'''
<div style="display:flex;height:600px">
 <div style="width:400px;padding:70px 20px 60px 56px;display:flex;flex-direction:column;justify-content:center">
  <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:#b34d2c">Finnoybu Press · The Complete Series</div>
  <div class=serif style="font-size:64px;font-weight:600;line-height:1.02;margin:18px 0 22px">AI for<br>Everyone</div>
  <div class=serif style="font-size:23px;line-height:1.35;color:#3a342f">Twenty-nine practical guides to the AI tools you use at work, and the skills that work across all of them.</div>
  <div style="margin-top:28px;width:64px;height:3px;background:#1a1614"></div>
 </div>
 <div style="flex:1;background:#ebe6dc;display:flex;align-items:center;justify-content:center">
  <div style="display:grid;grid-template-columns:repeat(5,92px);gap:16px 14px;transform:rotate(-4deg)">{wall}</div>
 </div>
</div>''')

def tile(name,nums,label,color):
    n=len(nums); w=120 if n>=3 else 150
    imgs=''.join(f'<img class=c src="file://{covers[k]}" style="width:{w}px;height:{int(w*1.6)}px;margin-left:{-28 if i else 0}px;transform:rotate({(i-(n-1)/2)*5}deg);z-index:{10-abs(int(i-(n-1)/2))}">' for i,k in enumerate(nums))
    render(name,440,440,f'''<div style="height:440px;background:{color};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px">
 <div style="display:flex;align-items:center;justify-content:center">{imgs}</div>
 <div style="color:#f7f3ec;font-size:15px;letter-spacing:.14em;text-transform:uppercase;font-weight:700">{label}</div></div>''')
tile('tile1',[1,3,5,7],'Product Deep Dives','#b34d2c')
tile('tile2',[22,12,11,25],'Product Guides','#1f5f6b')
tile('tile3',[16,20,21,18],'Cross-Platform Skills','#3a5a3f')
tile('tile4',[26,27,28,29],'Capabilities','#1a1614')
