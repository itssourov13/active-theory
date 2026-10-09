# Claude Handoff Guide

Date: 2026-10-09
Workspace: `gpt-project/phase1-claude-handoff-source/activetheory-production-rebuild`

> **Current user-directed scope: Phase 1 only; status is INCOMPLETE.** Start with `PHASE-1-PARITY-MATRIX.md` for the current checklist, then read `PHASE-1-RECONSTRUCTION-PLAN.md`, `BASELINE-STATUS.md`, and `PHASE-1-LIVE-AUDIT.md`. Recreate the live experience faithfully before any premium redesign or Phase 2 work. The original runtime is implementation material, not merely a behavioral reference.

## 1. What this package is

This workspace is a reconstructed production baseline plus an engineering specification for an independent rebuild.

It contains:

- a locally assembled V6 runtime baseline
- the missing live runtime assets required to reconstruct that baseline
- captured production/staging/dev CMS snapshots
- immutable forensic references
- a maintainable source extraction area
- a researched backend architecture
- database and API contracts
- security guidance
- implementation sequencing
- verification scripts

This package includes the recovered live runtime and asset set, not only a visual reference. Phase 1 targets faithful external behavior first; compatible local backend behavior fills only those gaps whose original implementation cannot be recovered.

## 2. What was verified before handoff

The assembled baseline currently verifies:

- 379/379 manifest-tracked runtime assets present
- 157 live assets reconstructed
- 213 existing assets reused
- 0 failed downloads
- 0 declared-byte mismatches
- core V6 forensic/live hashes retained
- local verification command passes

The current headless environment does not expose a usable WebGL context, so visual GPU validation still belongs on a real hardware-accelerated browser/device.

## 3. What the forensic work established

The captured runtime is a custom WebGL/Hydra-style system with:

- WebGL2 and WebGL/WebGL1 fallback
- GPU capability detection
- workers/off-main-thread computation
- OffscreenCanvas/ImageBitmap paths
- custom shaders and post-processing
- device-aware behavior
- remote CMS/media loading
- service-worker support
- AI/voice integrations
- room-based WebSocket presence/multiplayer

Observed V6 backend contracts include:

- Google Cloud Storage CMS JSON
- `/api/assistant/createThread`
- `/api/assistant/createMessage`
- `/api/assistant/createRun`
- `/api/assistant/listMessage`
- `wss://s.dreamwave.network/ws`

These are forensic observations and behavior targets for Phase 1. Reproduce externally observable behavior as closely as practical. If private server code cannot be recovered, implement a compatible local substitute from verified request/response behavior and captured data; do not claim inferred internals are original.

## 4. Captured CMS foundation

The reconstructed production CMS reference contains:

- 65 project records
- 161 media records
- global metadata
- about content
- contact links

The project model includes stable IDs/slugs, descriptions, clients, dates, tags, priorities, logos/video metadata and media variants.

This makes the CMS snapshot a strong seed dataset for the new backend.

## 5. Target backend architecture

The target architecture is:

~~~text
Immersive Client
     |
     +---- HTTPS ----> Fastify API
     |                    |
     |                    +--> PostgreSQL + pgvector
     |                    +--> Object Storage / CDN
     |                    +--> AI Provider
     |                    +--> Voice Provider
     |
     +-- WebSocket ----> Realtime Service
                            |
                            +--> room state / coordination
~~~

The HTTP API starts as a modular monolith.

Realtime is a separate scaling boundary.

PostgreSQL is the source of truth.

Vector search stays inside PostgreSQL initially.

## 6. Backend implementation sequence

### B0
Foundation:
- TypeScript/Fastify
- config validation
- logging/request IDs
- health/readiness
- migrations
- schema validation
- contract tests

### B1
Content and search:
- CMS import
- normalized project/media model
- public content endpoints
- full-text search
- pgvector semantic search
- caching

### B2
AI and voice:
- assistant sessions
- OpenAI Responses API adapter
- structured AI actions
- server-side credentials
- optional SSE
- ElevenLabs adapter

### B3
Realtime and analytics:
- room protocol
- presence
- reconnect
- abuse limits
- analytics events

### B4
Production hardening:
- security headers/CSP
- strict CORS
- rate limits
- secret scanning
- dependency/security checks
- backup/restore
- observability
- API versioning

## 7. Important implementation philosophy

Make the system stronger than the original where the evidence supports it.

Examples:

- replace client-side AI credentials with a secure server boundary
- replace CMS JSON coupling with typed content APIs
- normalize media metadata
- use hybrid lexical + semantic search
- validate AI navigation actions server-side
- keep realtime optional to page boot
- use immutable media/revisioning where useful
- make content and API contracts explicit
- build graceful fallbacks around the GPU experience

## 8. Frontend migration strategy

The reconstructed runtime remains the behavior reference while source modules are extracted.

Suggested extraction order:

1. runtime/bootstrap
2. asset/cache layer
3. renderer/shader abstraction
4. scene graph/camera/scroll
5. content provider
6. media/project presentation
7. AI/voice adapters
8. realtime/presence
9. diagnostics/performance

The backend can be implemented in parallel once the frontend integration boundaries are clear.

## 9. What to change vs what to preserve

Preserve the underlying creative intent:

- spatial storytelling
- shader quality
- camera choreography
- tactile interaction
- typography
- premium motion language
- strong project presentation

Improve the engineering:

- source structure
- security
- resilience
- content management
- observability
- performance
- accessibility
- AI integration
- realtime
- search
- deployment

Use engineering judgment to decide when an old implementation is no longer the right technical shape.

## 10. Documentation contract

When an architectural decision becomes materially different from the current docs:

- update the relevant architecture document
- update API/data model docs if contracts changed
- record important tradeoffs
- keep the root README useful for a new engineer

The docs are intended to evolve with the implementation.

## 11. First-session expectation

A fresh Claude session should be able to:

1. read the root `CLAUDE.md`
2. understand the forensic baseline
3. understand the backend architecture
4. inspect the actual runtime/assets
5. establish a working source/backend plan
6. implement the next coherent engineering stage
7. validate the result
8. continue to the next stage when appropriate

No additional repository context should be required to understand the project mission.
