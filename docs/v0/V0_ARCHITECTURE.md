# YAI Studio V0 — Architecture Baseline & Decision Records

**Document Version:** 1.0.0  
**Scope:** V0 Architecture Specification & Pre-V1 Decision Gates  
**Status:** Approved Engineering Baseline  

---

## 1. System Overview & System Context

YAI Studio is the central Personal Intelligence platform and context coordinator for Yet Vast Solutions (YVS). It is designed to empower individual users with private, portable, identity-aware intelligence without introducing a centralized user database or vendor-locked AI memory silos.

```text
                               +-----------------------------+
                               |     Yet Vast Solutions      |
                               |    Ecosystem Applications   |
                               +--------------+--------------+
                                              |
                   +--------------------------+--------------------------+
                   |                          |                          |
             +-----v------+            +------v------+            +------v------+
             |   Cogmit   |            |  Fyuniverse |            |   VastComm  |
             +-----+------+            +------+------+            +------+------+
                   |                          |                          |
                   +--------------------------+--------------------------+
                                              |  Authenticated YAI REST API
                                              |  (/api/yai/context, /api/activity)
                                              v
                              +-------------------------------+
                              |       YAI Studio Backend      |
                              |  (Next.js App Router Server)  |
                              +---------------+---------------+
                                              |
                 +----------------------------+----------------------------+
                 |                            |                            |
                 v                            v                            v
      +---------------------+      +---------------------+      +---------------------+
      |    Yet Vast Auth    |      |    GitHub Storage   |      | Cloud AI Providers  |
      | Identity Authority  |      |   User Data Store   |      | (OpenRouter/Google) |
      +---------------------+      +---------------------+      +---------------------+
                 |                            |                            |
      - Canonical Identity         - YVSApps_Data_YaiStudio      - BYOK Inference
      - EdDSA JWT Assertions       - Private Git Repository      - AES-256-GCM Vault
      - Provider Policies          - messages.json, memory/      - Zero central keys
```

---

## 2. Core Architectural Boundaries

### 2.1 Boundary 1: Yet Vast Auth (Central Identity Authority)
- **Role:** Owns canonical user identity, central application registration, provider mapping (Google / GitHub), and issuance of signed EdDSA identity assertion tokens.
- **YAI Studio's Role:** Acts strictly as a consumer of Yet Vast Auth via `@yetvast/auth` (v0.3.0). YAI Studio **does not** maintain a user table, password store, or identity database.
- **Boundary Rule:** Authentication proves *who the user is*. It does not grant permission to read or write the user's GitHub repository.

### 2.2 Boundary 2: GitHub (User-Owned Authoritative Persistence)
- **Role:** Authoritative persistent storage for all user intelligence data.
- **Repository:** A private GitHub repository in the user's personal account named exactly `YVSApps_Data_YaiStudio`.
- **YAI Studio's Role:** Operates as a stateless storage adapter translating domain operations into GitHub Contents API requests using fine-grained SHA tracking and optimistic concurrency.
- **Boundary Rule:** Read operations must never mutate or create data. Repository creation requires explicit user confirmation.

### 2.3 Boundary 3: Cloud AI Providers (Inference Gateways)
- **Role:** Execution of Large Language Model inference.
- **Providers:** OpenRouter (primary BYOK gateway) and Google AI Studio (Gemini secondary gateway).
- **YAI Studio's Role:** Injects Personal Intelligence context (active facts, preferences) into prompts server-side, calls provider endpoints, and records interaction summaries to the Activity Ledger.
- **Boundary Rule:** Provider credentials are never sent to the browser or stored in the user's GitHub repository.

### 2.4 Boundary 4: External Ecosystem Applications (Cogmit, Fyuniverse)
- **Role:** Independent YVS applications that query user context or report interaction events.
- **YAI Studio's Role:** Exposes `/api/yai/context` to provide verified facts/preferences and `/api/activity` to ingest activity records.
- **Boundary Rule:** Products must never depend on the YAI Studio browser UI being open; all cross-product integration occurs via backend API routes.

---

## 3. Data Authority & Sources of Truth

Every data class in YAI Studio has an unambiguous authority:

| Data Category | Authoritative Source of Truth | Secondary / Generated Projections | Storage Location |
| :--- | :--- | :--- | :--- |
| **User Identity** | Yet Vast Auth (`auth.yetvast.com`) | Host-bound session JWT (`yai_session`) | Central Auth JWKS / HTTP cookie |
| **Conversations & Messages** | `messages.json` (Structured JSON) | `conversation.md` (Markdown transcript), `conversationsIndex.json` | User's GitHub repository |
| **Workspaces Hierarchy** | `workspaceData.json` (Directory tree) | Navigation breadcrumbs | User's GitHub repository |
| **Personal Memory** | `memory/<type>s.json` | Assembled context string for LLM | User's GitHub repository |
| **Memory Candidates** | `memory/candidates/<id>.json` | Review queue UI | User's GitHub repository |
| **Activity Ledger** | `activity/<YYYY>/<MM>/<prod>/<id>.json` | Overview activity feed | User's GitHub repository |
| **Knowledge References** | `knowledge/references/<id>.json` | Knowledge explorer UI | User's GitHub repository |
| **Credentials & Tokens** | Server-Side Encrypted Vault | AES-256-GCM encrypted payload | Vercel KV REST / `yai_vault` cookie |

---

## 4. Responsibility Matrix

| Subsystem / Concern | YAI Studio | Yet Vast Auth | GitHub | Vercel | AI Providers |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Identity Authentication** | Consumer | **Authority** | - | - | - |
| **App Registration / OAuth Policy** | - | **Authority** | - | - | - |
| **Repository CRUD Authorization** | Orchestrator | - | **Authority** | - | - |
| **Intelligence Data Persistence** | Adapter | - | **Authority** | - | - |
| **Serverless Compute Runtime** | Logic | - | - | **Host** | - |
| **Encrypted Credential Storage** | Encryptor | - | - | **Storage (KV)** | - |
| **LLM Inference Execution** | Context Builder | - | - | - | **Executor** |
| **UI Presentation & Tokens** | **Authority** | - | - | - | - |

---

## 5. Architectural Deep Dives

### 5.1 Frontend Architecture
- **Framework:** Next.js 15.5.29 App Router with React 19 Server and Client Components.
- **Styling Architecture:** Strictly scoped CSS Modules (`*.module.css`) consuming CSS Custom Properties from `src/styles/tokens.css`. Utility-first CSS frameworks (Tailwind, UnoCSS) and global class cascades are prohibited.
- **Design Tokens:**
  - Canonical Brand Colors: YVS Yellow `#FFFF11` (Accent / Ring), YVS Indigo-Violet `#4B0084` (Primary brand color).
  - Light Theme: Background `#FFFFFF`, Foreground `#17121C`, Primary `#4B0084`.
  - Dark Theme: Background `#09060D`, Foreground `#F8F5FA`, Primary `#FFFF11`.
  - Typography: Inter (`--font-sans`) and JetBrains Mono (`--font-mono`).
- **State Management:** Local React state (`useState`, `useRef`, `useCallback`) and native URL search parameters. Zero heavy client state stores (Redux, MobX) to keep the client bundle lightweight (~103 kB shared JS).

### 5.2 Backend & API Architecture
- **API Runtime:** Next.js Route Handlers running on Node.js Serverless runtime.
- **Authorization Guard:** Every private API handler enforces `requireSession(request)` which cryptographically verifies the `yai_session` HS256 cookie.
- **GitHub Adapter Isolation:** All GitHub operations go through `PersonalIntelligenceStorage` (`src/lib/storage/personal-intelligence-storage.ts`). API routes never invoke GitHub REST APIs directly or manipulate raw file SHAs.
- **Error Envelopes:** Standard JSON error shape `{ error: string, gate?: string }` with appropriate HTTP status codes (400, 401, 403, 404, 409, 500).

### 5.3 Credential Vault Architecture (`src/lib/storage/credential-vault.ts`)
To satisfy Vercel serverless auto-scaling and ephemeral instance lifetimes without exposing user secrets, YAI Studio implements a three-tier encrypted vault:
1. **Tier 1 (Serverless KV):** If `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or Upstash Redis REST) are configured, encrypted payloads are persisted via HTTPS REST.
2. **Tier 2 (Host-Bound Encrypted Cookie):** Zero-infrastructure fallback. The entire encrypted vault payload is stored in a 30-day host-bound, HttpOnly, Secure cookie (`yai_vault`).
3. **Tier 3 (In-Memory Process Cache):** Sub-millisecond memoization during a single Lambda execution.
- **Encryption Algorithm:** AES-256-GCM with 96-bit random IV and authentication tag verification. Key derived from `YAI_CREDENTIAL_ENCRYPTION_KEY`. Strict per-user isolation: payloads are tagged with `yvUserId` and rejected if identity does not match.

---

## 6. Architecture Decision Records (ADRs)

### ADR-001: User-Owned GitHub Repository as Sole Intelligence Authority
- **Status:** Implemented & Verified in V0
- **Context:** Storing personal intelligence, memories, and conversational history in a central company-owned database creates significant security liabilities, privacy risks, and vendor lock-in.
- **Decision:** Use a private GitHub repository named exactly `YVSApps_Data_YaiStudio` in the user's personal GitHub account as the sole authoritative persistence store.
- **Reasoning:** Gives users complete ownership, portability, and Git version control over their personal context.
- **Consequences:** Eliminates central DB maintenance costs; introduces GitHub Contents API rate limits and latency.
- **Alternatives Considered:** PostgreSQL with Row Level Security, Supabase, CouchDB.

### ADR-002: Dual-Boundary Security (Yet Vast Auth Identity vs. GitHub Storage Auth)
- **Status:** Implemented & Verified in V0
- **Context:** A user may sign in with Google or an existing Yet Vast Auth identity, but YAI Studio still needs repository access to GitHub to persist data.
- **Decision:** Strictly separate identity authentication from GitHub storage authorization. A connected GitHub identity in Yet Vast Auth does not grant repository CRUD permissions; a dedicated GitHub OAuth flow with `repo` scope is required.
- **Reasoning:** Respects the principle of least privilege and prevents identity confusion.
- **Consequences:** Users signing in via Google must complete a secondary "Connect GitHub Storage" step.
- **Alternatives Considered:** Forcing GitHub-only login; requesting repository scopes directly during identity login.

### ADR-003: Structured Messages Authority with Human-Readable Markdown Projection
- **Status:** Implemented & Verified in V0
- **Context:** Conversations require both machine-readable metadata (token counts, models, sequence numbers) and human-readable reading/git-diffing formats.
- **Decision:** Treat `messages.json` as the canonical source of truth. Automatically generate `conversation.md` on every message turn as a read-only projection.
- **Reasoning:** Eliminates bidirectional Markdown parsing ambiguities and preserves structured conversational history.
- **Consequences:** Every turn writes both `messages.json` and `conversation.md`.
- **Alternatives Considered:** Parsing Markdown headers to derive message turns; storing only JSON without Markdown.

### ADR-004: Server-Side BYOK AI Provider Architecture with AES-256-GCM Vault
- **Status:** Implemented & Verified in V0
- **Context:** Users provide their own API keys (OpenRouter, Google AI Studio). Storing plaintext keys in GitHub violates security policies; keeping keys in browser local storage exposes them to XSS attacks.
- **Decision:** Implement a server-side encrypted vault using AES-256-GCM. Store keys in Vercel KV / encrypted cookies, and execute inference strictly server-side.
- **Reasoning:** Zero client-side key leakage; keys never enter the user's data repository.
- **Consequences:** Requires serverless compute proxying for all LLM calls.
- **Alternatives Considered:** Client-side direct browser inference; storing encrypted keys in the GitHub repo.

### ADR-005: Flat Discovery Index with Nested Directory Storage
- **Status:** Implemented & Verified in V0
- **Context:** Fast conversation listing is required without recursively walking deep nested GitHub directory trees.
- **Decision:** Maintain a top-level `conversationsIndex.json` file as a rebuildable navigation index, while storing conversation folders in nested workspace directories (`workspaces/<workspaceName>/<id>/`).
- **Reasoning:** O(1) index fetch for UI lists; preserves physical directory hierarchy for users cloning the repository.
- **Consequences:** Index must be updated during creation, rename, or message appends.
- **Alternatives Considered:** Recursive GitHub Tree API queries on every page load.

### ADR-006: Partitioned Immutable Activity Ledger
- **Status:** Implemented & Verified in V0
- **Context:** Cross-product activity logging creates rapid append events. A single monolithic `activity.json` would suffer severe Git merge and SHA conflicts.
- **Decision:** Partition activity events into individual immutable files by date and product: `activity/<YYYY>/<MM>/<product>/<id>.json`.
- **Reasoning:** Eliminates write contention; every activity record is a pure file creation without SHA dependencies.
- **Consequences:** Reading activity across months requires directory listing.
- **Alternatives Considered:** Appending to a central monthly array file.

### ADR-007: Explicit User Review for Memory Candidates
- **Status:** Implemented & Verified in V0
- **Context:** Automatic extraction of memories from every prompt can pollute personal intelligence with hallucinations or transient instructions.
- **Decision:** In V0, memory candidates are proposed into `memory/candidates/<id>.json` and require explicit user approval before promotion into `memory/<category>s.json`.
- **Reasoning:** Preserves memory quality, user trust, and transparency.
- **Consequences:** Requires manual user interaction to build memory.
- **Alternatives Considered:** Fully autonomous memory commitment without review.

---

## 7. Pre-V1 Architecture Decision Gates (Required Approvals)

Before beginning implementation of V1 (PWA & LiteRT-LM), the following architectural gates must be decided and approved:

### Gate 1: PWA Local Storage Authority & Sync Strategy
- **Context:** V1 introduces offline conversation creation and offline operations. GitHub cannot be reached while offline.
- **Proposed Decision:** Use browser IndexedDB or Origin Private File System (OPFS) as an offline write queue and local cache. The user's GitHub repo remains the ultimate source of truth.
- **Decision Needed:** Approval of queued commit replay strategy and conflict resolution policy.

### Gate 2: Local Model Storage & Lifecycle (LiteRT-LM)
- **Context:** LiteRT-LM models (e.g. Gemma 2B / 7B) range from 1.5 GB to 4.5 GB. Browser cache limits and origin boundaries apply.
- **Proposed Decision:** Download models directly into browser Cache Storage / OPFS via user-controlled discovery UI. Models remain origin-scoped.
- **Decision Needed:** Approval of maximum local storage quota allocation and user consent UX.

### Gate 3: Intelligent Inference Routing (Local vs. Cloud)
- **Context:** Users may be offline, on low-end hardware without WebGPU, or handling complex tasks requiring larger cloud models.
- **Proposed Decision:** Implement a 3-mode inference router: `Cloud-Only`, `Local-Only`, `Automatic` (local for simple tasks/offline, cloud fallback for complex queries).
- **Decision Needed:** Approval of model fallback boundaries and privacy indicators.
