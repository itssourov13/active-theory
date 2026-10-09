# Backend Research and Engineering Decisions

Date: 2026-10-09
Research mode: multi-angle current-source review
Scope: backend architecture for the reconstructed V6-style immersive site

## 1. Research questions

The research focused on:

1. What HTTP architecture fits a graphics-heavy site without adding backend overhead?
2. What database/search architecture can handle project metadata and semantic discovery without introducing a separate search platform?
3. What is the cleanest production pattern for stateful WebSocket rooms?
4. How should AI and voice providers be integrated securely in 2026?
5. How should browser-to-object-storage uploads work without exposing storage credentials?
6. What API security controls are mandatory for a public anonymous API?

## 2. Key findings

### Fastify

Fastify's current guidance emphasizes reverse proxies, capacity planning, multiple instances, and measurement under production-like workloads. That matches this project well: the API should be a small, schema-driven service behind a managed proxy/container platform rather than trying to embed API logic inside the WebGL runtime.

Decision:
- Use Fastify for the HTTP API.
- Keep the API stateless where practical.
- Put state in PostgreSQL/object storage/explicit external coordination.
- Measure real workloads before scaling.

Source:
https://fastify.dev/docs/latest/Guides/Recommendations/

### PostgreSQL + pgvector

pgvector supports exact nearest-neighbor search plus approximate indexes including HNSW and IVFFlat. It also supports multiple vector types and distance operators.

For this site, project data is already relational: projects, tags, clients, media, dates, revisions. Keeping semantic search beside that data avoids an unnecessary second system.

Decision:
- PostgreSQL is canonical.
- Use PostgreSQL full-text search for lexical matching.
- Use pgvector for semantic retrieval.
- Start with HNSW.
- Treat embeddings/indexes as rebuildable derived data.

Sources:
https://github.com/pgvector/pgvector
https://pgvector.org/docs/

### Stateful WebSockets

Cloudflare Durable Objects are explicitly designed for stateful coordination and WebSocket rooms. The hibernation API allows an object to sleep while client sockets remain connected, which is particularly attractive for low-duty-cycle presence rooms.

Decision:
- Define a provider-neutral realtime domain interface.
- Use a dedicated realtime service rather than blocking the main API.
- Cloudflare Durable Objects are a strong deployment option.
- Do not make the frontend depend on provider-specific room APIs.

Source:
https://developers.cloudflare.com/durable-objects/best-practices/websockets/

### OpenAI

Current OpenAI documentation recommends the Responses API for new projects. It supports structured outputs, function calling, multimodal inputs, and stateful interaction patterns. Provider-side state is not the same thing as application state and should not replace the site's own session database.

OpenAI also explicitly warns against shipping API keys in client-side applications.

Decision:
- Wrap OpenAI behind an AIProvider interface.
- Use Responses API for new AI functionality.
- Prefer structured output for navigation actions.
- Keep the site's conversation/session record in our database.
- Use store=false unless provider-side storage is intentionally required.
- Keep OPENAI_API_KEY only on trusted infrastructure.

Sources:
https://developers.openai.com/api/docs/guides/migrate-to-responses
https://developers.openai.com/api/docs/reference/responses/overview
https://help.openai.com/en/articles/5112595

### ElevenLabs

ElevenLabs documents API keys as secrets and supports restricted credentials. The provider also supports single-use tokens for selected client-side scenarios, but a server-side provider adapter is simpler for our architecture and avoids coupling the public app directly to vendor authentication.

Decision:
- Keep ElevenLabs keys server-side.
- Add a SpeechProvider abstraction.
- Enforce text length, quotas, and rate limits before provider calls.
- Cache generated public narration only when content is deterministic and caching is desirable.

Source:
https://elevenlabs.io/docs/api-reference/authentication

### Object storage presigned URLs

Cloudflare R2 and AWS S3 both document presigned URLs as the pattern for granting temporary access without exposing storage credentials. R2 specifically notes that presigned URLs should be treated as bearer tokens.

Decision:
- Never expose bucket access keys in the browser.
- Admin/editor clients request short-lived upload intents.
- Sign one object/key and one operation at a time.
- Bind uploads to expected content type and maximum size.
- Validate uploaded content server-side before publication.

Sources:
https://developers.cloudflare.com/r2/api/s3/presigned-urls/
https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html

### OWASP API Security

The OWASP API Security Top 10 remains the baseline threat model for public APIs. For this project the highest-value controls are object-level authorization, unrestricted resource consumption, security misconfiguration, inventory/version management, unsafe third-party consumption, and SSRF prevention where the system accepts external URLs.

Decision:
- Every resource/action must be authorized by ownership or an explicit public capability.
- AI, upload, analytics, and realtime routes get independent limits.
- External URL ingestion is allowlisted/validated.
- API inventory and versions are documented.
- Provider failures and third-party responses are treated as untrusted input.

Source:
https://owasp.org/API-Security/editions/2023/en/0x11-t10/

## 3. Architectural conclusion

The research converges on this shape:

~~~text
                     WebGL Client
                          |
                 +--------+--------+
                 |                 |
               HTTPS           WebSocket
                 |                 |
           Fastify API       Realtime service
                 |                 |
          +------+------+    +----+----+
          |             |         |
      PostgreSQL     Object     Room state
      + pgvector     Storage            |             |                 +------ Search/AI ------
~~~

The key is not to copy the original backend topology. The key is to preserve the useful boundaries while removing direct provider coupling from the browser.

## 4. Why not microservices now?

This site is a portfolio/experience platform, not a distributed enterprise system.

Early microservices would add:
- deployment overhead
- network failure modes
- duplicated authentication/validation
- distributed tracing complexity
- local development friction
- more secrets and configuration

A modular monolith with a separate realtime process gives nearly all of the important separation without premature operational cost.

Extract a service later when:
- it scales independently
- it has a different availability profile
- it needs a different runtime
- it has a different security boundary
- independent deployment materially helps the product

## 5. Why PostgreSQL instead of a dedicated search/vector platform?

The captured CMS dataset is relatively small, relational, and metadata-heavy.

A first version gains more from:
- joins
- transactions
- content revisions
- full-text search
- pgvector
- mature backups
- one database to operate

A dedicated search/vector platform becomes reasonable only after real query volume or ranking complexity demonstrates the need.

## 6. Why HTTP for AI and WebSocket only for realtime?

AI requests are request/response workloads with optional streaming.

Use:
- normal HTTPS for assistant requests
- SSE when progressive text is useful
- WebSocket only for actual bidirectional realtime presence/room state

This keeps the networking model simple and prevents the realtime channel from becoming a general-purpose application bus.

## 7. Security architecture principles

### Public-by-default browser
The browser may know:
- public API origin
- public asset origin
- public feature flags
- anonymous session token
- realtime room token

The browser must not know:
- database credentials
- provider API keys
- storage write keys
- internal service URLs that expose privileged systems
- admin credentials

### AI prompt handling
Treat user prompts and retrieved CMS content as untrusted data.

Model output is also untrusted until validated.

Do not grant the model direct authority over:
- navigation outside the allowlisted route model
- content publishing
- account permissions
- storage
- database
- arbitrary external network access

### Media ingestion
External URLs and uploads are a high-risk boundary.

Validate:
- origin
- scheme
- content length
- MIME type
- decoded media type
- object key scope
- antivirus/content scan when required
- image dimensions and decompression limits

## 8. Performance architecture principles

The backend exists to make the GPU experience faster, not to become another blocking dependency.

Therefore:
- project summaries should be tiny
- media URLs should point to CDN/object storage
- initial content should be cacheable
- AI/realtime are optional enhancement layers
- analytics is buffered and non-blocking
- no page boot path should require an AI response
- no page boot path should require a realtime room

## 9. Research limitations

Public sources can explain modern backend patterns, but they cannot reveal private Active Theory infrastructure beyond what the captured client bundle exposed.

The rebuild therefore intentionally treats:
- observed V6 URLs/contracts as forensic evidence
- modern platform documentation as architecture guidance
- our own product requirements as the source of new design decisions

It should not claim that the proposed backend is the original Active Theory backend.

## 10. Research source index

| Area | Source |
|---|---|
| Fastify | https://fastify.dev/docs/latest/Guides/Recommendations/ |
| pgvector | https://github.com/pgvector/pgvector |
| pgvector docs | https://pgvector.org/docs/ |
| Cloudflare WebSockets | https://developers.cloudflare.com/durable-objects/best-practices/websockets/ |
| OpenAI Responses | https://developers.openai.com/api/docs/guides/migrate-to-responses |
| OpenAI Responses reference | https://developers.openai.com/api/docs/reference/responses/overview |
| OpenAI key safety | https://help.openai.com/en/articles/5112595 |
| ElevenLabs auth | https://elevenlabs.io/docs/api-reference/authentication |
| Cloudflare R2 presigned URLs | https://developers.cloudflare.com/r2/api/s3/presigned-urls/ |
| AWS S3 presigned URLs | https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html |
| OWASP API Security | https://owasp.org/API-Security/editions/2023/en/0x11-t10/ |
