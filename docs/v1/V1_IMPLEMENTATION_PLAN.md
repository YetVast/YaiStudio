# YAI Studio V1 — Implementation Roadmap & Plan

---

## Milestone Breakdown

### Milestone 1: PWA Foundation (Phase A — Immediate)
- [x] Web App Manifest with YVS design tokens (`/manifest.webmanifest`, `/manifest.json`).
- [x] Icon generation (192px, 512px, maskable 192px, maskable 512px, vector SVG, favicon).
- [x] Standalone display mode & theme color (`#4B0084` primary, `#09060D` dark background).
- [x] Application shell service worker (`/sw.js`) with pre-caching and versioned cache cleanup.
- [x] Offline fallback (`/offline` route and static `public/offline.html`).
- [x] Online / offline connectivity indicator in `AppShell` header and `Settings`.
- [x] Installability detection (`beforeinstallprompt`) and Install UX.
- [x] Service worker update handling (`updatefound`, `SKIP_WAITING`, prompt).
- [x] Security policies: strict cache bypass for `/api/`, sign-in, and auth requests.
- [x] Vitest suites for manifest and service worker security.

### Milestone 2: IndexedDB Storage Foundation (Phase B)
- [ ] IndexedDB schema definition with Dexie or native IDB wrapper.
- [ ] Stores: `workspaces`, `conversations`, `messages`, `memoryRecords`, `memoryCandidates`, `knowledgeReferences`, `activityRecords`, `pendingMutations`, `syncMetadata`, `localSettings`.
- [ ] Versioned schema migrations.
- [ ] Storage quota estimation and error handling.
- [ ] Remote-to-local initial data import/bootstrap.

### Milestone 3: Local-First Application Integration (Phase B Cont.)
- [ ] Client domain services reading and writing to IndexedDB first.
- [ ] Immediate UI state update without network roundtrips.
- [ ] Local conversation and message creation offline.
- [ ] Synchronous response feel with asynchronous background synchronization.

### Milestone 4: Mutation Queue & Synchronization Engine (Phase C)
- [ ] Persistent `PendingMutation` queue in IndexedDB.
- [ ] Ordered execution of dependent mutations.
- [ ] Idempotency keys and bounded exponential retry backoff.
- [ ] GitHub Git Data API (trees/commits) batching.
- [ ] Optimistic concurrency control (SHA matching) and divergence detection.
- [ ] Append-only message merge and deduplication by ID.
- [ ] User-facing conflict resolution and synchronization error UI.

### Milestone 5: Inference Provider Abstraction (Phase D)
- [ ] Unified inference interface supporting `local-litert`, `openrouter`, and `google-ai`.
- [ ] Execution mode isolation: Local vs. Cloud BYOK.
- [ ] Streaming, cancellation, and capability discovery.

### Milestone 6: LiteRT-LM Technical Proof of Concept (Phase D Cont.)
- [ ] WebGPU and WASM runtime compatibility probing.
- [ ] Isolated POC demonstrating model load and local prompt execution.
- [ ] Zero outbound cloud request verification in local mode.
- [ ] Resource and memory measurement.

### Milestone 7: Model Lifecycle & Device Management
- [ ] WebGPU capability detection and storage estimation.
- [ ] User-initiated model download and progress UX.
- [ ] OPFS binary storage and SHA-256 integrity verification.
- [ ] Dedicated settings page: `/settings/local-models`.

### Milestone 8: Local / Cloud Privacy Modes
- [ ] Explicit conversation-level and workspace-level execution indicators.
- [ ] Hard enforcement: strict local mode blocks network requests; no silent cloud fallback.
- [ ] Privacy clarity between network sync and inference execution.
