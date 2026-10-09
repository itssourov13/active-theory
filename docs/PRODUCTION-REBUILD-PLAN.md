# Production Rebuild Plan

> **Roadmap interpretation:** this is a broad, longer-term engineering roadmap. Its internal Phase 0–10 labels are a separate roadmap sequence, not the current user-directed Phase 1 completion checklist. The active scope and acceptance criteria are defined by `docs/PHASE-1-RECONSTRUCTION-PLAN.md` and tracked in `docs/PHASE-1-PARITY-MATRIX.md`. The later source-extraction, production backend, and product-upgrade items below are proposals/roadmap work, not claims of implemented functionality.

## North star

Build a maintainable, production-grade immersive creative website that keeps the strongest qualities of the V6 experience while gaining the engineering qualities expected from a modern production application.

### Preserve

- High-end spatial art direction.
- Shader-driven materials, lighting, refraction and particles.
- Camera-led storytelling and scroll-driven composition.
- Tactile pointer/touch interactions.
- Strong typography and restrained visual system.
- Device-aware rendering strategy.
- Experimentation as a first-class capability.

### Improve

- Source architecture and readability.
- Asset loading and caching.
- Mobile performance and battery behavior.
- Accessibility and graceful fallback.
- Secure AI/voice/multiplayer integrations.
- Content/data abstraction.
- Observability and error reporting.
- Testing and regression coverage.
- Deployment reproducibility.

## Phase 0 — Runtime reconstruction

Goal: reproduce the current experience locally before changing behavior.

1. Complete the static V6 asset set from the live deployment.
2. Verify Hydra worker, fonts, icons and service worker.
3. Verify geometry/material/image inventories against their declared byte sizes.
4. Boot the assembled runtime on a local static server.
5. Validate WebGL context creation and capture console/page/network errors.
6. Preserve the forensic copy as immutable reference.

Exit condition: the local assembled baseline boots without missing runtime assets on supported hardware.

## Phase 1 — Source architecture extraction

Move from one monolithic runtime bundle to explicit source boundaries without changing the visual output.

Suggested boundaries:

```text
src/
  app/
  runtime/
  renderer/
  scenes/
    home/
    about/
    work/
    tree/
    clean-room/
    footer/
  interaction/
  content/
  media/
  ai/
  presence/
  audio/
  workers/
  shaders/
  device/
  diagnostics/
```

The existing renderer/scene concepts should be extracted incrementally. Avoid a big-bang rewrite.

## Phase 2 — Content/data layer

Introduce typed, explicit providers:

```text
ContentProvider
MediaProvider
ProjectProvider
SearchProvider
PresenceProvider
AssistantProvider
SpeechProvider
```

Support:

- local/offline fixture mode
- production CMS mode
- schema validation
- stable project IDs/slugs
- image/video variants
- failure-safe fallbacks

## Phase 3 — Performance engineering

Instrument and optimize around real hardware.

Measure:

- first contentful render
- first interactive frame
- shader compile cost
- asset decode cost
- worker startup
- frame time / 1% lows
- GPU and CPU utilization
- memory and texture pressure
- context-loss frequency
- long-task duration
- mobile battery/thermal behavior

Introduce:

- progressive scene boot
- prioritized asset queues
- viewport/device-aware quality tiers
- texture compression/format selection
- lazy project media
- scene-level code splitting
- aggressive cache validation
- graceful degradation under thermal pressure

## Phase 4 — Accessibility and resilience

Keep the immersive canvas, but create a parallel semantic experience.

Requirements:

- keyboard navigation
- visible focus states
- semantic project navigation
- screen-reader-accessible project titles/descriptions
- reduced-motion mode
- reduced-data mode
- no-JS / WebGL fallback
- user-scalable viewport
- readable text outside GPU-only surfaces where needed

## Phase 5 — Secure AI navigation

Replace client-side secret-bearing AI calls with a server-side assistant boundary.

Architecture:

```text
Browser
  -> /api/assistant
       -> policy/rate limit
       -> retrieval over project CMS
       -> LLM provider
       -> structured navigation command
  <- safe response + route/action
```

The browser should never contain private provider credentials.

## Phase 6 — Multiplayer/presence

Make presence optional and cheap to disable.

Use a small authoritative protocol for:

- session ID
- room membership
- pointer/presence events
- lifecycle/heartbeat
- reconnect/backoff

Do not make the main page wait on the multiplayer connection.

## Phase 7 — WebGPU strategy

Do not replace WebGL merely because WebGPU is newer.

First establish a rendering abstraction that can support:

```text
RendererBackend
  -> WebGL2
  -> WebGL1 fallback
  -> WebGPU (future / capability tier)
```

Prototype WebGPU only for workloads where it materially improves performance, quality, or capability.

## Phase 8 — Security and deployment

Add:

- CSP
- Referrer-Policy
- Permissions-Policy
- immutable asset hashing
- dependency review
- secret scanning in CI
- signed/recorded build artifacts
- reproducible builds
- source-map policy
- rate limits on AI/presence endpoints
- privacy-aware analytics

## Phase 9 — Testing / CI

Minimum automated suite:

- asset integrity
- required runtime files
- HTML shell smoke test
- WebGL startup test where GPU context is available
- mobile viewport smoke
- project deep-link smoke
- accessibility checks
- API contract tests
- performance budget checks

## Backend implementation track

The backend work is now specified separately so it can progress without destabilizing the renderer.

### Backend B0 — Foundation

- TypeScript + Fastify API
- configuration validation
- structured logging and request IDs
- health/readiness endpoints
- PostgreSQL migrations
- normalized content/media model
- contract tests

### Backend B1 — Content and search

- import captured CMS reference data
- public project/content endpoints
- CDN-aware media metadata
- PostgreSQL full-text search
- pgvector semantic search
- cache/revalidation strategy

### Backend B2 — AI and voice

- application-owned assistant sessions
- OpenAI Responses API adapter
- structured AI output/actions
- server-side provider credentials
- optional SSE streaming
- ElevenLabs/server-side SpeechProvider
- provider failure and quota handling

### Backend B3 — Realtime and analytics

- independent room/presence service
- bounded WebSocket protocol
- reconnect/backoff
- rate limiting
- allowlisted analytics events
- privacy/retention controls

### Backend B4 — Production hardening

- strict CORS
- security headers/CSP plan
- abuse/resource limits
- secret scanning
- dependency and supply-chain checks
- backup/restore verification
- API inventory and versioning
- observability and failure drills

Backend implementation details are documented in:

- `docs/BACKEND-RESEARCH.md`
- `docs/BACKEND-ARCHITECTURE.md`
- `docs/BACKEND-DATA-MODEL.md`
- `docs/BACKEND-API-CONTRACT.md`
- `docs/BACKEND-IMPLEMENTATION-BRIEF.md`

## Phase 10 — Product upgrades

After the baseline is stable, candidate features include:

- richer project discovery and semantic search
- AI portfolio concierge
- dynamic project stories/case studies
- saved/shareable project explorations
- curated themed journeys
- optional real-time presence
- experimental project lab
- adaptive visual quality controls
- performance diagnostics for users with explicit opt-in
- modern content authoring workflow

Feature work should be additive and modular rather than coupled to the renderer core.
