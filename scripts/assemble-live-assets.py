from __future__ import annotations
import concurrent.futures
import json
import re
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path('/home/kali/web_atk/3D-web2/activetheory-production-rebuild')
PUBLIC = ROOT / 'app/public'
SOURCE = ROOT / 'vendor/forensic/current-v6/assets/js/app.1780406240914.js'
BASE = 'https://activetheory.net/'

FIXED = [
    'assets/js/hydra/hydra-thread.js',
    'sw.js',
    'assets/fonts/NBArchitektStd-Regular-export/NBArchitektStd-Regular.woff2',
    'assets/fonts/NBArchitektStd-Regular-export/NBArchitektStd-Regular.woff',
    'assets/fonts/NBArchitektStd-Regular-export/NBArchitektStd-Regular.otf',
    'assets/fonts/NBArchitektStd-Light-export/NBArchitektStd-Light.woff2',
    'assets/fonts/NBArchitektStd-Light-export/NBArchitektStd-Light.woff',
    'assets/fonts/NBArchitektStd-Light-export/NBArchitektStd-Light.otf',
    'assets/fonts/NBArchitektStd-Bold-export/NBArchitektStd-Bold.woff2',
    'assets/fonts/NBArchitektStd-Bold-export/NBArchitektStd-Bold.woff',
    'assets/fonts/NBArchitektStd-Bold-export/NBArchitektStd-Bold.otf',
    'assets/meta/apple-touch-icon.png',
    'assets/meta/favicon-32x32.png',
    'assets/meta/favicon-16x16.png',
    'assets/meta/safari-pinned-tab.svg',
    'assets/meta/android-chrome-192x192.png',
    'assets/meta/android-chrome-512x512.png',
]

s = SOURCE.read_text(errors='ignore')
start = s.find('window.UIL_ASSETS_GEOMETRIES=')
if start < 0:
    raise SystemExit('UIL asset inventory not found')
start += len('window.UIL_ASSETS_GEOMETRIES=')
end = s.find(';window.', start)
chunk = s[start:end]
assets = [(p, int(b)) for p, b in re.findall(r'filename:"([^"]+)",bytes:(\d+)', chunk)]

def runtime_path(name: str) -> str:
    low = name.lower()
    suffix = Path(name).suffix.lower()
    if suffix in {'.bin'}:
        return 'assets/geometry/' + name
    if suffix == '.json' and not name.startswith('_lighting/'):
        return 'assets/geometry/' + name
    # Lighting metadata and visual/material assets are served from images.
    return 'assets/images/' + name

asset_paths = [(runtime_path(p), b) for p, b in assets]
paths = sorted(set([p for p, _ in asset_paths] + FIXED))

manifest = ROOT / '.artifacts/live-asset-manifest.json'
manifest.parent.mkdir(parents=True, exist_ok=True)
manifest.write_text(json.dumps({
    'source': 'https://activetheory.net/',
    'cache_id': '1780406240914',
    'inventory_source': str(SOURCE.relative_to(ROOT)),
    'generated_assets': len(assets),
    'generated_bytes': sum(b for _, b in assets),
    'fixed_assets': FIXED,
    'paths': paths,
}, indent=2) + '\n')

session = {'ok': [], 'failed': [], 'mismatch': []}

def fetch(rel: str):
    target = PUBLIC / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    # unsupported.html is intentionally fetched from the live unsupported route.
    url = BASE + quote(rel, safe='/')
    if rel == 'unsupported.html':
        url = BASE + 'unsupported'
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urlopen(req, timeout=45) as resp:
            data = resp.read()
            ctype = resp.headers.get('content-type', '')
            final_url = resp.geturl()
        # Reject SPA fallback accidentally saved as a binary/runtime asset.
        if rel != 'unsupported.html' and rel.startswith('assets/'):
            expected = next((b for p, b in asset_paths if p == rel), None)
            if expected is not None and expected != len(data):
                session['mismatch'].append({'path': rel, 'expected': expected, 'actual': len(data), 'final_url': final_url, 'content_type': ctype})
                return
        target.write_bytes(data)
        session['ok'].append({'path': rel, 'bytes': len(data), 'content_type': ctype, 'final_url': final_url})
    except Exception as e:
        session['failed'].append({'path': rel, 'error': repr(e)})

# Fetch in parallel; this is a bounded archival reconstruction, not a live crawl.
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
    list(ex.map(fetch, paths + ['unsupported.html']))

(ROOT / '.artifacts/live-asset-fetch-report.json').write_text(json.dumps(session, indent=2) + '\n')
print(json.dumps({
    'inventory_assets': len(assets),
    'inventory_bytes': sum(b for _, b in assets),
    'requested': len(paths) + 1,
    'downloaded': len(session['ok']),
    'failed': len(session['failed']),
    'mismatch': len(session['mismatch']),
}, indent=2))
if session['failed']:
    print('FAILED:')
    for x in session['failed'][:20]: print(x)
if session['mismatch']:
    print('MISMATCH:')
    for x in session['mismatch'][:20]: print(x)
