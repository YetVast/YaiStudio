# YAI Studio V0 — Release Baseline & V1 Handoff Architecture

**Release Tag:** `v0.1.0-baseline`  
**Git Commit:** `d4cabeb` (`UI Consistency, Navigation & Mobile UX Improvements`)  
**Git Branch:** `main`  
**Date:** 2026-11-19  

---

## 1. Technical Release Manifest

### 1.1 Core Platform Dependencies

| Dependency | Specified Version | Resolved Version | Classification | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `next` | `^15.5.29` | `15.5.29` | Production | React Full-Stack Framework (App Router) |
| `react` | `^19.0.0` | `19.0.0` | Production | Core UI Runtime |
| `react-dom` | `^19.0.0` | `19.0.0` | Production | DOM Renderer |
| `@yetvast/auth` | `^0.3.0` | `0.3.0` | Production | Yet Vast Auth Consumer SDK |
| `jose` | `^5.9.6` | `5.9.6` | Production | Server-side JWT signing & JWKS verification |
| `lucide-react` | `^0.511.0` | `0.511.0` | Production | Accessible Icon Library |
| `typescript` | `^5` | `5.7.3` | Development | Static Type System |
| `eslint` | `^9.0.0` | `9.20.1` | Development | Code Quality & Linter |
| `eslint-config-next`| `^15.0.0` | `15.1.7` | Development | Next.js ESLint Configuration |
| `vitest` | `^5.1.1` | `5.1.1` | Development | Unit & Integration Test Runner |

---

### 1.2 Route & Endpoint Inventory

The production build of commit `d4cabeb` generates 31 total routes:

#### Frontend Pages (13 App Router Pages):
1. `○ /` (Overview Dashboard)
2. `○ /_not-found` (404 Page)
3. `○ /about` (About YAI Studio & Architectural Pillars)
4. `○ /activity` (Intelligence Activity Ledger)
5. `○ /apps` (Connected Ecosystem Products)
6. `○ /conversations` (Conversations & Chat UI)
7. `○ /github-connect` (GitHub Storage OAuth Connect)
8. `○ /knowledge` (Knowledge References Explorer)
9. `○ /memory` (Personal Memory 6 Categories & Candidate Review)
10. `○ /providers` (Cloud AI Provider BYOK Settings)
11. `○ /repo-setup` (Repository Verification & Setup Wizard)
12. `○ /settings` (System Settings & Diagnostics)
13. `ƒ /sign-in` (Public Sign In with Yet Vast Auth)

#### Middleware:
- `ƒ Middleware` (`src/middleware.ts`, `34.6 kB`)

#### Backend REST API Endpoints (22 Route Handlers):
1. `ƒ /api/activity` (GET list events, POST record event)
2. `ƒ /api/auth/authorize` (GET initiate Yet Vast Auth PKCE)
3. `ƒ /api/auth/callback` (GET handle Auth code, verify JWKS assertion)
4. `ƒ /api/auth/github/callback` (GET exchange GitHub code, store encrypted token)
5. `ƒ /api/auth/github/connect` (GET initiate GitHub storage OAuth)
6. `ƒ /api/auth/session` (GET session status & user details)
7. `ƒ /api/auth/sign-out` (POST destroy session and vault cookies)
8. `ƒ /api/conversations` (GET list index, POST create conversation)
9. `ƒ /api/conversations/[id]` (GET details/messages, PATCH update title/status)
10. `ƒ /api/conversations/[id]/messages` (POST append message turn)
11. `ƒ /api/github/connection` (GET check storage connection & repo verification)
12. `ƒ /api/github/repository/create` (POST create private `YVSApps_Data_YaiStudio`)
13. `ƒ /api/knowledge` (GET list references, POST create reference)
14. `ƒ /api/memory/[type]` (GET list records, POST add active memory)
15. `ƒ /api/memory/candidates` (GET list pending candidates, POST propose candidate)
16. `ƒ /api/memory/candidates/[id]/review` (POST approve or reject candidate)
17. `ƒ /api/providers` (GET list configured providers)
18. `ƒ /api/providers/[provider]` (POST test & store key, DELETE remove key)
19. `ƒ /api/providers/[provider]/models` (GET list available models)
20. `ƒ /api/storage/initialize` (GET status, POST initialize repository files)
21. `ƒ /api/workspaces` (GET list workspaces, POST create workspace)
22. `ƒ /api/yai/context` (GET personal context for external YVS apps)
23. `ƒ /api/yai/generate` (POST cloud generation turn)

---

### 1.3 Verified Quality Baseline

- **Static Typecheck:** Passed with 0 errors (`tsc --noEmit`).
- **Unit & Integration Tests:** 9/9 passed (`vitest run`).
- **Production Build:** Compiled and generated static pages in 8.0s (`next build`).
- **Bundle Metrics:** Shared client JavaScript across all pages: **`103 kB`** (consisting of React 19 runtime, Next.js client router, and shared UI primitives).

---

## 2. V1 Transition Architecture & Technical Analysis

Version 1 will evolve YAI Studio from a cloud-connected web application into an **Installable Progressive Web Application (PWA)** featuring **on-device local inference via LiteRT-LM**.

The following section provides the required 10-point architectural analysis establishing the boundary between V0 and V1:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      YAI STUDIO V1 PWA (BROWSER)                       │
 ├──────────────────────────────────┬─────────────────────────────────────┤
 │         OFFLINE-CAPABLE UI       │           LOCAL RUNTIME             │
 │  - Service Worker Cache          │  - WebGPU Hardware Acceleration     │
 │  - IndexedDB Local Mirror        │  - LiteRT-LM Engine                 │
 │  - Offline Write Queue           │  - Local Models (Gemma 2B / 7B)     │
 └─────────────────┬────────────────┴──────────────────┬──────────────────┘
                   │ Sync Replay (when online)         │
                   v                                   v
 ┌──────────────────────────────────┐  ┌──────────────────────────────────┐
 │      GITHUB PRIVATE STORAGE      │  │        CLOUD INFERENCE           │
 │      YVSApps_Data_YaiStudio      │  │        (OpenRouter BYOK)         │
 │   Authoritative Persistent Store │  │  Complex Queries / Fallback      │
 └──────────────────────────────────┘  └──────────────────────────────────┘
```

---

### Point 1: GitHub as the Authoritative Persistent Data Store
- **V0 Reality:** All reads and writes hit the GitHub Contents API directly over the network via serverless routes. If GitHub or the network is unavailable, the application cannot read or write.
- **V1 Transition:** GitHub **remains the sole authoritative ground truth**. However, client operations in V1 must operate against a local mirror in the browser (IndexedDB). When the user is online, changes sync bidirectionally with GitHub. The remote repository remains the multi-device sync authority.
- **Suitability:** `PersonalIntelligenceStorage` interface in [`src/lib/storage/personal-intelligence-storage.ts`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/src/lib/storage/personal-intelligence-storage.ts) provides the exact data contracts required. It should be mirrored on the client as a `ClientStorageAdapter`.

---

### Point 2: Browser / PWA Local Storage Requirements
- **V0 Reality:** Zero local data caching. Only theme preference (`data-theme`) is stored in `localStorage`.
- **V1 Requirements:**
  1. **IndexedDB:** Storage for all structured data (`conversationsIndex`, `messages`, `memory`, `knowledge`, `activity`). Fast O(1) local queries.
  2. **Origin Private File System (OPFS):** Recommended for storing binary weights of local LiteRT-LM models due to high-performance synchronous block reading (`createWritable()`).
  3. **Quota Allocation:** PWA must check `navigator.storage.estimate()` to verify sufficient disk quota (typically 60% of available disk space, ensuring at least 5–10 GB available for model files).

---

### Point 3: Local Model Storage & Lifecycle (LiteRT-LM)
- **V0 Reality:** No model storage; purely stateless BYOK API calls.
- **V1 Requirements:**
  - **Supported Runtime:** LiteRT-LM (formerly TensorFlow Lite / MediaPipe GenAI runtime) compiled for WebAssembly + WebGPU.
  - **Model Formats:** Quantized models (e.g. `gemma-2b-it-gpu-int4.bin` or `gemma-2-2b-it.litert`). Model file sizes: ~1.5 GB to 2.8 GB.
  - **Storage Origin Boundary:** Models downloaded in YAI Studio are bound to origin `https://yaistudio.yetvast.com`. Browser security models prevent sharing downloaded model blobs directly with `https://cogmit.yetvast.com`.
  - **Lifecycle Management:** Dedicated UI under `/settings/local-models` showing download progress, local storage usage, model integrity hashing (SHA-256), and explicit user-triggered deletion.

---

### Point 4: Inference Provider Abstraction
- **V0 Reality:** [`src/lib/providers/index.ts`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/src/lib/providers/index.ts) routes server-side between `openrouter` and `google-ai`.
- **V1 Requirements:**
  The `executeGeneration()` signature must be extended to support a unified `InferenceProvider` interface operating across environments:
  ```typescript
  export interface InferenceProvider {
    id: 'local-litert' | 'openrouter' | 'google-ai';
    name: string;
    isAvailable(): Promise<boolean>;
    generate(request: GenerationRequest): Promise<GenerationResponse>;
    streamGenerate?(request: GenerationRequest): AsyncIterable<string>;
  }
  ```
  Local execution occurs in the browser thread or Web Worker via WebGPU; cloud execution routes via the existing server-side API.

---

### Point 5: Offline Conversation Creation
- **V0 Reality:** `POST /api/conversations` immediately attempts to commit `conversation.json`, `messages.json`, and `conversationsIndex.json` to GitHub. Fails with HTTP 500 if offline.
- **V1 Requirements:**
  - Conversations must be created locally in IndexedDB with a client-generated UUID v4.
  - An entry is immediately marked with `syncStatus: 'pending_push'`.
  - The UI navigates immediately to the new conversation without waiting for network confirmation.

---

### Point 6: Offline Operation & Queued Writes
- **V0 Reality:** Chat input is disabled when network requests fail.
- **V1 Requirements:**
  - An **Offline Operation Queue** stored in IndexedDB (`pending_mutations` table).
  - Each mutation records: `{ id, entityType, entityId, operation: 'create'|'update'|'delete', payload, timestamp, clientSha }`.
  - Mutations are processed sequentially in FIFO order when connectivity resumes.

---

### Point 7: Synchronization & Conflict Resolution
- **V0 Reality:** Server uses optimistic concurrency via GitHub file SHAs. On SHA mismatch, `putFile()` re-fetches and retries once; if still conflicting, throws `ConflictError (409)`.
- **V1 Requirements:**
  - **Three-Way Merge for Messages:** Messages are append-only. When synchronizing, remote `messages.json` and local pending messages are merged using monotonic `createdAt` timestamps and UUID deduplication, then committed as a single clean turn.
  - **Last-Write-Wins for Metadata:** For `conversation.json` and workspace renames, latest ISO timestamp takes precedence.
  - **Index Rebuilding:** `conversationsIndex.json` can be deterministically rebuilt from the union of local and remote conversation metadata.

---

### Point 8: Local versus Cloud Privacy Boundaries
- **V0 Reality:** User context is sent to OpenRouter / Google AI Studio when generating answers.
- **V1 Requirements:**
  - **Strict Local Mode ("Air-Gapped"):** When local LiteRT-LM is active, personal context and prompts **never leave the user's device**. Network requests to cloud providers are completely halted.
  - **Privacy Visual Indicator:** UI header must display a distinct badge:
    - `🟢 Local Air-Gapped (LiteRT-LM)`: 0 bytes outbound.
    - `🟡 Cloud BYOK (OpenRouter)`: Context sent to user's selected cloud model.

---

### Point 9: Device Capabilities & Model Compatibility
- **V0 Reality:** Any browser that can render Next.js runs the application.
- **V1 Requirements:**
  - **Hardware Capability Check:** Before allowing local model downloads, app must query:
    1. `navigator.gpu` (WebGPU availability).
    2. Available system RAM (`navigator.deviceMemory >= 8` recommended).
    3. Maximum storage quota (`navigator.storage.estimate()`).
  - **Graceful Fallback:** If WebGPU is unavailable (e.g. older mobile devices or unsupported browsers), the local model option is cleanly disabled with an explanatory tooltip, defaulting to Cloud BYOK.

---

### Point 10: Service Worker & PWA Lifecycle
- **V0 Reality:** Standard web application without Web App Manifest or Service Worker.
- **V1 Requirements:**
  - **Web App Manifest (`public/manifest.json`):** Configured with YVS branding, icons, standalone display mode, and `#4B0084` theme color.
  - **Service Worker (`sw.js` via Serwist or Next-PWA):**
    - Caches app shell, fonts (Inter, JetBrains Mono), icons, and static assets with a Cache-First strategy.
    - Network-First for API routes with IndexedDB fallback.
    - Background Sync API for queued mutation replay when online.

---

## 3. Code Extensibility Assessment

### Modules Suitable for Direct Extension:
1. **`src/types/personal-intelligence.ts`:** 100% reusable in V1. Types accurately represent domain entities and JSON contracts.
2. **`src/lib/storage/path-utils.ts`:** 100% reusable. Path traversal prevention and sanitization rules apply equally to offline filesystem / IndexedDB paths.
3. **`src/lib/storage/conversation-markdown.ts`:** 100% reusable. Deterministic Markdown generator works identically in client and server environments.
4. **`src/styles/tokens.css` & CSS Modules:** 100% reusable. Design system and responsive layouts are complete.
5. **`src/lib/storage/credential-vault.ts`:** Remains the standard for server-side BYOK cloud keys.

### Modules Requiring Refactoring for V1:
1. **`src/app/(app)/conversations/page.tsx`:** Must be aligned with `/api/yai/generate` payload contract (resolving prompt vs. message mismatch) and integrated with the local client storage cache.
2. **`src/lib/providers/index.ts`:** Needs to become an isomorphic or multi-target router that can delegate to a browser-side WebGPU worker or the existing server-side cloud routes.
3. **`src/lib/github/api-client.ts`:** Currently executes single-file PUT/DELETE calls. In V1, batch sync should utilize GitHub's Git Data Trees API (`POST /repos/{owner}/{repo}/git/trees` and `POST /repos/{owner}/{repo}/git/commits`) to commit multiple queued turns in a single atomic Git commit.

---

## 4. Pre-V1 Approval Gates for Product Owner

Before initiating V1 engineering, formal sign-off is required on:

1. **Local Model Selection:** Approve initial local model target (Recommended: **Google Gemma 2B-IT** quantized INT4 for mobile & desktop WebGPU compatibility).
2. **Quota & Storage Policy:** Approve maximum device storage allocation for model caching (Recommended: 3.0 GB max).
3. **Sync Strategy:** Approve three-way merge strategy for conversational history and commit batching frequency.
4. **PWA Scope:** Confirm target platforms (Desktop Chrome/Edge, Android Chrome; Safari iOS subject to WebGPU / Cache limits).
