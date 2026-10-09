# Phase 1 — Live/Workspace Audit

Audit date: 2026-10-09

## Workspace and archive

Active workspace:

`/home/kali/web_atk/3D-web2/gpt-project/phase1-claude-handoff-source/activetheory-production-rebuild`

Input archive:

`/home/kali/web_atk/3D-web2/gpt-project/activetheory-production-rebuild-claude-handoff.zip`

The archive and the copy in `/home/kali/web_atk/3D-web2/` previously had the same SHA-256:
`330f519d8099984dbd9d2af2b650084d98e13d2e1286ff206c976dbdb51f6d89`.

The extracted workspace smoke test found 440/440 archive files, zero missing files, zero extra files and zero size mismatches. Per-file content hashes were not used for the extraction smoke test.

At the time of the original workspace audit, this extracted folder had no Git metadata, so that audit did not create a branch or commit. The target GitHub repository was checked separately during the documentation closeout; it was empty at that time.

## Verified live identity

Direct requests to `https://activetheory.net/` returned HTTP 200. The live root HTML is 5,952 bytes and its SHA-256 matches local `app/public/index.html`:

`e026e78b8db8823da1d2256fd7b011aa016b971d2bbd64e72e98f440f46626d5`.

The following local files were fetched from the live domain with HTTP 200 and their complete byte streams matched SHA-256 locally:
- `assets/js/app.1780406240914.js`
- `assets/js/modules.1780406240914.js`
- `assets/js/hydra/hydra-thread.js`
- `assets/data/uil.1780406240914.json`
- `assets/shaders/compiled.vs`
- `unsupported.html`
- `assets/fonts/NBArchitektStd-Regular-export/NBArchitektStd-Regular.woff2`
- `assets/geometry/home/jellyfish.json`
- `assets/geometry/logo/AT_logo.json`

Live-checked critical hashes are now pinned in `scripts/verify.mjs`. The `vendor/forensic/*` material remains reference-only.

## Asset and content status

`npm run verify` passes after adding the extra live-verified hash pins:
- 386/386 manifest-tracked runtime assets are present and pass the declared-size checks, including seven runtime dependencies restored during the loader-stall investigation.
- The fetch report records 157 downloaded assets, 213 skipped/reused assets, zero failed downloads and zero declared-byte mismatches.
- Main runtime code, worker, shader, UIL config, unsupported page, fonts and representative recovered geometry are verified byte-for-byte against the live site.

The CMS capture contains 65 projects and 161 media records in each environment snapshot. Direct live comparisons for these public CMS objects matched the local captured dev snapshot exactly:
- `metadata-dev.json` — 4,326 bytes
- `contact-dev.json` — 780 bytes
- `projects-dev.json` — 215,696 bytes

The matching live `*-dev.json` objects returned HTTP 200. The corresponding `*-latest.json` paths tested returned HTTP 404. The bundle selects `dataVersion = window.PROD ? "latest" : "dev"`; the captured root HTML sets `window._ENV_ = 'production'`, not `window.PROD`. Do not force the client to use `latest` without further evidence, because those tested objects currently 404.

## Local server smoke test

The existing dependency-light static server starts at `http://127.0.0.1:4173`. These resources returned HTTP 200 locally:
- `/` and `/index.html`
- main app bundle
- Hydra worker
- UIL JSON
- compiled shader
- unsupported background image
- primary font
- service worker

This confirms static serving, not visual parity or complete end-to-end functionality.

The Phase 1 server was hardened after a smoke test exposed a false-success problem: previously, missing asset/API paths could return the site shell with HTTP 200. It now maps `/unsupported` to the captured `unsupported.html`, preserves SPA fallback for application routes such as `/studio/` and `/work/dream-portal`, returns 404 for missing static/API paths, and rejects parent-directory traversal with HTTP 400.

The server now maps the runtime's captured CMS requests to the local CMS snapshots and rewrites their GCS media references to `/media-cache/<sha256-url>`. Its media proxy only serves URLs found in captured CMS JSON, handles HEAD and byte-range requests, streams files from the public GCS media bucket on demand, and caches completed full downloads under ignored `.artifacts/media-cache/`. This avoids downloading all referenced media up front: the CMS inventory has 764 unique GCS media URLs, with 676 known sizes totaling about 1.28 GB (other references have no file-size metadata).

A local bridge is injected into the HTTP response immediately before the original inline bootstrap. The bridge maps the unchanged runtime's GCS CMS fetches and the four known assistant POST routes to the local server; the source HTML and recovered V6 bundle stay unchanged. A browser automation smoke test confirmed the CMS bridge returned all 65 projects and that the assistant sequence returned the expected `dream-portal` slug through same-origin requests.

The local assistant endpoints implement the observed `createThread`, `createMessage`, `createRun`, and `listMessage` request/response shapes. Because the original model/service internals are private and were not safely mutated during research, local `createRun` is a deterministic catalog-matching approximation; it is not claimed to reproduce the original model behavior. The local WebSocket service has since been implemented for core room events and passes a basic two-client smoke test, but its full event protocol, WebRTC signalling/relay behavior, reconnect semantics, watcher/host transitions and failure paths remain only partially verified.

The current `fix/loader-stall-45` branch passes `npm run smoke` at 26/26 checks and `npm run verify` at 386/386 manifest entries with pinned core hashes. Seven previously absent dynamic resources were restored from `https://activetheory.net/`: the three SDF font JSON files, Draco JS/WASM, and Basis transcoder JS/WASM. Their hashes are pinned in `scripts/verify.mjs`, their sizes are recorded in the manifest, and `.wasm` is served as `application/wasm`. Before restoration these seven requests returned local HTTP 404 during an instrumented load; afterward all seven returned 200 and the loader progressed past the reported ~45% to ~75% at the 35-second checkpoint. This proves the missing-resource defect was real and the fix improves startup, but the scene still needs a complete run and a supported hardware-accelerated browser walkthrough. The test-only WebGL/GPU override used for diagnostics was injected by the external test harness; it is not part of the repository and must not be used as a production bypass. The smoke suite does not prove full visual parity or comprehensive protocol coverage. A separate ad-hoc assistant probe tested all 65 captured project prompts and found one unresolved mismatch: E.C.H.O. was expected to produce slug `echo` but returned an empty slug.

## Browser limitation observed

The live browser-automation environment showed `/unsupported.html` with `Your browser is not supported`. Normal headless Chromium also follows the runtime GPU-blocklist/unsupported path. The local diagnostic harness could create WebGL 2 using SwiftShader, but the app also checks its GPU eligibility/blocklist; only that external diagnostic session injected a test override to reach the scene bootstrap. After the missing runtime dependencies were restored, the same instrumented session stayed on the home route and reached approximately 75% at both the 35-second and 90-second checkpoints, with no same-origin HTTP errors. The diagnostic state reported `Global/loadComplete` but not `Global/loadFinished`; the expected `FXScroll/firstScene` readiness event was absent. A separate run of the test-only bypass exposed a WebGL render exception under the unsupported software-renderer setup, so this is not valid evidence of a supported-device startup failure. Do not force the loading percentage to 100 or weaken the production GPU check. The missing-resource fix is verified, but final loader completion and visual parity must be confirmed on the user's supported WebGL 2 hardware/browser.

Chromium's current SwiftShader behavior is a software-rendering test path, not evidence of a normal hardware browser's capabilities. A hardware-accelerated WebGL-capable browser/device is required to validate real scene rendering, camera/scroll choreography, particles, transitions, touch behavior and visual parity. These checks remain open; the live site is not considered down based on this automation result.

## Recovered service contracts observed in the original bundle

- Public CMS JSON: `https://storage.googleapis.com/activetheory-v6.appspot.com/cms/{metadata|contact|projects}-{dataVersion}.json`
- Geolocation: `https://us-central1-at-services.cloudfunctions.net/geo` (GET returned HTTP 200)
- AI assistant base: `https://backend-dot-activetheory-v6.uc.r.appspot.com/api/assistant`, with observed `createThread`, `createMessage`, `createRun`, and `listMessage` POST operations
- Realtime WebSocket: `wss://s.dreamwave.network/ws`
- The bundle also references OpenAI, ElevenLabs, Vosk assets and a GCS upload path.

The assistant endpoint was probed with HEAD/GET (404) and OPTIONS (204 with the expected allowed methods). A GET/HEAD 404 does not establish that the documented POST routes are unavailable. No live assistant POST was sent and no remote thread/session was created during research. The private model's prompt, state, response semantics and realtime server internals remain unobservable; local assistant behavior is explicitly an approximation. WebSocket message contracts can be seen in the client bundle, but the server's full response behavior remains unverified.

## Remaining implementation gaps

- `src/` contains only its README. The original V6 runtime is being preserved for fidelity; source extraction should only be considered where it demonstrably helps Phase 1 and does not replace recovered behavior.
- `tests/` has no dedicated test modules yet, although `scripts/smoke-test.mjs` provides 26 reproducible integration checks on this branch.
- Local CMS and allowlisted media proxy work, but the majority of project video media should be sampled for real browser loading and seek/range behavior.
- The deterministic assistant adapter matches the observed payload shapes and basic catalog navigation, but not private model behavior. Verify it against actual expected flows in a browser and label remaining differences.
- The local WebSocket implementation covers a subset of the original protocol, including room discovery/creation, join/watch/leave, state updates, participant notifications, and selected `establish_rtc` / `ws_data` relays. The original client also uses `findAny`, `create`, `join`, `watch`, `leave`, `request_state`, `alive`, `establish_rtc`, `ws_data`, `update_user_data`, `pin`/`unpin`, and player notifications. Full event-by-event parity, room capacity/timeouts, host/watcher transitions, RTC negotiation, fallback behavior and reconnects are not established.
- Audio/voice and microphone permissions, optional Vosk/TTS integrations, and geolocation denial/fallback flows need separate end-to-end checks.
- Static integrity and interaction contract smoke tests do not substitute for a WebGL 2-enabled visual walkthrough.

## Next actions (Phase 1 only)

1. Expand local WebSocket protocol tests against the original client's observed event sequence, including RTC relay/fallback, watcher/host transitions, room timeouts, reconnects and malformed/disconnected clients; then verify from a supported browser/device where the runtime permits it.
2. Use the same-origin browser bridge to verify the full real runtime bootstrap, CMS loading and media requests. Test several media types, especially MP4 byte ranges and failed upstream requests.
3. Test assistant question-to-project navigation with a broader set of captured projects; retain explicit approximation notes for the private model behavior.
4. Validate loading, voice, geolocation denial, reconnect and degraded-network behavior.
5. Run desktop/mobile interaction walkthroughs on a supported WebGL 2 browser/device and compare camera/scene checkpoints with live.
6. Keep Phase 2 redesign/enhancement out of scope until Phase 1 parity has been reviewed.
