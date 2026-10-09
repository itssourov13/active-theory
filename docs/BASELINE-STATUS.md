# Phase 1 Baseline Status

**Audit date:** 2026-10-09
**Workspace:** `/home/kali/web_atk/3D-web2/gpt-project/phase1-claude-handoff-source/activetheory-production-rebuild`
**Current phase:** Phase 1 — faithful reconstruction only
**Decision:** **NOT COMPLETE**; end-to-end visual and interaction acceptance criteria remain open.

This file is the concise evidence ledger. See [PHASE-1-PARITY-MATRIX.md](./PHASE-1-PARITY-MATRIX.md) for the full checklist.

## Verified baseline

- Live `https://activetheory.net/` root HTML matched local `app/public/index.html` by SHA-256 during the audit.
- Selected core V6 resources fetched from the live site matched local bytes: main app bundle, module stub, Hydra worker, UIL data, compiled shader, unsupported page, a regular font, and representative home/logo geometry. Expected hashes are pinned in `scripts/verify.mjs`.
- The manifest verifier passed in a recorded run: **379/379** manifest entries were present with expected sizes; all pinned core hashes passed.
- The asset fetch report records **157 downloaded, 213 skipped/reused, 0 failed, and 0 declared-size mismatches**.
- Captured live `metadata-dev.json`, `contact-dev.json`, and `projects-dev.json` were reported identical to their local captured copies. CMS snapshots contain **65 project records** and **161 media records** per environment snapshot.
- The ZIP extraction smoke check found **440/440** archive paths with no missing/extra files or size mismatches. This was a path/size comparison, not a byte-for-byte content hash of every extracted file.
- `npm run smoke` passed **19/19** checks in the latest recorded run. Coverage includes route/static serving, missing-resource status, traversal rejection, CMS snapshot serving, one allowlisted media fetch and cache/range behavior, the four-request local assistant flow, and a basic two-client WebSocket room join/state/disconnect flow.
- The local integration bridge routes CMS requests to the captured same-origin CMS and the four original assistant request names to the local adapter without modifying the recovered main app bundle.
- The server derives an allowlist of **764 unique public GCS media URLs** from captured CMS JSON and caches media on demand under ignored `.artifacts/media-cache/`.
- A follow-up local HTTP check returned 200 for `/`, `/studio/`, `/work/dream-portal`, `/unsupported`, and `/cms/projects-dev.json`; the CMS endpoint returned 65 project records. An unknown API route returned 404.
- The server was stopped after the live-preview request on 2026-10-09; a subsequent localhost request failed to connect, confirming the process was no longer serving port 4173 at that check.

## Implemented, but only partially parity-verified

- **CMS/media:** local snapshot bridge and allowlisted media proxy exist. The basic sample-image request, completed-file cache, HEAD, and byte-range behavior passed the smoke test. The hundreds of CMS-referenced media assets are not all bundled locally; they are requested on demand. Live browser verification across video/audio/image variants and network failures remains open.
- **Assistant:** the local server supports `createThread`, `createMessage`, `createRun`, and `listMessage` with observed payload shapes. The adapter deterministically matches captured catalog data; it does not reproduce the original private model, prompt, thread persistence, or response semantics. A separate ad-hoc run across all 65 project prompts produced one mismatch: `E.C.H.O.` expected slug `echo`, received an empty slug. This is not covered by the 19-check smoke suite.
- **Realtime:** `scripts/local-realtime.mjs` now implements the basic WebSocket handshake and several room events, including room discovery, create/join/watch/leave, participant state, and data/signalling relays. The smoke suite covers only a basic join/state/disconnect sequence. Full parity with the original server protocol, WebRTC, reconnection, timeout, watcher promotion and degraded-network behavior has not been established.
- **Original runtime:** the opaque recovered V6 client remains in `app/public/` rather than being rewritten into maintainable modules. `src/` currently contains only migration guidance. This preserves the original runtime but does not complete a source migration.

## Open acceptance blockers

1. **WebGL 2 / immersive scene:** available headless Chromium exposed WebGL 1 only under a SwiftShader configuration, not WebGL 2. Local and automated live attempts were redirected to `/unsupported.html`. A hardware-accelerated, WebGL-capable browser/device is still required. Do not infer visual parity from HTTP or hash checks.
2. **Visual and interaction parity:** scene geometry/rendering, shaders, particles, lighting, camera/scroll choreography, transitions, project navigation, input handling and responsive behavior have not had a supported-device walkthrough.
3. **Desktop and mobile:** real viewport walkthroughs, touch controls, keyboard/pointer behavior and route/deep-link transitions remain unverified.
4. **Media and optional integrations:** sample-image checks passed, but the whole live media set has not been exercised; audio/voice/TTS, microphone permission/denial, geolocation/consent, service worker, offline/reconnect and degraded-network cases remain open.
5. **Assistant completeness:** fix and retest the observed E.C.H.O. slug mismatch if implementation work is authorized; broaden conversational/ambiguous-query tests while continuing to label the private model as an approximation.
6. **Realtime parity:** expand protocol-level tests and test against the original client's actual message/event sequence. Do not claim that passing one room smoke test means the original realtime service is fully recreated.
7. **Production backend:** the Fastify/PostgreSQL/search/voice/upload/analytics architecture in the backend documents is a target design. It is not currently implemented as a production backend in this workspace.
8. **Parity matrix and final sign-off:** mark every subsystem verified, approximated or unresolved with evidence; then rerun the full acceptance checklist on a supported browser/device.

## Commands and interpretation

From the workspace root:

```bash
npm run start     # start local server at 127.0.0.1:4173
npm run smoke     # run with the server already running
npm run verify    # verify manifest, critical hashes and CMS snapshots
```

The recorded PASS values describe the last observed executions, not a guarantee that upstream network resources remain available now. The smoke suite's sample-media test requires the object to be reachable if it is not cached. Port 4173 was confirmed stopped after the preview session.

## Repository and change boundary

At the start of the documentation task, this extracted workspace had no `.git` directory and the target GitHub repository was empty. No earlier local Git history existed to compare against. The intended first repository commit must include the existing recovered workspace without changing its application/source files; documentation is the only authorized edit surface for this task.

## Guardrails

- Do not modify `vendor/forensic/*`.
- Do not replace verified original bundles/assets with approximation.
- Do not begin Phase 2 customization.
- Keep inferred behaviors explicitly labelled as approximations until compared with live evidence.
- Do not claim Phase 1 complete until all blocking acceptance criteria are evidenced.
