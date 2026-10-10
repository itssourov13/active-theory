# Active Theory Production Rebuild

A reconstruction workspace for the Active Theory V6 live experience, assembled from the current `activetheory.net` deployment and the local forensic archive.

## Project status

**Phase 1 — faithful live reconstruction: INCOMPLETE.**

The recovered browser runtime, supporting assets, captured CMS data, a fully local 764-object media store, SSR deep-link meta injection, a deterministic assistant adapter, and a basic local realtime service are present. Asset verification, the automated smoke suite, a live-vs-local HTTP parity report, and a 67-case SSR deep-link sweep have all passed in recorded runs. This still does **not** establish full visual or interactive parity: the available headless browser did not provide WebGL 2, so the original immersive scene has not yet been verified on a hardware-accelerated browser/device.

See [Phase 1 Status and Parity Matrix](docs/PHASE-1-PARITY-MATRIX.md) for the single current checklist and evidence summary. Read [Baseline Status](docs/BASELINE-STATUS.md) and [Live Audit](docs/PHASE-1-LIVE-AUDIT.md) for supporting detail.

## Workspace map

- `app/public/` — assembled original V6 runtime and recovered public assets.
- `app/cms-reference/` — captured production/staging/dev CMS snapshots.
- `app/media-store/` — fully local mirror of all 764 CMS-referenced GCS media objects (1.28 GB, Git-ignored; pinned by `.artifacts/media-store-manifest.json`).
- `vendor/forensic/current-v6/` — forensic reference copy; do not modify.
- `vendor/forensic/legacy-v5/` — historical worker/runtime reference; do not modify.
- `~/web_atk/3D-web2/recovered-remaining/` — final recovery sweep (outside this repo, see [Asset Reconstruction](docs/ASSET-RECONSTRUCTION.md)): all 764 CMS media objects (`media-v6/`, integrated as `app/media-store/`), 9 missing v6 site files (music + favicon, integrated into `app/public/`), 1,051 legacy v4/v5 files, and the complete 44-host experiments harvest (5,193 referenced files resolved, 0 remaining failures).
- `src/` — reserved for gradual, regression-verified source extraction; currently only contains migration guidance.
- `scripts/` — dependency-light local server, asset verifier, smoke tests, and inventory/recovery helpers.
- `docs/` — plans, forensic findings, service contracts, security notes, and completion checklist.
- `.artifacts/` — generated manifests and reports. The media cache is ignored by Git and is not source.

## Phase 1 scope and guardrails

Reconstruct the current Active Theory V6 experience as faithfully as the available evidence permits. Use the original runtime, bundles, shaders, geometry, textures, worker, runtime data, and captured CMS as primary evidence. Compare unresolved behavior with the live site and label compatible approximations honestly.

**Do not start Phase 2, redesign the experience, or replace recovered behavior with an inspired alternative.** Do not modify `vendor/forensic/*`. A successful HTTP check or asset hash is not proof of visual parity.

## Local commands

Run these from the project root.

Terminal 1 — start the local server:

```bash
npm run start
```

The server binds to `127.0.0.1:4173` by default. Open `http://127.0.0.1:4173/` in a browser running in the same environment. It is loopback-only by design; it is not exposed to other devices on the LAN.

Terminal 2 — run the integration smoke suite while the server is running:

```bash
npm run smoke
```

Verify recovered files, CMS snapshots, and pinned hashes (does not require the server):

```bash
npm run verify
```

Other available commands:

```bash
npm run media:inventory
npm run inventory
```

The smoke suite includes an allowlisted public-media request. That check requires the upstream public media object to remain reachable when it is not already cached. These scripts are development verification tools, not a production deployment validation suite.

## Current capabilities and limitations

- `npm run verify` passes on this branch: 386/386 manifest entries, all selected live-pinned hashes, and the full 764-object media store (1.28 GB) verified against the pinned manifest.
- `npm run smoke` passes on this branch: 27/27 checks, including seven recovered runtime dependencies, the SSR deep-link title for a known slug plus base title for an unknown slug, the basic assistant flow, and the two-client realtime room flow.
- Live-vs-local HTTP parity (`recovered-remaining/live_local_parity_check.py`): **36/36** — 4/4 routes, 21/21 runtime assets, 5/5 CMS snapshots, 6/6 media responses byte-identical after normalizing the documented local bridge line and media-cache URL rewriting.
- SSR deep-link sweep (`recovered-remaining/ssr_sweep_results.txt`): **67/67** — all 65 CMS project slugs plus an unknown slug and a trailing-slash variant produce documents byte-identical to `https://activetheory.net/work/<slug>` (bridge line normalized). Rule: title = `{name} · Active Theory`, description, canonical/og:url/twitter:url = `https://activetheory.net/work/{slug}`, og:image/twitter:image = `image.sizes.i1024px.url` when present (15 projects) else `video.thumbnail` (50 projects), both `encodeURI`-encoded.
- The CMS snapshots contain 65 projects and 161 media records per environment snapshot. All CMS-referenced public GCS media is served from the local store (offline); on-demand proxy remains as fallback for allowlisted URLs outside the store.
- The remaining-asset recovery sweep is complete: every static reference the live main site still serves was recovered (61 refs return the live SPA fallback and are unrecoverable by design), the 44 experiment subdomain deployments were fully harvested (5,102 new files + 91 hash-verified matches = 5,193 references, 0 failures, 0 content diffs), and 1,051 legacy v4/v5 worker/runtime files were recovered. Experiment and legacy files are kept as forensic source in `recovered-remaining/`; they are separate deployments and are not part of the main-site serving tree.
- The local assistant reproduces the observed four-request shape but uses deterministic project matching. It is not the original private model/service. A separate 65-project probe found one unresolved `E.C.H.O.` → `echo` slug mismatch.
- The local WebSocket server covers several core room operations. Full original protocol parity, WebRTC behavior, reconnect/failure cases, and browser-driven interactions remain unverified.
- WebGL 2 scene startup, visual parity, and real desktop/mobile walkthroughs remain open. The project is not Phase 1 complete.

## Documentation entry points

1. [Phase 1 Status and Parity Matrix](docs/PHASE-1-PARITY-MATRIX.md) — current status, evidence, blockers, and acceptance checklist.
2. [Phase 1 Reconstruction Plan](docs/PHASE-1-RECONSTRUCTION-PLAN.md) — the intended phase sequence and definition of done.
3. [Phase 1 Live Audit](docs/PHASE-1-LIVE-AUDIT.md) — live hashes, runtime routes, services, and limitations.
4. [Baseline Status](docs/BASELINE-STATUS.md) — concise verified/unverified ledger.
5. [Claude Handoff](docs/CLAUDE-HANDOFF.md) and [Claude Start Prompt](docs/CLAUDE-START-PROMPT.md) — implementation context and next-session starting point.
6. [Backend Research](docs/BACKEND-RESEARCH.md), [Architecture](docs/BACKEND-ARCHITECTURE.md), [Data Model](docs/BACKEND-DATA-MODEL.md), [API Contract](docs/BACKEND-API-CONTRACT.md), and [Implementation Brief](docs/BACKEND-IMPLEMENTATION-BRIEF.md) — design proposals, not a claim that the planned production backend already exists.

## Git/repository note

The recovered workspace and Phase 1 docs were committed locally and then pushed to `origin/main` by the repository owner. The loader-stall fix plus the offline media store integration and the SSR deep-link og:image fix are isolated on `fix/loader-stall-45` (local commits through `6d81134`); they have not been merged or pushed.
