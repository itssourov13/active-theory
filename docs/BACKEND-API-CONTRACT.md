# Backend API Contract

Date: 2026-10-09
Status: Proposed contract for implementation
Principle: The public API is a new contract; legacy V6 endpoints are reference only.

## 1. API conventions

Base path: /v1

Response format:
- JSON for normal requests
- SSE for optional AI streaming
- WebSocket for realtime rooms only

Every response should include:
- requestId
- version where useful
- stable machine-readable error codes

Use cursor pagination for collections.

Use ETag/Last-Modified where content is cacheable.

Public endpoints must be read-mostly and optimized for CDN/cache delivery.

## 2. Content endpoints

### GET /v1/content/site

Returns published global content:

- metadata
- contact links
- feature flags intended for public clients
- current content revision

Example response shape:

~~~json
{
  "revision": "2026-10-09T18:00:00Z",
  "metadata": {
    "title": "...",
    "description": "...",
    "socialImage": { "url": "..." }
  },
  "contact": {
    "links": []
  },
  "features": {
    "assistant": true,
    "realtime": true,
    "voice": false
  }
}
~~~

### GET /v1/projects

Query parameters:
- cursor
- limit
- tag
- client
- year
- sort
- q

Return:
- project summary
- stable id
- slug
- title/name
- client
- description excerpt
- tags
- priority/order
- preview media
- publishedAt

### GET /v1/projects/:slug

Return the complete public project document:

- identity
- description
- client
- completion date
- tags
- branding/ui color
- hero/preview media
- case-study content when published
- related projects
- revision identifier

Do not expose internal storage keys, unpublished fields, admin metadata, or provider credentials.

## 3. Search

### GET /v1/search

Query parameters:
- q
- limit
- cursor
- tags[]
- client
- year
- type

The result should contain a normalized relevance score and a result reason.

Example:

~~~json
{
  "query": "interactive automotive WebGL",
  "results": [
    {
      "type": "project",
      "slug": "example-project",
      "score": 0.91,
      "matchedBy": ["semantic", "tag"]
    }
  ]
}
~~~

Do not expose raw embedding vectors.

## 4. Assistant

### POST /v1/assistant/sessions

Creates an anonymous application-owned assistant session.

Request:

~~~json
{
  "projectSlug": "optional-current-project"
}
~~~

Response:

~~~json
{
  "sessionId": "opaque-public-id",
  "expiresAt": "timestamp"
}
~~~

### POST /v1/assistant/sessions/:id/messages

Request:

~~~json
{
  "message": "What did they build for automotive clients?",
  "context": {
    "projectSlug": "optional"
  }
}
~~~

Response:

~~~json
{
  "message": "Here are the relevant projects...",
  "actions": [
    {
      "type": "open_project",
      "slug": "project-slug",
      "label": "Open project"
    }
  ],
  "sources": [
    {
      "type": "project",
      "slug": "project-slug"
    }
  ]
}
~~~

The server must validate every action against an allowlist.

### POST /v1/assistant/sessions/:id/stream

Optional SSE version for progressive AI output.

The stream must contain typed events such as:
- message_start
- text_delta
- action
- message_complete
- error

Do not expose provider-specific event names to the browser if they can be normalized.

## 5. Voice

### POST /v1/voice/synthesize

Request:

~~~json
{
  "text": "Narration text",
  "voice": "default",
  "format": "mp3"
}
~~~

Server behavior:
- authorize the operation
- enforce text-length/credit limits
- call provider
- cache only when safe
- return a short-lived media URL or stream

Never return provider API credentials.

## 6. Media

### GET /v1/media/:id

Returns metadata and the public/CDN URL for published assets.

### POST /v1/media/upload-intent

Admin/editor-only.

Request:

~~~json
{
  "filename": "hero.webp",
  "contentType": "image/webp",
  "size": 830122
}
~~~

Response:

~~~json
{
  "uploadUrl": "short-lived-signed-url",
  "objectKey": "media/immutable-key",
  "expiresAt": "timestamp"
}
~~~

The server must validate extension, MIME type, size, and destination scope before signing.

## 7. Analytics

### POST /v1/analytics/events

Accept a small batch.

Example:

~~~json
{
  "events": [
    {
      "type": "project_open",
      "sessionId": "opaque",
      "timestamp": "timestamp",
      "properties": {
        "slug": "project-slug",
        "source": "ai"
      }
    }
  ]
}
~~~

Rules:
- hard payload limit
- event allowlist
- server-side timestamp sanity checks
- no arbitrary PII fields
- no raw AI prompt storage by default
- rate limit and sampling support

## 8. Runtime configuration

### GET /v1/config

Return only configuration safe for public clients:

- API version
- feature flags
- public asset/CDN origin
- realtime endpoint
- assistant availability
- supported rendering tiers if needed

Never return:
- provider secrets
- internal hostnames
- database information
- storage credentials
- admin flags

## 9. Health

### GET /health/live

Process is alive.

### GET /health/ready

Returns readiness for dependencies required by the current deployment mode.

Do not make readiness depend on optional services such as voice or realtime if the core HTTP API can operate without them.

## 10. Realtime contract

WebSocket endpoint:

/v1/realtime

Handshake query/header:
- room
- ephemeral session credential

First server event:

~~~json
{
  "type": "room_snapshot",
  "room": "room-id",
  "version": 1,
  "participants": []
}
~~~

Allowed client event classes:

~~~text
presence.update
scene.focus
project.focus
ping
leave
~~~

Each event must have:
- type
- sequence or monotonic timestamp
- bounded payload

Server event classes:

~~~text
room_snapshot
participant.join
participant.update
participant.leave
room.notice
error
pong
~~~

The server owns authoritative membership. Clients do not declare their own participant count.

## 11. Errors

Use stable error codes.

Example:

~~~json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests.",
    "requestId": "..."
  }
}
~~~

Suggested codes:
- INVALID_REQUEST
- NOT_FOUND
- RATE_LIMITED
- FORBIDDEN
- UNAUTHORIZED
- CONTENT_UNAVAILABLE
- PROVIDER_UNAVAILABLE
- AI_UNAVAILABLE
- REALTIME_UNAVAILABLE
- INTERNAL_ERROR

Do not expose stack traces or provider raw error bodies to public clients.

## 12. Backward-reference mapping

Legacy V6 contract -> new contract:

- CMS JSON fetch -> /v1/content/site + /v1/projects
- project-specific content -> /v1/projects/:slug
- createThread -> POST /v1/assistant/sessions
- createMessage/createRun/listMessage -> POST /v1/assistant/sessions/:id/messages
- direct OpenAI call -> internal AIProvider
- direct ElevenLabs call -> internal SpeechProvider
- dreamwave WebSocket -> /v1/realtime
- direct GCS media URLs -> normalized media/CDN layer

The new contract intentionally removes the old multi-step assistant orchestration from the browser.

## 13. API versioning policy

- Keep /v1 stable once the first production client ships.
- Add fields in backward-compatible ways.
- Never silently change field meaning.
- Deprecate old fields before removing them.
- Document breaking changes as a new major API version.

## 14. Contract test targets

Automate tests for:
- schema validation
- pagination
- cache headers
- 404 behavior
- rate limiting
- action validation
- upload-intent restrictions
- assistant session lifecycle
- realtime event validation
- health behavior
- no-secret leakage in public responses
