from __future__ import annotations
import concurrent.futures, hashlib, json, re, subprocess
from pathlib import Path
from urllib.parse import quote

ROOT=Path('/home/kali/web_atk/3D-web2/activetheory-production-rebuild')
PUBLIC=ROOT/'app/public'
SOURCE=ROOT/'vendor/forensic/current-v6/assets/js/app.1780406240914.js'
BASE='https://activetheory.net/'

fixed=[
 'assets/js/hydra/hydra-thread.js','sw.js','unsupported.html',
 'assets/fonts/NBArchitektStd-Regular-export/NBArchitektStd-Regular.woff2',
 'assets/fonts/NBArchitektStd-Regular-export/NBArchitektStd-Regular.woff',
 'assets/fonts/NBArchitektStd-Regular-export/NBArchitektStd-Regular.otf',
 'assets/fonts/NBArchitektStd-Light-export/NBArchitektStd-Light.woff2',
 'assets/fonts/NBArchitektStd-Light-export/NBArchitektStd-Light.woff',
 'assets/fonts/NBArchitektStd-Light-export/NBArchitektStd-Light.otf',
 'assets/fonts/NBArchitektStd-Bold-export/NBArchitektStd-Bold.woff2',
 'assets/fonts/NBArchitektStd-Bold-export/NBArchitektStd-Bold.woff',
 'assets/fonts/NBArchitektStd-Bold-export/NBArchitektStd-Bold.otf',
 'assets/meta/apple-touch-icon.png','assets/meta/favicon-32x32.png','assets/meta/favicon-16x16.png',
 'assets/meta/safari-pinned-tab.svg','assets/meta/android-chrome-192x192.png','assets/meta/android-chrome-512x512.png'
]

s=SOURCE.read_text(errors='ignore')
start=s.index('window.UIL_ASSETS_GEOMETRIES=')+len('window.UIL_ASSETS_GEOMETRIES=')
end=s.index(';window.',start)
chunk=s[start:end]
raw=[(p,int(b)) for p,b in re.findall(r'filename:"([^"]+)",bytes:(\d+)',chunk)]

def runtime_path(name):
    ext=Path(name).suffix.lower()
    if ext=='.bin' or (ext=='.json' and not name.startswith('_lighting/')):
        return 'assets/geometry/'+name
    return 'assets/images/'+name

entries={runtime_path(p):b for p,b in raw}
for x in fixed: entries.setdefault(x,None)
# The live app references the following runtime media explicitly outside the generated inventory.
for x in ['assets/video/reel-frame.jpg','assets/video/reel.mp4','assets/music/Sergey Azbel - Themis.mp3','assets/music/nuer self - Dusk.mp3','assets/music/Flint - Fly up High.mp3','assets/music/Hotham - To the Stars.mp3','assets/music/Jozeque - Sultans of Streams.mp3','assets/music/Downtown Binary - Other Worlds.mp3','assets/music/Magiksolo - Quantum World.mp3','assets/music/BXRDVJA - Ghost Cities.mp3']:
    entries.setdefault(x,None)

manifest={'source':BASE,'cache_id':'1780406240914','generated_inventory_count':len(raw),'generated_inventory_bytes':sum(b for _,b in raw),'entries':[{'path':p,'expected_bytes':entries[p]} for p in sorted(entries)]}
(ROOT/'.artifacts/live-asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')

results={'downloaded':[],'skipped':[],'failed':[],'mismatch':[]}

def fetch(item):
    rel,expected=item
    target=PUBLIC/rel
    target.parent.mkdir(parents=True,exist_ok=True)
    if expected is not None and target.exists() and target.stat().st_size==expected:
        return ('skipped',rel,target.stat().st_size)
    if expected is None and target.exists() and target.stat().st_size>0 and rel not in ['assets/video/reel.mp4']:
        return ('skipped',rel,target.stat().st_size)
    if rel=='unsupported.html': url=BASE+'unsupported'
    else: url=BASE+quote(rel,safe='/')
    tmp=target.with_name(target.name+'.live-part')
    cmd=['curl','-sS','-L','--fail','--retry','2','--connect-timeout','10','--max-time','120','-o',str(tmp),url]
    try:
        cp=subprocess.run(cmd,capture_output=True,text=True)
        if cp.returncode!=0:
            tmp.unlink(missing_ok=True); return ('failed',rel,cp.stderr.strip()[-500:])
        size=tmp.stat().st_size
        head=tmp.read_bytes()[:64] if size else b''
        if expected is not None and size!=expected:
            tmp.unlink(missing_ok=True); return ('mismatch',rel,f'expected={expected} actual={size}')
        # Reject accidental HTML SPA fallbacks for non-HTML runtime files.
        if rel not in ['unsupported.html'] and rel.startswith('assets/') and (b'<!DOCTYPE html' in head or b'<html' in head.lower()):
            tmp.unlink(missing_ok=True); return ('mismatch',rel,'HTML fallback returned')
        tmp.replace(target)
        return ('downloaded',rel,size)
    except Exception as e:
        tmp.unlink(missing_ok=True); return ('failed',rel,repr(e))

items=sorted(entries.items())
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
    for kind,rel,val in ex.map(fetch,items):
        results.setdefault(kind,[]).append({'path':rel,'detail':val})
        if kind in {'downloaded','failed','mismatch'}:
            print(kind,rel,val,flush=True)

(ROOT/'.artifacts/live-asset-fetch-report.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({k:len(v) for k,v in results.items()},indent=2))
