# Backend Implementation Brief

Date: 2026-10-09
Audience: Claude / implementation agent for a future backend implementation stage

> **Status: proposed design/implementation brief, not a report of completed code.** The current workspace has a dependency-light reconstruction server and compatibility adapters; the planned Fastify/PostgreSQL production backend described here is not yet implemented. The current Phase 1 acceptance status is tracked in `PHASE-1-PARITY-MATRIX.md`.

## Mission

Implement a production backend for the reconstructed immersive site without disturbing the verified frontend/forensic baseline.

The target is an independent backend, inspired by the observed V6 contracts but not coupled to the original private infrastructure.

## Read these first

1. docs/FORENSIC-FINDINGS.md
2. docs/BACKEND-RESEARCH.md
3. docs/BACKEND-ARCHITECTURE.md
4. docs/BACKEND-DATA-MODEL.md
5. docs/BACKEND-API-CONTRACT.md
6. docs/SECURITY.md
7. docs/PRODUCTION-REBUILD-PLAN.md

Also inspect:
- app/cms-reference/
- app/public/
- vendor/forensic/current-v6/
- vendor/forensic/legacy-v5/

## Implementation order

### Stage 1: backend foundation

Create an explicit backend workspace without modifying vendor/forensic/*.

Recommended structure:

~~~text
backend/
  src/
    app/
    config/
    http/
    auth/
    content/
    projects/
    media/
    search/
    ai/
    voice/
    realtime/
    analytics/
    feature-flags/
    jobs/
    health/
    observability/
    db/
    providers/
  migrations/
  tests/
  package.json
  tsconfig.json
~~~

Use TypeScript.

Use Fastify for HTTP.

Add request IDs, structured logging, schema validation, centralized error handling, graceful shutdown, health endpoints, and configuration validation.

### Stage 2: database

Introduce PostgreSQL migrations.

Implement the logical model from docs/BACKEND-DATA-MODEL.md.

Import the captured production CMS into reference tables first.

Validate that the imported data preserves:
- 65 projects
- 161 media records
- project names/slugs
- tags
- completion dates
- media variants
- global metadata
- contact links

Keep original source IDs where useful for migration verification.

### Stage 3: public content API

Implement:
- GET /v1/content/site
- GET /v1/projects
- GET /v1/projects/:slug
- GET /v1/search

Use cache-friendly headers.

Return normalized media references.

Do not expose internal storage credentials, unpublished content, database identifiers that are not intentionally public, or provider-specific implementation details.

### Stage 4: hybrid search

Start with PostgreSQL full-text search.

Add pgvector embeddings as a derived layer.

Implement a provider-neutral embedding interface.

Search should return deterministic project slugs/IDs that the frontend can safely open.

### Stage 5: AI assistant

Implement:
- POST /v1/assistant/sessions
- POST /v1/assistant/sessions/:id/messages
- optional POST /v1/assistant/sessions/:id/stream

Use an AIProvider abstraction.

Use the current OpenAI Responses API for the first provider implementation.

Use structured output for:
- natural language message
- optional project actions
- source references

Server-side validation must reject unknown project slugs and unsupported actions.

Do not expose provider API keys in browser code.

Prefer application-owned conversation state.

### Stage 6: media

Implement media metadata APIs and upload intent support.

Use S3-compatible object storage.

For private/admin uploads:
- generate short-lived signed upload URLs
- constrain content type
- constrain maximum size
- scope the object key
- verify resulting object metadata/content before publish

For public media:
- serve through CDN/object URLs
- use immutable/versioned keys where practical

### Stage 7: realtime

Implement realtime as a separate boundary.

Initial protocol:
- join
- room snapshot
- participant join/update/leave
- scene/project focus
- heartbeat/pong
- bounded presence updates
- reconnect/backoff

Do not make realtime required for page load.

Keep domain interfaces independent from the chosen hosting runtime.

### Stage 8: analytics

Implement:
- POST /v1/analytics/events

Use an allowlist of event types.

Keep payloads small.

Default events:
- page_view
- project_open
- project_complete
- search
- assistant_open
- assistant_message
- assistant_action
- realtime_join
- realtime_leave
- error

Do not store raw AI prompts by default.

### Stage 9: security hardening

Implement before any public deployment:
- strict CORS allowlist
- CSP planning/documentation
- secure headers
- body size limits
- per-route rate limits
- anonymous-session abuse controls
- schema validation on every external input
- SSRF-safe URL handling
- storage upload restrictions
- secrets only via environment/secret manager
- secret scanning
- dependency audit
- redacted logging
- API version inventory

Treat public anonymous endpoints as hostile input surfaces.

### Stage 10: tests

At minimum:
- unit tests for domain services
- API schema/contract tests
- database migration tests
- content import verification
- search ranking smoke tests
- AI action validation tests
- rate-limit tests
- signed-upload tests
- realtime protocol tests
- secret-leak regression checks
- health/readiness tests

Add browser integration only after the backend contract is stable.

## Engineering guidance

The following are current architecture guidelines, not artificial limits on the implementation. Use engineering judgment as the system evolves and change direction when evidence or requirements justify it.

- Keep forensic references identifiable and intact so behavior remains comparable.
- Preserve a working reference path while replacing opaque runtime pieces with maintainable source.
- Keep secrets out of browser/public output.
- Use explicit provider/domain interfaces so infrastructure can evolve.
- Keep AI and realtime as optional experience capabilities rather than making them a fragile dependency of the first render.
- Start with the documented modular architecture and simplify or split components when measurements and product needs justify it.
- Add infrastructure such as Redis or a separate vector/search service when real requirements make it valuable.
- Revisit the technology choices when performance, scale, reliability, or product capability calls for it.

## Definition of done for backend phase

The backend phase is complete when:

1. The service starts locally from clean configuration.
2. Database migrations run from empty state.
3. Captured CMS reference data imports successfully.
4. Public content endpoints return stable normalized contracts.
5. Search returns expected projects.
6. AI endpoint works with a server-side provider key.
7. AI actions are schema-validated and allowlisted.
8. Media upload-intent flow is secure.
9. Realtime can join a room and recover from reconnect.
10. Analytics accepts only allowed event shapes.
11. Rate limiting and request IDs work.
12. No private credential is present in frontend/public output.
13. Automated tests are green.
14. Documentation describes local setup, environment variables, deployment, backup/restore, and threat model.

## Product handoff principle

Once this backend foundation is stable, higher-level features can be added without changing the rendering core:

- semantic project discovery
- AI portfolio concierge
- dynamic case studies
- curated journeys
- saved/shareable explorations
- optional visitor presence
- project-specific AI context
- adaptive experience configuration
- experimental lab publishing

The backend should enable these features, not become their presentation layer.
