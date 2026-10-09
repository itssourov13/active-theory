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

## Recovered remaining assets (final recovery sweep, 2026-10-09)

A final recovery sweep (scripts and reports under `~/web_atk/3D-web2/recovered-remaining/`) closed the remaining gaps. Every recovered file was hash-verified (sha256) at fetch time, and downloads that already existed in the forensic archive were byte-compared (0 content differences across the whole sweep). Results, kept in separate folders per recovery rule:

| Stream | Folder | Result | Integration |
| --- | --- | --- | --- |
| CMS media objects (GCS `activetheory-v6.appspot.com/media`) | `recovered-remaining/media-v6/` | 764/764 objects, 1.28 GB, manifest `.artifacts/media-store-manifest.json` | `app/media-store/`, served local-first |
| Missing v6 site files | `recovered-remaining/site-current-v6-missing/` | 9 files: 8 music MP3s + `favicon.ico` | copied into `app/public/` |
| Legacy v4/v5 worker/runtime files | `recovered-remaining/legacy-v4-missing/`, `legacy-v5-missing/` | 1,051 files (77 v4 + 974 v5), 0 failures | forensic reference only |
| Experiment subdomain deployments (44 hosts, `*.activetheory.dev`) | `recovered-remaining/experiments-missing/` | 5,102 new files + 91 hash-verified matches = 5,193 referenced files resolved; 0 failures after the retry pass; 0 content diffs | forensic source only (separate deployments; not part of the main-site serving tree) |

Notes:

- The experiments harvest (`download_experiments.py`, `experiments_harvest_report.json`, `experiments_harvest_retry_report.json`) extracted asset references from every recovered experiment deployment, probed 5,646 candidate refs, confirmed 5,193 real files on the hosts, and fetched each one with a per-file sha256 check. The first pass left 459 transient network failures (DNS/timeout, no 404s); a retry-only pass (`retry_experiments_fails.py`) recovered all 459 with 0 failures. 5,087 content files are on disk in `experiments-missing/`, and all 5,102 'ok' report rows were re-verified present on disk (39 rows use double-slash URL forms that the filesystem stores under their normalized single-slash names); the 91 'match' rows were verified byte-identical inside the forensic archive.
- Of the 61 main-site refs not covered by any recovered source, spot checks confirm the live CDN itself answers with the SPA shell (`text/html`) instead of the file — they are gone upstream and unrecoverable; the rebuild's SPA fallback matches live behavior for them.
- The 91 "match" rows are references whose bytes already existed in the forensic archive and re-downloaded identically — positive confirmation, not duplication.
- Music/OG-image field mapping evidence for SSR lives in `recovered-remaining/og_image_field_map.json`.
