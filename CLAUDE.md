# CLAUDE.md

## Mission

**Work on Phase 1 only:** reconstruct the current Active Theory V6 live experience as faithfully and completely as practical, starting from the recovered Claude handoff package already in this workspace. The original runtime and assets under `app/public/` are first-class source material, not merely inspiration and not disposable scaffolding.

Do not start Phase 2, add premium design changes, invent new visual features, or replace original scene behavior with a clean-room approximation when recovered code/assets can be reused. First establish baseline fidelity, compare with live evidence, recover missing assets where possible, then implement compatible local behavior for services whose hidden implementation cannot be recovered. Keep `vendor/forensic/*` untouched, document assumptions, and test every implementation step.

Use engineering autonomy to complete the current Phase 1 work package, but do not cross into later customization without an explicit user instruction.

## Read first

Start by reading:

1. `docs/PHASE-1-RECONSTRUCTION-PLAN.md`
2. `docs/PHASE-1-LIVE-AUDIT.md`
3. `docs/CLAUDE-HANDOFF.md`
4. `docs/FORENSIC-FINDINGS.md`
5. `docs/BACKEND-RESEARCH.md`
6. `docs/BACKEND-ARCHITECTURE.md`
7. `docs/BACKEND-DATA-MODEL.md`
8. `docs/BACKEND-API-CONTRACT.md`
9. `docs/BACKEND-IMPLEMENTATION-BRIEF.md`
10. `docs/PRODUCTION-REBUILD-PLAN.md`
11. `docs/SECURITY.md`

Then inspect the relevant source/reference directories before changing architecture.

## Repository landmarks

- `app/public/` — assembled V6 runtime baseline
- `app/cms-reference/` — captured CMS reference data
- `vendor/forensic/current-v6/` — original forensic reference
- `vendor/forensic/legacy-v5/` — historical Hydra worker reference
- `src/` — maintainable frontend extraction area
- `docs/` — architecture, research, contracts, plans, security
- `scripts/` — reconstruction, verification and local serving
- `tests/` — validation area

## Phase 1 development direction

Keep `app/public/` as the primary running client while Phase 1 is being completed. Do not migrate or rewrite renderer/scene code just to make it more maintainable; only make the minimum compatibility changes supported by evidence and protect the original version in the forensic reference.

Start from observed runtime requests and existing API contracts. Recover public assets/data first. For required backend services whose private code cannot be recovered, implement a local compatible boundary that matches the observed methods, payloads, response shapes, timing/state transitions, and graceful failure behavior. Use the captured CMS as source data. Add infrastructure or dependencies only where the actual live behavior requires them; do not build semantic-search or other unobserved product features during Phase 1.

A local backend may use different internals from Active Theory's private infrastructure, but its externally observable behavior should match the live site as closely as the evidence permits. Label assumptions and verify them against the browser/runtime when possible.

## Engineering expectations

Work across architecture, implementation, verification, performance, security, accessibility and product capability as the task requires.

Prefer:
- clear modules and interfaces
- typed contracts
- schema validation
- reproducible migrations
- cache-aware public APIs
- progressive loading
- device-aware rendering
- measurable performance
- graceful failure
- strong browser/runtime behavior
- production-quality logging and diagnostics

Use the existing documents as living design references. Update them when implementation decisions materially change the architecture.

## Validation

Continuously verify the work with the strongest relevant checks available:

- asset integrity
- type checks
- lint
- unit/integration tests
- API contract tests
- migration/import checks
- browser smoke tests
- WebGL/runtime checks on available hardware
- performance measurements
- security/secret scans
- production configuration validation

Keep the reconstructed baseline verifiable while new source implementation is being extracted.

## Deferred Phase 2 ideas — not in current scope

The ideas below are potential future enhancements only. Do not implement them during Phase 1 unless the live V6 site is verified to already provide that behavior and it is required for parity:

- semantic project discovery beyond the observed live search/navigation
- a new AI portfolio concierge or project-aware AI actions not present in V6
- new dynamic case-study formats or curated journeys
- new realtime visitor-presence features
- new adaptive-quality features beyond the captured runtime
- new project/lab publishing tools
- richer media experiences or analytics-driven optimization beyond the original site

Phase 1 must first match the original experience. Phase 2 requires explicit user authorization.

## Handoff rule

Do not treat the forensic material as the product source forever. It is the reference point.

The objective is to progressively replace opaque runtime behavior with understandable, testable, maintainable source implementation while preserving the experience quality.
