# Source Migration Area

**Current state:** source extraction has not started. This directory currently contains migration guidance only; the running client is the recovered runtime under `app/public/`.

This directory is intended to become the maintainable implementation layer for the production rebuild. Extraction must be incremental. The captured runtime remains the behavior reference until a corresponding source module passes visual/runtime regression checks on a supported browser/device. Source migration is not a Phase 1 completion claim.

Recommended extraction order:

1. runtime/bootstrap and device capability detection
2. asset loading/cache layer
3. renderer abstraction and shader registry
4. scene graph + camera/scroll controllers
5. content/CMS provider
6. media/project cards
7. AI/voice adapters
8. presence/multiplayer
9. diagnostics/performance instrumentation
