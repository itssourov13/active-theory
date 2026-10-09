# Security Baseline

## Current audit findings

Historical experiment bundles contain credential-shaped OpenAI/Google API strings. The current V6 production bundle contains placeholder AI credentials rather than a detected live secret.

A read-only token-pattern scan of the 447 workspace files on 2026-10-09 found OpenAI-like token-shaped matches only in `app/public/assets/js/app.1780406240914.js` and its preserved copy under `vendor/forensic/current-v6/`. The matched values were not printed or copied into this report; the prior forensic review classified the current bundle's AI values as placeholders. The scan did not prove credential validity, and a pattern match alone is not evidence that a key works. Re-check safely before future public releases, and revoke any confirmed real credential. No matches were reported by that scan for the checked Google API key, GitHub token, AWS key ID, private-key header or Slack token patterns.

Treat historical token-shaped strings as potentially compromised until explicitly verified or revoked.

## Rebuild requirements

- No private API secret may ship in `app/public/` or any browser bundle.
- AI and voice providers must be reached through a server-side endpoint or intentionally public, non-secret mechanism.
- Add CI secret scanning before the first production deployment.
- Add CSP, Referrer-Policy and Permissions-Policy after documenting all required external origins.
- Keep Google Cloud Storage/media access isolated from write-capable credentials.
- Rate-limit AI, speech and presence endpoints.
- Log provider failures without logging secrets or user prompts containing sensitive data.

## Backend threat model

The public site is intentionally anonymous, so the API must assume hostile clients rather than trusted visitors.

### Primary boundaries

- Browser -> HTTP API
- Browser -> WebSocket realtime service
- Admin/editor -> content/media APIs
- API -> PostgreSQL
- API -> object storage
- API -> AI/voice providers

### Required controls

- Strict CORS allowlist for production origins.
- Request body and response size limits.
- Per-route rate limits, not only a global limit.
- Anonymous-session abuse controls for AI, voice, search and analytics.
- Object-level authorization for every non-public resource.
- Allowlisted AI action types with server-side target validation.
- No arbitrary URL fetches from user/model input; external fetches require an allowlist and SSRF-safe handling.
- Signed uploads are short-lived, scoped to a single object/key and constrained by content type/size.
- Uploads are not published until server-side verification succeeds.
- WebSocket rooms enforce connection, message-rate and payload-size limits.
- Secrets come only from environment/secret-management systems.
- Provider and database errors are normalized before reaching public clients.
- Logs redact authorization headers, API keys, signed URLs and sensitive request content.
- Public API and realtime protocols are versioned and inventoried.

## AI-specific security

Treat all of the following as untrusted:

1. User prompts.
2. Retrieved project/CMS text.
3. Model output.
4. Any URL or identifier proposed by the model.

The assistant may return navigation intents such as open_project, but the server must resolve the target against the canonical database before sending the action to the client.

The model must never receive direct authority to execute database queries, shell commands, storage operations, content publication, arbitrary network requests or administrative actions.

## Media/SSRF security

The backend should not accept an arbitrary remote URL and immediately fetch it.

Where remote ingestion is needed:
- allowlist schemes and hosts
- resolve and validate destination safely
- block private/link-local/internal ranges
- apply response-size and time limits
- verify content type after retrieval
- store the resulting object under a server-generated key

## Reference

OWASP API Security Top 10 (2023):
https://owasp.org/API-Security/editions/2023/en/0x11-t10/

OpenAI key safety:
https://help.openai.com/en/articles/5112595

ElevenLabs authentication:
https://elevenlabs.io/docs/api-reference/authentication

R2 presigned URLs:
https://developers.cloudflare.com/r2/api/s3/presigned-urls/
