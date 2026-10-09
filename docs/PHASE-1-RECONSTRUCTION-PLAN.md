# Phase 1 — Live-Faithful Reconstruction Plan

Date: 2026-10-09

## Objective and phase boundary

Reconstruct the Active Theory V6 live experience from the recovered handoff package as faithfully and completely as practical. The recovered runtime and its original assets are the primary source of truth; the current live site is the reference for gaps, current content, route behavior, and missing assets or service contracts.

**Phase 1 only.** Do not begin premium customization, a new visual direction, extra showcase features, or general enhancement work. Preserve the original presentation and interaction language. Phase 2 requires a separate explicit start after Phase 1 is reviewed.

## Source-of-truth order

1. The extracted Claude handoff package in this workspace, including `app/public/`, captured CMS snapshots, `vendor/forensic/current-v6/`, legacy worker references, and existing forensic documents.
2. Directly verified live HTML, bundles, static assets, public CMS objects, and observable browser/network behavior.
3. Existing captured findings and backend/API contracts, revalidated when possible.
4. Evidence-based compatible implementations for behavior that cannot be recovered. Mark assumptions; do not present guesses as recovered originals.

Do not modify `vendor/forensic/*`. Keep original client bundles untouched wherever possible. If a local integration adapter is needed, preserve the original bundle as reference and document the minimum compatibility change.

## Work packages

### P0 — Freeze and verify the recovered baseline

- Keep the extracted handoff workspace as the only active starting point.
- Maintain explicit SHA-256 pins for selected live-verified runtime files.
- Verify the manifest-tracked public assets and the captured CMS snapshots.
- Keep the runtime boot command and asset verification command working.
- Avoid dependency installation or broad refactors until evidence shows they are needed.

### P1 — Establish a real browser baseline

- Test the root page and key runtime resources locally.
- Test with a supported, hardware-accelerated browser/device that exposes the WebGL context required by the live runtime; the recorded headless/SwiftShader environment exposed WebGL 1 but not WebGL 2 and was insufficient.
- Capture desktop and mobile reference states, console errors, failed requests, navigation states, and loading behavior.
- Separate environment limitations (for example, headless Chromium with no WebGL context) from genuine application failures.
- Do not mark visual parity complete on the basis of HTTP status checks alone.

### P2 — Build a live-to-local parity map

For every important area, record: live evidence, recovered implementation/assets, current local behavior, gap, and verification method.

Required areas:
- initial load, browser/device capability detection, loading and unsupported fallback
- scene geometry, particles, shaders, lighting, camera choreography and transitions
- main navigation, routes/deep links, project selection and project-detail behavior
- scroll/pointer/touch/keyboard interactions and responsive behavior
- media, audio, fonts, textures, workers, service worker, and caching
- CMS content and all required project/media records
- AI assistant, voice/TTS, geolocation/consent, realtime presence and other observed service calls
- failure behavior when network, GPU, microphone, or optional services are unavailable

### P3 — Close static/runtime gaps before rewriting anything

- Compare references from the recovered runtime against current live asset URLs and requests.
- Recover missing files from the live site where they remain publicly available.
- Validate exact bytes for important recovered assets where practical; file-size agreement alone is not proof of identity.
- Fix only confirmed missing, wrong, or incompatible runtime pieces.
- Prefer original code/assets over an approximation; do not recreate an already recovered component.

### P4 — Make the whole experience work end to end

- Confirm whether the original public CMS/media endpoints still function and whether their current data matches the captures.
- Probe externally visible API behavior safely; do not create remote sessions or send speculative mutation requests merely to test a route.
- Document the actual request methods, payloads, responses, state transitions, and errors for the AI and realtime integrations when observable.
- Where original private backend code is unavailable, implement a local compatible service from documented contracts and observed behavior. Keep provider credentials server-side and do not embed secrets in browser code.
- Use the captured CMS data as the local seed/reference data. Preserve IDs, slugs, tags, project/media relationships and ordering.
- Keep AI, voice and realtime failures graceful so they do not prevent the main 3D site from booting.

### P5 — Verify and report Phase 1 completion

Acceptance requires:
- reproducible local startup
- passing asset/integrity checks
- working root page and all discovered required routes
- no unexplained missing local runtime assets
- successful WebGL scene startup on a supported hardware-accelerated browser
- desktop and mobile interaction walkthroughs
- verified project/content navigation and media loading
- end-to-end checks for recreated APIs and optional services, with unavailable external dependencies explicitly documented
- a parity matrix that distinguishes verified matches, compatible approximations, and unresolved gaps
- updated run instructions and evidence-backed handoff notes

## Current state and immediate priority

The static recovered runtime passes its recorded asset verifier, and selected core files match the live deployment byte-for-byte. The CMS/media bridge, deterministic assistant adapter and a basic local WebSocket service are implemented, but they are not yet fully verified against original end-to-end behavior. The highest-priority blocker remains a supported WebGL 2 browser/device walkthrough. Do not infer visual parity from static asset or HTTP tests.

Use [PHASE-1-PARITY-MATRIX.md](./PHASE-1-PARITY-MATRIX.md) as the current acceptance checklist, [BASELINE-STATUS.md](./BASELINE-STATUS.md) as the concise evidence ledger, and [PHASE-1-LIVE-AUDIT.md](./PHASE-1-LIVE-AUDIT.md) for the recorded live/workspace audit evidence dated 2026-10-09.
