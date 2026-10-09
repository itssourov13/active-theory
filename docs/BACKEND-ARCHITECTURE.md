# Backend Architecture Specification

Date: 2026-10-09
Status: Architecture/specification
Scope: Independent production backend for the rebuilt immersive site

## 1. Objective

Build an independent backend that preserves the useful contracts observed in the V6 runtime while removing the original system's unnecessary client-side coupling.

The backend must support:
- structured project/content delivery
- media metadata and CDN URLs
- semantic + textual project search
- a secure AI portfolio assistant
- optional voice generation
- optional realtime rooms/presence
- privacy-aware analytics
- feature flags and runtime configuration
- editorial publishing/versioning
- observability and operational controls

The backend is a new implementation. It does not need to reproduce private Active Theory services.

## 2. What the forensic runtime actually tells us

| Capability | Observed behavior | Rebuild decision |
|---|---|---|
| CMS | Remote JSON for metadata/contact/projects | Replace with typed API + DB + cache |
| Media | GCS media objects + responsive variants | Use object storage + CDN + media records |
| AI assistant | createThread/createMessage/createRun/listMessage | Simplify into a public session/message API |
| Direct OpenAI | Browser calls existed in captured bundle | Never expose provider secrets; server-side only |
| Direct ElevenLabs | Browser TTS call existed in captured bundle | Server-side provider adapter |
| Speech recognition | Browser Speech API + Vosk fallback | Keep recognition client-side initially |
| Multiplayer | WebSocket room server, roomKey/roomId/player state | Separate realtime boundary |
| UIL | Remote/local Firebase-style state sync exists | Do not couple product backend to editor tooling |
| Analytics | No strong public contract required for rebuild | Add privacy-aware event ingestion |

## 3. Recommended application shape

~~~text
                       +----------------------+
                       |  WebGL / Site Client |
                       +----------+-----------+
                                  |
                 +----------------+----------------+
                 |                                 |
             HTTPS/JSON                        WebSocket
                 |                                 |
        +--------v---------+              +--------v---------+
        | Fastify API      |              | Realtime Service |
        | TypeScript       |              | Rooms/Presence   |
        +--------+---------+              +--------+---------+
                 |                                 |
      +----------+----------+                  +---+---+
      |          |          |                  |       |
      v          v          v                  v       v
   PostgreSQL  Object     AI/Voice           Room   Optional
   + pgvector  Storage    providers         state   Redis
      |
      +-- search / content / sessions / events
~~~

Do not split the HTTP API into microservices at the beginning. Keep domain boundaries explicit inside one deployable service and extract only when traffic, ownership, or scaling requirements justify it.

## 4. Baseline technology recommendation

### HTTP/API
- TypeScript
- Fastify
- JSON Schema validation and response serialization
- OpenAPI generation from the contract layer
- structured logging
- request IDs and trace IDs

Fastify is a good fit because this project needs a low-overhead HTTP layer with explicit schemas, plugins, and production-oriented deployment options.

### Database
- PostgreSQL
- pgvector extension for semantic search
- migrations checked into source control
- application-level repository/service boundaries

Avoid a separate vector database initially. Project metadata, tags, full-text search, embeddings, and transactional content can live together in PostgreSQL.

### Object storage
Use S3-compatible object storage such as Cloudflare R2 or Amazon S3.

Keep binary assets out of PostgreSQL.

Use:
- immutable object keys for published media
- CDN/public URLs for public assets
- short-lived presigned URLs for private/admin upload flows
- server-generated variants and media metadata

### Cache / coordination
Do not make Redis a hard dependency on day one.

Add Redis or another shared coordination layer when required for:
- distributed rate limits
- hot content caching
- job queues
- cross-instance realtime fan-out
- temporary presence state

### Realtime
Keep realtime behind a provider-neutral interface.

Recommended first production option:
- WebSocket room service with authoritative room state
- room-level connection limits
- heartbeat/ping
- reconnect/backoff
- bounded message sizes and event rates

A Cloudflare Durable Objects implementation is a strong deployment option for stateful rooms because each object naturally maps to a room and supports WebSocket hibernation. The domain contract should not depend on Cloudflare-specific APIs.

### AI
Use the current OpenAI Responses API behind an AIProvider adapter.

The public endpoint should:
1. authenticate/identify the anonymous session
2. rate-limit
3. retrieve relevant project/content context
4. call the provider
5. enforce a strict response schema
6. validate any navigation action
7. return a safe application response

The application owns conversation/session state. Do not rely on provider-side persistence as the canonical database.

### Voice
Use a SpeechProvider adapter for ElevenLabs or another provider.

Provider keys remain server-side.

Client-side speech recognition can remain browser-native initially, with Vosk or another fallback only when needed.

## 5. Domain modules

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
~~~

Each module should expose interfaces instead of leaking provider SDKs into scene/rendering code.

## 6. Content flow

~~~text
Admin/editor
    |
    v
Content API
    |
    +--> PostgreSQL
    +--> media object store
    +--> embedding job
    +--> publish revision
             |
             v
        CDN/cache
             |
             v
        WebGL client
~~~

Published content should be immutable by revision. Editing creates a new draft/revision rather than mutating the currently published snapshot in place.

## 7. Search flow

Use hybrid retrieval:

~~~text
query
  |
  +--> PostgreSQL full-text search
  |
  +--> pgvector semantic search
  |
  +--> filters (tag/client/year/type)
  |
  v
rank + deduplicate
  |
  v
project results
~~~

This gives both exact term matching and natural-language discovery without requiring a second search platform.

## 8. AI assistant flow

~~~text
POST /v1/assistant/sessions/:id/messages
              |
              v
        input validation
              |
              v
        abuse/rate checks
              |
              v
       project retrieval
              |
              v
       provider request
              |
              v
      structured AI result
              |
              v
   action allowlist validation
              |
              v
        client response
~~~

The model may suggest an action such as open_project, but the server must validate that the target slug exists before returning it.

Never allow the model to directly choose:
- arbitrary URLs
- arbitrary API endpoints
- database queries
- shell commands
- storage keys
- privileged actions

## 9. Realtime flow

Realtime is optional and must never block initial page boot.

~~~text
client
  -> connect(room)
  -> authenticated anonymous session
  -> join room
  -> receive snapshot
  -> send bounded presence events
  -> heartbeat
  -> reconnect with backoff
~~~

Only low-value, high-frequency state should be realtime:
- cursor/presence
- approximate position
- active scene/project
- transient interaction state

Do not stream large media, database records, or AI conversations over the room socket.

## 10. Analytics flow

Use batched, low-priority events.

~~~text
client
  -> POST /v1/analytics/events
  -> validate + sample/filter
  -> queue/insert
  -> aggregate
~~~

Events should use pseudonymous session IDs and avoid raw prompt text by default.

The analytics transport must never delay rendering or interaction.

## 11. Caching strategy

### Public content
Use:
- CDN caching
- ETag or immutable revision URLs
- stale-while-revalidate where supported

### Project detail
Cache by immutable project revision or publish version.

### AI
Do not broadly cache user-specific responses. Cache safe retrieval artifacts such as project indexes/embeddings.

### Media
Prefer immutable hashed/object-versioned URLs so cache invalidation becomes mostly automatic.

## 12. Deployment shape

A provider-neutral production topology is preferred:

~~~text
Frontend/CDN
    |
    +--> Fastify API
    |      |
    |      +--> PostgreSQL
    |      +--> Object storage
    |      +--> AI/Voice providers
    |
    +--> Realtime service
           |
           +--> shared coordination if needed
~~~

A practical first deployment can use:
- frontend on Vercel or another CDN platform
- Fastify API on Cloud Run or another container platform
- PostgreSQL on a managed provider
- R2/S3 for large media
- Cloudflare Durable Objects for realtime rooms when that platform is selected

The application should remain portable enough to move providers.

## 13. Non-goals for the first backend implementation

Do not build these into the first milestone:
- user accounts for ordinary visitors
- full social profiles
- payment systems
- CMS editor UI before API/data model is stable
- microservice fleet
- separate vector database
- complex distributed event bus
- provider-specific frontend SDKs
- WebGPU-specific backend behavior

## 14. Architecture exit criteria

The backend foundation is ready for feature development when:
- API contracts are typed and versioned
- migrations are reproducible
- project/content APIs work against the captured CMS data
- media metadata is normalized
- search can return deterministic project IDs/slugs
- AI calls are server-side only
- rate limits are enforced
- structured AI actions are validated server-side
- realtime can be disabled without affecting normal navigation
- health/readiness endpoints exist
- logs contain request/trace IDs and redact sensitive values
- automated contract tests exist
- production configuration is environment/secret-manager driven

## 15. Decision summary

1. Modular monolith first; microservices later.
2. PostgreSQL is the source of truth.
3. pgvector lives inside PostgreSQL.
4. Object storage holds binaries.
5. Fastify owns the HTTP API.
6. Realtime is a separate scaling boundary.
7. AI and voice providers are server-side.
8. The browser receives safe, typed application data and validated actions.
9. Content is revisioned and cache-friendly.
10. The backend must be provider-portable.

## References

- https://fastify.dev/docs/latest/
- https://fastify.dev/docs/latest/Guides/Recommendations/
- https://pgvector.org/
- https://github.com/pgvector/pgvector
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- https://developers.openai.com/api/docs/guides/migrate-to-responses
- https://developers.openai.com/api/docs/reference/responses/overview
- https://help.openai.com/en/articles/5112595
- https://elevenlabs.io/docs/api-reference/authentication
- https://owasp.org/API-Security/editions/2023/en/0x11-t10/
