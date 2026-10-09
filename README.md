# Active Theory Production Rebuild

A reconstruction workspace for the Active Theory V6 live experience, assembled from the current `activetheory.net` deployment and the local forensic archive.

## Project status

**Phase 1 — faithful live reconstruction: INCOMPLETE.**

The recovered browser runtime, supporting assets, captured CMS data, local media proxy, a deterministic assistant adapter, and a basic local realtime service are present. Asset verification and the current automated smoke suite have passed in recorded runs. This does **not** establish full visual or interactive parity: the available headless browser did not provide WebGL 2, so the original immersive scene has not yet been verified on a hardware-accelerated browser/device.

See [Phase 1 Status and Parity Matrix](docs/PHASE-1-PARITY-MATRIX.md) for the single current checklist and evidence summary. Read [Baseline Status](docs/BASELINE-STATUS.md) and [Live Audit](docs/PHASE-1-LIVE-AUDIT.md) for supporting detail.

## Workspace map

- `app/public/` — assembled original V6 runtime and recovered public assets.
- `app/cms-reference/` — captured production/staging/dev CMS snapshots.
- `vendor/forensic/current-v6/` — forensic reference copy; do not modify.
- `vendor/forensic/legacy-v5/` — historical worker/runtime reference; do not modify.
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

- `npm run verify` has passed in a recorded run: 379/379 manifest entries and the selected live-pinned hashes passed.
- `npm run smoke` has passed in a recorded run: 19/19 checks, including the basic two-client realtime room flow.
- The CMS snapshots contain 65 projects and 161 media records per environment snapshot. The runtime's public media references are proxied through a CMS-derived allowlist and fetched/cached on demand.
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

The supplied workspace initially had no Git metadata. The repository `itssourov13/active-theory` was empty when checked on 2026-10-09. The initial local repository commit is intended to capture the recovered workspace plus documentation; it must be pushed manually by the owner. No remote push is part of this task.
