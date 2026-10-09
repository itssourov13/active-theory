# Asset Reconstruction

## Baseline sources

The runtime baseline was assembled from two sources:

1. Exact local forensic V6 files copied into `app/public/`.
2. Missing runtime/static assets fetched from the live `activetheory.net` deployment.

The untouched originals remain under `vendor/forensic/current-v6/`.

## Asset classes

- `assets/js/` — runtime JS and worker code.
- `assets/shaders/` — compiled shader bundle.
- `assets/data/` — UIL/runtime configuration.
- `assets/geometry/` — generated geometry and scene models.
- `assets/images/` — textures, UI imagery, PBR maps and scene images.
- `assets/fonts/` — NB Architekt font family.
- `assets/meta/` — favicon/PWA assets.
- `sw.js` — service worker.

The V6 bundle itself publishes a 351-entry generated asset inventory with declared byte sizes. The assembler uses that inventory rather than guessing filenames.

## Verification principle

Every downloaded generated asset should be checked against its declared byte size. A SPA HTML fallback is not accepted as an asset.

The generated records are saved under `.artifacts/`.
