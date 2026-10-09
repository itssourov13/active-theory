# Claude Implementation Brief

## Mission

Use this workspace as the starting point for a production-grade rebuild and upgrade of the Active Theory V6-style site.

The objective is **not** to blindly rewrite the experience. Preserve the visual language, spatial storytelling, shader quality, camera choreography, tactile interaction, and high-end creative direction while turning the captured artifact into maintainable production software and then adding carefully designed new capabilities.

## Source of truth hierarchy

1. `app/public/` — assembled current-runtime baseline that should boot locally first.
2. `app/cms-reference/` — captured V6 CMS content for reconstruction/reference.
3. `vendor/forensic/current-v6/` — immutable forensic snapshot; never edit it.
4. `vendor/forensic/legacy-v5/` — legacy Hydra worker reference.
5. `docs/FORENSIC-FINDINGS.md` — verified architecture observations.
6. `docs/PRODUCTION-REBUILD-PLAN.md` — phased product/engineering roadmap.
7. `docs/BACKEND-RESEARCH.md` — current backend research and engineering decisions.
8. `docs/BACKEND-ARCHITECTURE.md` — target backend topology and technology boundaries.
9. `docs/BACKEND-DATA-MODEL.md` — normalized database model.
10. `docs/BACKEND-API-CONTRACT.md` — public HTTP/realtime contract.
11. `docs/BACKEND-IMPLEMENTATION-BRIEF.md` — backend implementation order and acceptance criteria.

## Working method

First establish a green local baseline. Do not redesign anything before the baseline runtime is verified.

Then progressively introduce a source architecture around the existing runtime concepts. Prefer extraction/adaptation over an immediate full rewrite. Keep renderer, scene, content, media, interaction, AI, audio, and networking boundaries explicit.

All changes should be validated with:

- type/lint checks once source code exists
- asset-integrity checks
- local smoke boot
- desktop and mobile browser checks
- WebGL context validation
- no console/page errors on supported hardware
- performance checks for startup, frame time, memory, GPU pressure, and asset decode

## Product direction

The rebuilt site should become a platform for:

- immersive portfolio storytelling
- richer project discovery
- AI-assisted portfolio navigation/search with a secure server-side integration
- optional multiplayer/presence experiences
- progressive asset loading and device-aware rendering
- accessibility and graceful fallback
- analytics/observability without compromising performance or privacy
- modern security headers and strict secret handling
- modular scene/feature delivery so future experiments do not inflate the first load

## Important rule

Do not put private API credentials in browser bundles. AI/voice/multiplayer credentials must be server-side or use a deliberately public anonymous mechanism.
