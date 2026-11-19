# YAI Studio V1 — Implementation Roadmap & Status

---

## Milestone Execution Matrix

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
- [x] IndexedDB schema definition using Dexie (`YaiDatabase` in `src/lib/storage/client/db.ts`).
- [x] Stores: `workspaces`, `conversations`, `messages`, `memoryRecords`, `memoryCandidates`, `knowledgeReferences`, `activityRecords`, `pendingMutations`, `syncMetadata`, `localSettings`.
- [x] Versioned schema declaration (Version 1 with compound indices).
- [x] Storage quota estimation and error handling (`navigator.storage.estimate()`).
- [x] Remote-to-local initial data import/bootstrap (`importRemoteData()`).
- [x] Client storage adapter (`ClientStorageAdapter` in `src/lib/storage/client/storage-adapter.ts`).
- [x] React context `<LocalStoreProvider>` and hook `useLocalStore()`.
- [x] Automated test suite (`tests/storage/indexeddb-storage.test.ts`).

### Milestone 3: Local-First Application Integration (Phase B Cont.)
- [x] Local-first conversations experience in `src/app/(app)/conversations/page.tsx`:
  - Instant local loading from IndexedDB on page mount (0 ms latency).
  - Background reconciliation with remote GitHub repository when online.
  - Offline conversation creation with local ID generation.
  - Offline message entry with monotonic sequence preservation.
  - Synchronization state indicators (`saved`, `saving`, `error`, `pending_push`).

### Milestone 4: Mutation Queue & Synchronization Engine (Phase C)
- [x] Persistent `PendingMutation` queue in IndexedDB.
- [x] `SyncOrchestrator` (`src/lib/sync/sync-orchestrator.ts`):
  - Ordered chronological execution of pending mutations.
  - Mutex lock preventing concurrent duplicate sync runs.
  - Bounded retry tracking with last error capture.
  - Auto-sync trigger on reconnect (`window.addEventListener('online')`) and periodic heartbeat.
  - Conflict detection (HTTP 409) marking mutation and entity as `conflict`.
- [x] Automated test suite (`tests/sync/sync-orchestrator.test.ts`).

### Milestone 5: Inference Provider Abstraction (Phase D)
- [x] Common inference types and contracts (`src/lib/inference/types.ts`):
  - Supports `local-litert`, `openrouter`, and `google-ai`.
  - Capabilities, requirements, modes, environments, and metrics.
- [x] `InferenceRouter` (`src/lib/inference/inference-router.ts`):
  - Dispatches `local-litert` to on-device engine.
  - Dispatches `openrouter` / `google-ai` to server-side vaulted `/api/yai/generate`.

### Milestone 6: LiteRT-LM Technical Proof of Concept (Phase D Cont.)
- [x] WebGPU and WASM runtime evaluation (`@litert-lm/core` / `@mediapipe/tasks-genai` analysis).
- [x] `LiteRTEngine` (`src/lib/inference/litert-engine.ts`) with Gemma prompt template.
- [x] Isolated Proof of Concept harness (`src/lib/inference/litert-poc.ts`):
  1. Runtime initialization & capability probing.
  2. Model loading.
  3. Local prompt execution.
  4. Response generation.
  5. Privacy assertion: 0 outbound cloud requests verified.
  6. Latency, tokens/sec, and memory measurements.
- [x] Automated test suite (`tests/inference/inference-router.test.ts`).

### Milestone 7: Model Lifecycle & Device Management
- [x] WebGPU capability detector (`src/lib/inference/device-capabilities.ts`).
- [x] Vetted local model catalog (`src/lib/inference/local-model-registry.ts`):
  - Gemma 2 2B Instruct (INT4) — `.litertlm` format.
  - Gemma 1.1 2B Instruct (INT4) — `.bin` format.
- [x] `LocalModelManager` (`src/lib/inference/model-manager.ts`):
  - On-demand user-initiated downloads.
  - Progress streaming and SHA-256 verification step.
  - Deletion and storage reclamation.
- [x] Model management UI at `/settings/local-models`:
  - Hardware & WebGPU diagnostics.
  - Storage quota gauge (used / free / total).
  - Model catalog with download progress and deletion.
  - In-browser POC test trigger with live benchmark metrics.
- [x] Automated test suite (`tests/inference/model-manager.test.ts`).

### Milestone 8: Local / Cloud Privacy Modes
- [x] Explicit inference modes: `local` vs. `cloud`.
- [x] Hard privacy boundary: Local mode strictly blocks outbound requests; NO SILENT CLOUD FALLBACK.
- [x] Persistent privacy mode badge in conversation UI:
  - `Local — On-Device (LiteRT-LM)` with shield icon.
  - `Cloud — OpenRouter` with cloud icon.
- [x] Quick mode toggle in conversation header.
