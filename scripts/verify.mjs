import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'app/public');
const reportPath = path.join(root, '.artifacts/live-asset-fetch-report.json');
const manifestPath = path.join(root, '.artifacts/live-asset-manifest.json');

const required = [
  'index.html',
  'unsupported.html',
  'assets/js/app.1780406240914.js',
  'assets/js/modules.1780406240914.js',
  'assets/js/hydra/hydra-thread.js',
  'assets/js/lib/qrious.js',
  'assets/data/uil.1780406240914.json',
  'assets/geometry/home/jellyfish.json',
  'assets/geometry/logo/AT_logo.json',
  'assets/shaders/compiled.vs',
  'assets/fonts/NBArchitektStd-Regular-export/NBArchitektStd-Regular.woff2',
  'assets/fonts/NBArchitektStd-Light-export/NBArchitektStd-Light.woff2',
  'assets/fonts/NBArchitektStd-Bold-export/NBArchitektStd-Bold.woff2',
  'assets/meta/manifest.json',
  'assets/meta/apple-touch-icon.png',
  'assets/meta/favicon-32x32.png',
  'assets/meta/favicon-16x16.png',
  'assets/meta/safari-pinned-tab.svg',
  'sw.js'
];

const expectedCore = {
  // SHA-256 pins checked directly against https://activetheory.net/ on 2026-10-09.
  'index.html': 'e026e78b8db8823da1d2256fd7b011aa016b971d2bbd64e72e98f440f46626d5',
  'unsupported.html': '6aae50dbeb1dbcb2620575a3f26142f9cc91d37e5f6216603d69d165351b6953',
  'assets/js/app.1780406240914.js': '085d3e6a46893f503262ccdaaad16f832367e709bae7ae14c369b629fdb1a5cf',
  'assets/data/uil.1780406240914.json': 'eb1553d8c1a9188646cd77fa550a89619cc1ad851f2dc242f0d7b9d1a50a00e7',
  'assets/js/modules.1780406240914.js': 'e0346e49f92d5db8ad9d9b8e49c61ad52cd2b3994c28e598f4dec548a628cc3c',
  'assets/js/hydra/hydra-thread.js': 'c1133f09166fcb4c5e338040ef08189c60dcbca41e7057a18c5e098ecc5988cd',
  'assets/shaders/compiled.vs': '5670e842036def262f0dc7e39faf95523f015ef582431ddb9f47efad28ae5b4c',
  'assets/fonts/NBArchitektStd-Regular-export/NBArchitektStd-Regular.woff2': '53b29d635aa28bc4d91fd80e6bc1d9eec4482e6ea994e63d7ec7e1fc3a4ebd11',
  'assets/geometry/home/jellyfish.json': '23545bc7d471853064380812838e15580dee783967a3fb85594aa2ac4c9c3784',
  'assets/geometry/logo/AT_logo.json': 'd0556411038241270bc82d5e9cc434efde79cb79eab5bf0100f1f9bf1c27ffed'
};

let errors = [];
for (const rel of required) {
  if (!fs.existsSync(path.join(publicDir, rel))) errors.push(`missing: ${rel}`);
}

for (const [rel, expected] of Object.entries(expectedCore)) {
  const file = path.join(publicDir, rel);
  if (!fs.existsSync(file)) continue;
  const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (actual !== expected) errors.push(`core hash mismatch: ${rel} expected=${expected} actual=${actual}`);
}

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entries = manifest.entries || [];
  let present = 0;
  for (const entry of entries) {
    const rel = entry.path;
    const file = path.join(publicDir, rel);
    if (!fs.existsSync(file)) { errors.push(`inventory missing: ${rel}`); continue; }
    const size = fs.statSync(file).size;
    if (entry.expected_bytes != null && size !== entry.expected_bytes) {
      errors.push(`inventory size mismatch: ${rel} expected=${entry.expected_bytes} actual=${size}`);
      continue;
    }
    present++;
  }
  console.log(`inventory files verified: ${present}/${entries.length}`);
}

for (const env of ['production','staging','dev']) {
  for (const kind of ['about', 'contact', 'media', 'metadata', 'projects']) {
    const file = path.join(root, 'app/cms-reference', `${kind}-${env}.json`);
    if (!fs.existsSync(file)) {
      errors.push(`missing CMS snapshot: ${file}`);
      continue;
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push(`invalid CMS JSON: ${file} (${error.message})`);
      continue;
    }

    if (kind === 'projects' && (!Array.isArray(data) || data.length !== 65)) {
      errors.push(`unexpected CMS project count in ${file}: expected 65 records`);
    }
    if (kind === 'media' && (!Array.isArray(data) || data.length !== 161)) {
      errors.push(`unexpected CMS media count in ${file}: expected 161 records`);
    }
  }
}

if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  console.log(`live asset fetch: downloaded=${report.downloaded?.length ?? 0} skipped=${report.skipped?.length ?? 0} failed=${report.failed?.length ?? 0} mismatch=${report.mismatch?.length ?? 0}`);
  if ((report.failed?.length ?? 0) > 0) errors.push('live asset fetch contains failed downloads');
  if ((report.mismatch?.length ?? 0) > 0) errors.push('live asset fetch contains byte-size mismatches');
}

console.log(`public size: ${Math.round(fs.readdirSync(publicDir).length)} top-level entries`);
if (errors.length) {
  console.error('\nVERIFY FAILED');
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}
console.log('VERIFY PASSED');
