# Forensic Findings

## Verified baseline

- The local `site-current-v6` core bundle matches the live V6 deployment byte-for-byte for the main JS bundle, timestamped UIL JSON, module stub, and compiled shader bundle.
- The local forensic snapshot is therefore a trustworthy artifact baseline, but it is incomplete as a standalone deployment.

## Runtime architecture

The V6 bundle implements a custom Hydra-style runtime with:

- WebGL2 first, then WebGL/WebGL1 fallback.
- WebGL extension/capability detection and GPU identification.
- Worker-based runtime work and off-main-thread computation.
- OffscreenCanvas and ImageBitmap paths.
- Custom shader compilation and post-processing.
- Device-aware behavior and mobile branches.
- Service-worker registration and cache versioning.
- Remote CMS data loading from Google Cloud Storage.
- Optional AI/TTS integrations.
- Client-side routing/deep-link handling.

## Critical reconstruction gap found

The captured V6 folder omitted the runtime worker used by the app:

`assets/js/hydra/hydra-thread.js`

The live endpoint returns the worker, while the local snapshot did not contain it. A local Chromium smoke test confirmed repeated 404 failures for this worker before reconstruction.

The app also references fonts/icons/service-worker assets that were not present in the local snapshot but are served by the live site.

## Content and media model

The local CMS archive contains 65 project records for production/staging/dev and includes structured project metadata and GCS media URLs. The runtime consequently has strong remote coupling and is not intrinsically offline-reproducible.

## Security findings

A workspace-wide pattern scan found credential-shaped OpenAI/Google API-key strings in multiple historical experiment bundles. The current V6 bundle contains obvious placeholder OpenAI/ElevenLabs values rather than a usable secret. Historical experiment bundles should still be treated as potentially sensitive until their values are confirmed, revoked, or proven synthetic.

No AWS access keys, GitHub PATs, or private-key blocks were found by the pattern scan.

## Live headers observed

Current `activetheory.net` root response includes:

- HSTS
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- legacy `X-XSS-Protection`

A modern CSP/Referrer-Policy/Permissions-Policy stack was not observed in the audited root response.

## Accessibility/SEO observations

The HTML shell is intentionally minimal and renders most experience content after JavaScript/WebGL startup. This is appropriate for the original immersive experience but weakens no-JS resilience, text accessibility and traditional SEO. The viewport metadata also disables user scaling.

## Reference generations

`legacy-v4`, `legacy-v5`, and the large `experiments` corpus are valuable as architectural references. In particular, the legacy V5 tree contains a Hydra worker implementation that helps understand the missing V6 runtime layer.
