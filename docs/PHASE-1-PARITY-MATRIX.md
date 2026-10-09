# Phase 1 Status and Live-to-Local Parity Matrix

**Status date:** 2026-10-09
**Overall status:** **INCOMPLETE — implementation and automated smoke tests are not equivalent to full live-site parity.**
**Scope:** faithfully reconstruct the current Active Theory V6 experience. Phase 2 redesign/customization is out of scope.

This matrix is the current decision checklist. Use these status meanings:

- **Verified:** an observable check or direct byte comparison supports the claim.
- **Partial:** some implementation or narrow tests exist, but the original behavior is not fully exercised.
- **Open:** no sufficient end-to-end evidence exists yet.
- **Approximation:** compatible local behavior is intentionally inferred because private original service internals are not available.

## 1. Evidence snapshot

| Area | Current evidence | Status |
|---|---|---|
| Original V6 HTML and selected core runtime assets | Selected files fetched from live and matched local SHA-256; pins are in `scripts/verify.mjs` | Verified for listed files |
| Manifest-tracked assets | Current branch `npm run verify`: 386/386 present; zero reported download failures and declared-size mismatches; seven dynamic runtime dependencies additionally hash-pinned | Verified for manifest scope |
| Entire forensic ZIP extraction | 440/440 archive paths, no path or size mismatches; every file was not independently hash-compared | Partial |
| Public CMS capture | 65 projects and 161 media records per environment snapshot; selected live JSON comparisons matched | Verified for capture/selected comparisons |
| Local HTTP serving | Root, representative application routes, unsupported page and known assets returned expected responses in recorded checks | Verified for those routes only |
| CMS integration bridge | Same-origin CMS request mapping and captured project response were tested | Partial |
| Media proxy | Allowlisted sample image, cache, HEAD and byte-range checks passed | Partial |
| Assistant API shape | Four local actions pass the basic smoke flow; an ad-hoc 65-project probe found one slug mismatch | Partial / approximation |
| Realtime WebSocket | Basic two-client room join, state sync, and disconnect smoke passed | Partial |
| WebGL 2 scene startup | Automated/headless test environment lacked WebGL 2 and displayed unsupported fallback | Open |
| Scene/animation visual fidelity | No supported-device live-to-local walkthrough evidence | Open |
| Desktop/mobile interaction parity | No full supported-device walkthrough evidence | Open |
| Media variants, audio/voice, geolocation and service worker | Insufficient end-to-end evidence | Open |
| Production backend defined in backend design docs | The proposed Fastify/PostgreSQL service is not implemented here as a complete production backend | Open |
| Final Phase 1 sign-off | Several required acceptance criteria are open | Not approved |

## 2. Baseline and recovery evidence

The recovered `app/public/` runtime and `vendor/forensic/*` references remain the primary evidence. The original main client bundle is intentionally not rewritten. The local server injects `app/public/phase1-local-bridge.js` into the root HTML response to reroute selected requests; the on-disk original HTML and recovered V6 bundle stay unchanged.

Recorded verification results:

- `npm run verify`: **PASS**, 386/386 manifest entries, pinned core hashes passed.
- Asset fetch report: **157 downloaded, 213 skipped/reused, 0 failed, 0 declared-size mismatches**.
- `npm run smoke`: **PASS**, 26/26 checks on `fix/loader-stall-45`.
- Selected live CMS objects (`metadata-dev.json`, `contact-dev.json`, `projects-dev.json`) matched captured files in the audit.
- The ZIP extraction test compared relative paths and sizes for 440 files; it was not a per-file hash proof for the entire archive.

These results establish a strong recovered/static baseline, not the rendering quality of the full experience.

## 3. Subsystem parity details

### 3.1 Bootstrap, routes and browser capability

**Implemented/observed:** local root serving, SPA fallback for application routes, explicit unsupported route, serving of selected static runtime assets, 404 for missing static/API paths, and 400 rejection of the tested traversal path. The automated suite covers `/`, `/studio/`, `/work/dream-portal`, `/unsupported`, selected assets and negative paths.

**Open:** verify all discovered routes and deep links in a supported real browser, along with cold load, refresh, back/forward navigation, capability detection and failures.

### 3.2 WebGL rendering and motion

**Open — highest priority.** The test harness can create WebGL 2 through SwiftShader, but normal runtime startup follows its GPU-blocklist/unsupported path. With an external test-only GPU eligibility override and after restoring seven missing runtime dependencies, the loader moved from the reported ~45% to ~75% at a 35-second checkpoint without same-origin HTTP errors. That is evidence the missing resources were a real defect, not proof of final scene completion; the full 3D experience still requires a complete run and supported hardware-accelerated browser/device walkthrough.

Required evidence: supported hardware-accelerated WebGL 2 browser/device; initial scene capture; geometry, shaders, particles, lighting/materials; camera paths; scroll/touch transitions; resize/orientation; desktop and mobile checkpoints; console and network logs. Compare equivalent states to the current live website and record visible differences.

### 3.3 Content and media

**Implemented/partial:** captured CMS snapshots are available locally. CMS media URLs are rewritten to local hashed routes, and a CMS-derived allowlist controls the upstream public media proxy. The proxy streams on demand, caches completed full responses, supports HEAD and byte ranges, and avoids pre-downloading the entire media collection.

**Open:** representative and broad playback tests for still images, MP4 and other video formats, thumbnails, range seeking, failed upstream requests, missing assets, cache corruption, long downloads, offline/reconnect and mobile autoplay/gesture restrictions. Hundreds of media URLs are not bundled as local files, so the project is not fully offline.

### 3.4 Assistant

**Implemented/approximation:** a local bridge maps the four observed request names (`createThread`, `createMessage`, `createRun`, `listMessage`) to a local deterministic catalog-matching adapter. The recorded smoke test proves the basic Dream Portal request flow and invalid-thread/wrong-method handling.

**Known issue:** a separate probe sent prompts for all 65 captured projects and found one mismatch: the `E.C.H.O.` prompt expected slug `echo`, but returned an empty slug. This probe is separate from `npm run smoke`, so the 26/26 smoke result does not close this issue.

**Not equivalent to the original:** private model, prompt, conversation storage and original response semantics are unavailable. The local adapter must be described as deterministic compatibility behavior, not a recovered original AI backend.

### 3.5 Realtime and WebRTC

**Implemented/partial:** the local WebSocket server includes room discovery/creation, join, watch, leave, participant-state broadcast, disconnect notification and selected data/signalling relay events. The latest recorded smoke test covered two clients joining the same room, state request and disconnect.

**Open:** event-by-event comparison with the original client, room capacity and timeout semantics, host transfers, watcher promotion, data payload variants, RTC negotiation, relay fallback, ping/alive handling, reconnect, dropped connections, cleanup, malformed frames and multi-room isolation. A narrow local test is not proof of full service parity.

### 3.6 Voice, geolocation, service worker and graceful failure

**Open:** microphone permission granted/denied, Vosk/audio resource loading, TTS availability/failure, consent and geolocation-denied behavior, service-worker install/update/offline paths, GPU/browser fallback, optional-service outage and degraded-network behavior.

### 3.7 Maintainable source and production backend

The original runtime remains under `app/public/`; `src/` currently contains only `src/README.md`. Incremental source extraction is deliberately deferred until it can be regression-compared with the preserved client. This means the project is not yet a clean maintainable rewrite.

The Fastify/PostgreSQL/pgvector, production session, voice, secure media-upload, analytics, rate-limit and deployment plans in the backend documents are **proposals for a later implementation stage**. The current `scripts/server.mjs` is a dependency-light reconstruction adapter, not that production backend. Do not describe planned services as implemented.

## 4. Required closeout checklist

Phase 1 must not be marked complete until each item is either evidenced as passing or explicitly accepted as an unresolved external dependency by the project owner.

- [x] Local startup command and port are documented.
- [x] Selected core assets and the manifest have a reproducible verification script.
- [x] CMS snapshots and their basic local serving path are verified.
- [x] Basic local assistant and WebSocket contract smoke tests exist.
- [ ] WebGL 2 scene starts on supported hardware-accelerated browser/device.
- [ ] Current live site and local site have comparable desktop visual checkpoints with notes.
- [ ] Mobile visual checkpoints and touch interactions are compared on a real supported device.
- [ ] Root, all known deep links, browser history and project selection work end to end.
- [ ] Media variants, byte-range seeking, cache behavior and failure fallbacks are exercised broadly.
- [ ] Assistant mapping edge cases are resolved/tested or logged as accepted differences.
- [ ] Realtime protocol, WebRTC/fallback relaying, reconnection and failure paths are tested.
- [ ] Voice/TTS, microphone permissions, geolocation/consent and service-worker behavior are tested or explicitly marked unavailable.
- [ ] Console errors and failed requests are reviewed during supported-device walkthroughs.
- [ ] A final parity report labels each area verified, approximation or unresolved.
- [ ] Run instructions and docs match the implementation; Phase 1 is reviewed before Phase 2 is authorized.

## 5. How to verify

Start the server in one terminal:

```bash
npm run start
```

In another terminal, with the server running:

```bash
npm run smoke
```

Asset/CMS/hash verification can run separately:

```bash
npm run verify
```

The smoke suite performs a live public-media fetch if its sample is not cached. It therefore depends on upstream availability in that case. Record the full command output and browser/device details when collecting new evidence.

## 6. Safe execution boundaries

- Keep `vendor/forensic/*` immutable.
- Preserve recovered client bundles and hashes; only make minimal, evidence-backed compatibility adjustments when implementation work is authorized.
- Do not redesign or add Phase 2 features during parity work.
- Do not put provider credentials in browser code.
- Use test rooms and local data for integration tests; avoid mutating remote private services.
- The local server currently binds to loopback (`127.0.0.1`) and should not be exposed publicly as-is.
