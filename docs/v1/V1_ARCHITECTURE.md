# YAI Studio V1 — Architecture Specification
## Local-First PWA, IndexedDB Synchronization and LiteRT-LM

---

## 1. Architectural Mission

YAI Studio V1 evolves YAI Studio from a cloud-dependent web application into a **local-first Personal Intelligence platform**.

The application operates across three cooperating architectural layers:

```text
YAI Studio V1 Architecture
│
├── Layer A: Local Application Layer (Browser / On-Device)
│   ├── Installable Progressive Web Application (PWA)
│   ├── Offline-capable Application Shell (Service Worker)
│   ├── IndexedDB Structured Data Store (Dexie / IDB Adapter)
│   ├── Local-first Conversation & Personal Intelligence Engine
│   ├── Persistent Offline Mutation Queue
│   └── On-Device Inference Runtime (LiteRT-LM / WebGPU)
│
├── Layer B: User-Owned Persistence Layer (Authoritative Remote Store)
│   ├── User's Private GitHub Repository: `YVSApps_Data_YaiStudio`
│   ├── Git Trees and Commits (Authoritative Truth & Audit Trail)
│   ├── SHA-based Optimistic Concurrency & Divergence Reconciliation
│   └── Offline-to-Remote Bidirectional Synchronization Orchestrator
│
└── Layer C: Inference Layer (Hybrid Local / Cloud BYOK)
    ├── Local Mode: Strict On-Device Execution via LiteRT-LM (Zero Outbound Requests)
    └── Cloud Mode: Server-Side Vaulted BYOK (OpenRouter / Google AI Studio)
```

---

## 2. Invariant Architectural Boundaries

1. **Identity vs. Storage Authorization**:
   - Yet Vast Auth (`@yetvast/auth`) authenticates the user's cross-product identity.
   - Separate GitHub OAuth authorization grants storage access to `YVSApps_Data_YaiStudio`.
   - Identity authentication does not inherently grant repository access, and repository access does not substitute for identity.

2. **User-Owned Persistence Authority**:
   - The user's private GitHub repository remains the **authoritative persistent data store**.
   - Local browser storage (IndexedDB) is a **working replica**, never a replacement for the remote source of truth.
   - YAI Studio operates **zero central personal data servers**.

3. **Credential & Secret Isolation**:
   - BYOK API keys (OpenRouter, Google AI Studio) and GitHub OAuth access tokens **never enter client bundles, IndexedDB, or the Service Worker cache**.
   - Keys remain encrypted server-side in the AES-256-GCM vault.
   - The Service Worker strictly bypasses `/api/*`, `/sign-in`, and authorization-bearing requests.

4. **Inference Execution Boundaries**:
   - In **Local Mode**, prompt construction, context retrieval, and generation occur strictly on-device using LiteRT-LM. No outbound network requests are made.
   - If local execution fails or resources are insufficient, the failure is reported to the user. **No silent fallback to cloud occurs**.
   - In **Cloud Mode**, user requests are processed server-side via the vaulted BYOK provider.

---

## 3. Component Architecture and Data Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                       Browser / Device                      │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                 React UI Components                 │   │
│   │   (AppShell, Conversations, Workspaces, Settings)   │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│              ┌───────────────┴───────────────┐              │
│              ▼                               ▼              │
│   ┌─────────────────────┐         ┌─────────────────────┐   │
│   │ Local Domain Client │         │ Inference Controller│   │
│   └──────────┬──────────┘         └──────────┬──────────┘   │
│              │                               │              │
│     ┌────────┴────────┐            ┌─────────┴─────────┐    │
│     ▼                 ▼            ▼                   ▼    │
│ ┌─────────┐     ┌───────────┐ ┌─────────┐       ┌──────────┐│
│ │IndexedDB│     │ Mutation  │ │Local LM │       │Server API││
│ │ Replica │     │   Queue   │ │(LiteRT) │       │ (Cloud)  ││
│ └─────────┘     └─────┬─────┘ └─────────┘       └────┬─────┘│
└───────────────────────┼──────────────────────────────┼──────┘
                        │                              │
                        ▼ (Sync Engine)                │
            ┌───────────────────────┐                  │
            │   GitHub Storage API  │                  │
            │(YVSApps_Data_YaiStudio│                  │
            └───────────────────────┘                  │
                                                       ▼
                                            ┌──────────────────┐
                                            │ Cloud Providers  │
                                            │(OpenRouter/Gemini│
                                            └──────────────────┘
```

---

## 4. Service Worker Security & Shell Strategy

- **Service Worker Location**: `/sw.js`
- **Scope**: `/`
- **Cache Strategy**:
  - `/_next/static/*`, `/icons/*`, `/manifest.webmanifest`, `/favicon.ico`: Cache-first with stale-while-revalidate update.
  - HTML Page Navigation (`mode === 'navigate'`): Network-first with cached page fallback and ultimate `/offline` fallback.
  - `/api/*`, `/sign-in`, and authorization requests: **Strict cache bypass (network-only)**.
- **Cache Invalidation**:
  - Versioned cache keys (`yai-static-v1.0.0`, `yai-pages-v1.0.0`).
  - Outdated caches deleted on `activate`.
  - Supports `SKIP_WAITING` for immediate user-directed updates.
