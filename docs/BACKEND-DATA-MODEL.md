# Backend Data Model

Date: 2026-10-09
Status: Proposed logical schema
Source basis: captured production CMS snapshots plus backend capability analysis

## 1. Captured source schema

The reconstructed production CMS contains:

- 65 project records
- 161 media records
- global metadata
- about record
- contact links

Observed project fields include:
- id
- name
- slug
- description
- clientName
- completionDate
- projectLogo
- video
- uiColor
- tags
- priority
- createdAt
- updatedAt

Observed media fields include:
- id
- prefix
- filename
- mimeType
- filesize
- width/height when applicable
- responsive sizes
- thumbnail
- url
- createdAt
- updatedAt

The rebuild should preserve the useful semantics but normalize the structure rather than copying CMS JSON shapes into database columns.

## 2. Core entities

### projects

Purpose: canonical public project identity.

Suggested fields:
- id: UUID
- slug: unique text
- name: text
- client_name: text nullable
- description: text
- completion_date: date nullable
- ui_color: validated color token
- priority: integer
- status: draft|published|archived
- published_revision_id: UUID nullable
- created_at
- updated_at

Indexes:
- unique slug
- status + priority
- completion_date
- trigram/full-text search indexes as needed

### project_revisions

Purpose: immutable publishable versions.

Fields:
- id
- project_id
- revision_number
- payload/jsonb for editorial blocks
- created_by
- created_at
- published_at nullable

Do not mutate a published revision.

### tags

Fields:
- id
- slug
- name
- created_at

### project_tags

Join table:
- project_id
- tag_id

Unique composite key.

### media_assets

Purpose: metadata for images, video, audio, and future 3D assets.

Fields:
- id
- kind: image|video|audio|model|other
- object_key
- public_url nullable
- mime_type
- size_bytes
- width nullable
- height nullable
- duration_ms nullable
- checksum
- status: pending|ready|failed|archived
- created_at
- updated_at

Do not store binary media in PostgreSQL.

### media_variants

Fields:
- id
- media_asset_id
- variant_key
- width nullable
- height nullable
- mime_type
- size_bytes
- object_key
- public_url
- checksum

This replaces the nested sizes object from the captured CMS with a normalized model.

## 3. Project/media relation

Use a join entity instead of a single hard-coded logo/video field:

### project_media

Fields:
- project_id
- media_asset_id
- role: logo|hero|thumbnail|video|gallery|case-study|other
- sort_order
- is_primary

This allows future case studies and interactive scenes to reuse the same media system.

## 4. Global content

### site_documents

Use one generic typed content table for small global records:

Fields:
- id
- key: metadata|about|contact|navigation|footer
- revision
- status
- payload: JSONB
- created_at
- updated_at
- published_at

This is appropriate for low-volume structured documents.

Do not put high-volume project records into this JSONB table.

## 5. Search data

### project_search

Logical projection of searchable project content.

Fields:
- project_id
- normalized_text
- search_vector
- embedding
- embedding_model
- embedding_version
- indexed_at

The physical implementation may combine these fields directly into projects/project_revisions if query plans remain efficient.

Use PostgreSQL full-text search plus pgvector.

Recommended vector index:
- HNSW for the first production implementation
- evaluate IVFFlat only if build/memory characteristics justify it

The vector index should be treated as a rebuildable derived artifact, not canonical data.

## 6. Assistant data

### assistant_sessions

Fields:
- id
- public_session_id
- project_slug nullable
- started_at
- last_seen_at
- expires_at
- request_count
- status

Never use predictable sequential IDs as public identifiers.

### assistant_messages

Fields:
- id
- session_id
- role: user|assistant|system
- content
- action_payload nullable
- source_refs JSONB nullable
- provider nullable
- model nullable
- latency_ms nullable
- created_at

Retention should be configurable.

Default recommendation:
- keep only what is needed for the user experience and operational debugging
- do not retain raw user prompts indefinitely
- redact sensitive content from logs
- separate application storage from provider-side state

## 7. Realtime data

Realtime room state should be mostly ephemeral.

### realtime_rooms

Minimal durable metadata:
- id
- room_key
- status
- max_participants
- created_at
- expires_at

Do not persist every cursor movement.

Optional:
- latest scene/project snapshot
- room analytics aggregate

### realtime_sessions

Fields:
- id
- room_id
- anonymous_session_id
- joined_at
- last_seen_at
- left_at

This is enough for presence analytics without treating ephemeral movement as business data.

## 8. Analytics

### analytics_events

Fields:
- id
- anonymous_session_id
- event_type
- occurred_at
- received_at
- properties JSONB
- route
- project_slug nullable
- device_class nullable

Add retention/partitioning policies when volume grows.

Prefer allowlisted event types over accepting arbitrary event names.

## 9. Feature flags

### feature_flags

Fields:
- key
- enabled
- rollout_percent
- rules JSONB nullable
- updated_at

Only public-safe flags should leave the API.

Admin-only flags must never be serialized into public runtime configuration.

## 10. Publishing

### publish_releases

Fields:
- id
- revision_label
- status: draft|published|rolled_back
- created_at
- published_at
- published_by

A release points to project/global revisions that form one coherent site state.

This prevents a half-published CMS state where different project records come from incompatible revisions.

## 11. Jobs

### jobs

Fields:
- id
- type
- payload JSONB
- status
- attempts
- available_at
- started_at
- completed_at
- error_code
- error_message

Candidate jobs:
- generate image variants
- extract video metadata
- generate project embeddings
- rebuild search index
- purge cache
- generate voice asset
- media integrity check

A database-backed job table is enough for the initial implementation. A dedicated queue can be introduced later.

## 12. Relationship overview

~~~text
projects
  |
  +-- project_revisions
  |
  +-- project_tags --> tags
  |
  +-- project_media --> media_assets --> media_variants
  |
  +-- project_search
  |
  +-- assistant context/search references

site_documents
publish_releases
feature_flags

assistant_sessions --> assistant_messages

realtime_rooms --> realtime_sessions

analytics_events

jobs
~~~

## 13. Data ownership rules

- PostgreSQL owns canonical metadata and state.
- Object storage owns binary media.
- CDN owns delivery acceleration, not canonical metadata.
- pgvector indexes are rebuildable derived data.
- realtime connection state is ephemeral.
- analytics is append-oriented and retention-controlled.
- AI provider state is not the application's source of truth.

## 14. Data validation rules

Projects:
- slug: lowercase, URL-safe, immutable after publication unless redirect exists
- tags: normalized and deduplicated
- uiColor: validated format/token
- priority: bounded integer
- descriptions: size-limited

Media:
- MIME type verified server-side
- size limit enforced before signed upload
- file extension is not trusted as the only type check
- checksum recorded after upload
- media URL must come from an allowed storage origin

AI:
- message length bounded
- action payload schema validated
- project slugs resolved against database
- no arbitrary URLs from model output

Analytics:
- event type allowlist
- event count per request limited
- property count and string length limited
- no arbitrary nested payload explosion

## 15. Indexing strategy

Start with only indexes driven by real access patterns.

Required:
- projects.slug unique
- projects.status + priority
- project_tags.project_id + tag_id
- project_media.project_id + role + sort_order
- assistant_messages.session_id + created_at
- realtime_sessions.room_id + last_seen_at
- analytics_events.occurred_at
- project_search vector HNSW
- PostgreSQL full-text search vector

Measure query plans before adding broad indexes.

## 16. Migration strategy from captured CMS

Do not copy the captured JSON blindly.

Migration pipeline:

1. Import raw snapshots into a temporary/reference schema.
2. Validate record counts.
3. Normalize media records.
4. Create projects and tags.
5. Create project/media relations.
6. Create global documents.
7. Preserve original source IDs in a nullable source_id field.
8. Build search projections.
9. Generate embeddings as a separate job.
10. Compare public API responses against expected captured content.
11. Mark the imported dataset as reference content, not automatically published production content.

## 17. Backup and recovery

Minimum:
- managed PostgreSQL automated backups
- point-in-time recovery when available
- object storage versioning for important media
- database migration history in git
- periodic export of canonical content metadata
- documented restore procedure

Do not rely on CDN caches as backup.

## 18. Future expansion

The model leaves room for:
- case studies
- services/capabilities
- people/team records
- experimental lab entries
- curated journeys
- saved explorations
- visitor-generated notes/reactions
- localization

These should be added as explicit entities when product requirements appear rather than turning projects into a giant unstructured document.

## Sources

- Captured production snapshots in app/cms-reference/
- https://github.com/pgvector/pgvector
- https://pgvector.org/docs/
