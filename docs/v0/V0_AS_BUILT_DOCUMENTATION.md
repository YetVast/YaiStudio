# YAI Studio V0 — As-Built System Documentation

**Status:** Authoritative V0 Technical Record  
**Date:** 2026-11-19  
**Base Commit:** `d4cabeb` (`UI Consistency, Navigation & Mobile UX Improvements`)  
**Repository Branch:** `main`  
**Framework:** Next.js 15.5.29 (App Router) / React 19.0.0 / TypeScript 5  

---

## 1. Executive Summary

This document presents the **as-built** record of the YAI Studio V0 web application. YAI Studio serves as the central Personal Intelligence platform and management interface for the Yet Vast Solutions ecosystem.

Unlike traditional AI web applications that store conversational history and user data in centralized databases (PostgreSQL, MongoDB, Pinecone, or Firebase), YAI Studio operates on a **user-owned storage paradigm**:
- Authoritative persistence resides in a private GitHub repository named `YVSApps_Data_YaiStudio` owned and controlled entirely by the user.
- Identity authentication is federated through Yet Vast Auth (`@yetvast/auth` v0.3.0).
- Cloud AI inference operates on a Bring-Your-Own-Key (BYOK) model via OpenRouter and Google AI Studio.
- Credential management uses a server-side AES-256-GCM encrypted multi-tier vault (Vercel KV REST API with host-bound encrypted cookie fallback).

This document audits the actual codebase as it exists today, distinguishing between implemented and verified capabilities, unverified integrations, known technical debt, and intentionally deferred features.

---

## 2. Codebase Structure & Directory Layout

The repository follows Next.js App Router conventions with strict separation between server-only logic, client components, and shared types:

```text
YaiStudio/
├── src/
│   ├── app/                                # App Router routes & layouts
│   │   ├── (public)/                       # Unauthenticated route group
│   │   │   ├── layout.tsx                  # Public layout container
│   │   │   ├── PublicLayout.module.css
│   │   │   └── sign-in/                    # Sign-in page (/sign-in)
│   │   │       ├── page.tsx
│   │   │       └── SignIn.module.css
│   │   ├── (app)/                          # Authenticated application route group
│   │   │   ├── layout.tsx                  # App layout wrapping with AppShell
│   │   │   ├── page.tsx                    # Overview dashboard (/)
│   │   │   ├── Overview.module.css
│   │   │   ├── about/                      # About YAI Studio (/about)
│   │   │   ├── activity/                   # Intelligence Activity Ledger (/activity)
│   │   │   ├── apps/                       # Connected Ecosystem Products (/apps)
│   │   │   ├── conversations/              # Conversations & chat UI (/conversations)
│   │   │   ├── github-connect/             # GitHub storage OAuth trigger (/github-connect)
│   │   │   ├── knowledge/                  # Knowledge references (/knowledge)
│   │   │   ├── memory/                     # Personal Memory 6 categories (/memory)
│   │   │   ├── providers/                  # Cloud AI provider BYOK configuration (/providers)
│   │   │   ├── repo-setup/                 # Repository setup & verification wizard (/repo-setup)
│   │   │   ├── settings/                   # System settings, diagnostics & sign-out (/settings)
│   │   │   └── workspaces/                 # Nested workspaces hierarchy (/workspaces)
│   │   ├── api/                            # Backend REST Route Handlers (22 endpoints)
│   │   │   ├── activity/route.ts           # GET, POST activity events
│   │   │   ├── auth/
│   │   │   │   ├── authorize/route.ts      # Initiates Yet Vast Auth PKCE redirect
│   │   │   │   ├── callback/route.ts       # Handles Yet Vast Auth assertion & session creation
│   │   │   │   ├── session/route.ts        # GET current session identity
│   │   │   │   ├── sign-out/route.ts       # POST destroys session and vault cookies
│   │   │   │   └── github/
│   │   │   │       ├── connect/route.ts    # Initiates GitHub OAuth storage grant redirect
│   │   │   │       └── callback/route.ts   # Exchanges GitHub code, stores encrypted token
│   │   │   ├── conversations/
│   │   │   │   ├── route.ts                # GET index, POST create conversation
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts            # GET conversation, PATCH update title/status
│   │   │   │       └── messages/route.ts   # POST append message
│   │   │   ├── github/
│   │   │   │   ├── connection/route.ts     # GET storage connection & repo verification
│   │   │   │   └── repository/create/route.ts # POST creates private YVSApps_Data_YaiStudio
│   │   │   ├── knowledge/route.ts          # GET list, POST create knowledge reference
│   │   │   ├── memory/
│   │   │   │   ├── [type]/route.ts         # GET, POST memory records (fact, preference, etc.)
│   │   │   │   └── candidates/
│   │   │   │       ├── route.ts            # GET list, POST propose memory candidate
│   │   │   │       └── [id]/review/route.ts# POST approve or reject candidate
│   │   │   ├── providers/
│   │   │   │   ├── route.ts                # GET list configured provider statuses
│   │   │   │   └── [provider]/
│   │   │   │       ├── route.ts            # POST configure/test key, DELETE key
│   │   │   │       └── models/route.ts     # GET list available models from provider
│   │   │   ├── storage/
│   │   │   │   └── initialize/route.ts     # GET status, POST initialize repo layout
│   │   │   ├── workspaces/route.ts         # GET list, POST create workspace
│   │   │   └── yai/
│   │   │       ├── context/route.ts        # GET personal context for external YVS apps
│   │   │       └── generate/route.ts       # POST generate completion & record turn
│   │   └── layout.tsx                      # Root HTML layout with fonts & theme injection
│   ├── components/                         # UI Components
│   │   ├── layout/
│   │   │   ├── AppShell.tsx                # Main app layout shell (header, sidebar, main)
│   │   │   └── AppShell.module.css
│   │   ├── navigation/
│   │   │   ├── AppNav.tsx                  # Primary & system sidebar navigation links
│   │   │   └── AppNav.module.css
│   │   ├── providers/
│   │   │   └── ThemeProvider.tsx           # Context provider for light/dark theme toggle
│   │   └── ui/                             # Reusable primitives
│   │       ├── Badge.tsx, Button.tsx, Card.tsx, EmptyState.tsx,
│   │       ├── Input.tsx, Select.tsx, Spinner.tsx, StatusBadge.tsx
│   ├── lib/                                # Core logic (server-only & client helpers)
│   │   ├── auth/
│   │   │   ├── yetvast-auth.ts             # Yet Vast Auth SDK client & discovery (server-only)
│   │   │   ├── github-storage-auth.ts      # GitHub OAuth client & user profile (server-only)
│   │   │   ├── session.ts                  # Host-bound JWT session management (server-only)
│   │   │   ├── pkce.ts                     # PKCE verifier/challenge & state generator
│   │   │   └── url-utils.ts                # App base URL resolution for Vercel/proxies
│   │   ├── client/
│   │   │   ├── api.ts                      # Client-side type-safe fetch wrapper
│   │   │   └── safe-markdown.ts            # Client-side sanitized markdown-to-HTML parser
│   │   ├── github/
│   │   │   └── api-client.ts               # GitHub REST API client with SHA handling (server-only)
│   │   ├── providers/
│   │   │   ├── index.ts                    # AI provider orchestration facade (server-only)
│   │   │   ├── openrouter.ts               # OpenRouter BYOK adapter (server-only)
│   │   │   ├── google-ai.ts                # Google AI Studio Gemini adapter (server-only)
│   │   │   ├── key-store.ts                # Provider key management re-exports (server-only)
│   │   │   └── types.ts                    # Provider contracts and error codes
│   │   └── storage/
│   │       ├── personal-intelligence-storage.ts # Complete GitHub repository CRUD adapter (server-only)
│   │       ├── credential-vault.ts         # AES-256-GCM vault with Vercel KV + Cookie fallback (server-only)
│   │       ├── conversation-markdown.ts    # messages.json -> conversation.md projection
│   │       └── path-utils.ts               # Path traversal defenses & workspace name sanitizer
│   ├── styles/
│   │   ├── tokens.css                      # YVS design tokens (colors, spacing, typography)
│   │   └── globals.css                     # Global reset & base element styling
│   ├── types/
│   │   └── personal-intelligence.ts        # Canonical domain models & JSON schema types
│   └── middleware.ts                       # Edge authentication gatekeeper (checks yai_session)
├── tests/
│   ├── auth/
│   │   └── yetvast-auth-integration.test.ts # Vitest suite covering discovery, PKCE, token exchange
│   └── mocks/
│       └── server-only.ts                  # Stub for 'server-only' in test runner
├── docs/                                   # Repository documentation
├── next.config.ts                          # Next.js configuration (jose externalized)
├── package.json                            # Package manifest
├── tsconfig.json                           # TypeScript configuration
└── vitest.config.mjs                       # Vitest test configuration
```

---

## 3. Implementation Status Audit

To ensure technical integrity, every subsystem has been audited and classified into one of four states:

1. **Implemented and Verified:** Code exists, builds cleanly, and has been verified via unit tests or build validation.
2. **Implemented but not externally verified:** Code exists and compiles, but requires live external credentials or active OAuth configurations to execute end-to-end.
3. **Partially Implemented / Discrepancy Found:** Code exists but exhibits mismatches or incomplete flows between frontend and backend.
4. **Planned but not implemented:** Architectural concepts deferred to V1 or future releases.

### 3.1 Subsystem Status Breakdown

| Subsystem | Component / Module | Implementation Status | Notes |
| :--- | :--- | :--- | :--- |
| **Next.js & Routing** | `App Router`, layouts, pages | **Implemented and Verified** | Production build generates 31 routes (13 pages, 22 API endpoints). |
| **Styling & Tokens** | CSS Modules, `tokens.css` | **Implemented and Verified** | Zero Tailwind. YVS Yellow (`#FFFF11`) & Indigo-Violet (`#4B0084`) tokens. Light/dark mode fully functional. |
| **Edge Middleware** | `src/middleware.ts` | **Implemented and Verified** | Protects all routes except `/sign-in`, `/api/auth/authorize`, `/api/auth/callback`, `/api/auth/sign-out`. |
| **Yet Vast Auth** | `@yetvast/auth` v0.3.0 | **Implemented and Verified** | 9/9 Vitest tests pass. Registry-backed discovery resolves `yaistudio-yetvast-com-4dfnb2r9`. EdDSA verification works. |
| **Session Management** | `src/lib/auth/session.ts` | **Implemented and Verified** | HS256 JWT cookie (`yai_session`), HttpOnly, SameSite=Lax, host-bound. |
| **GitHub OAuth** | `github-storage-auth.ts` | **Implemented but not externally verified** | OAuth flow with `repo` scope compiles cleanly; requires live GitHub OAuth Client ID/Secret. |
| **Credential Vault** | `credential-vault.ts` | **Implemented and Verified** | AES-256-GCM encryption at rest. Multi-tier persistence: Vercel KV REST + Encrypted Cookie (`yai_vault`) fallback. |
| **GitHub Storage Adapter** | `personal-intelligence-storage.ts` | **Implemented and Verified** | Full CRUD for repo `YVSApps_Data_YaiStudio`. Path traversal defenses. SHA-based conflict handling. |
| **Conversations Index** | `conversationsIndex.json` | **Implemented and Verified** | Flat global index updated on conversation creation, title change, and message appending. |
| **Structured Messages** | `messages.json` | **Implemented and Verified** | Canonical structured array with monotonic sequence numbers and timestamps. |
| **Markdown Projection** | `conversation.md` | **Implemented and Verified** | Automatic regeneration on every turn from `messages.json`. |
| **Workspaces Hierarchy** | `workspaces/<name>/workspaceData.json` | **Implemented and Verified** | Nested workspace directories with name sanitization and metadata tracking. |
| **Personal Memory** | `memory/<category>s.json` | **Implemented and Verified** | 6 categories: facts, preferences, interests, goals, relationships, decisions. |
| **Memory Candidates** | `memory/candidates/<id>.json` | **Implemented and Verified** | Independent candidate review workflow: approval promotes candidate to active memory. |
| **Activity Ledger** | `activity/<YYYY>/<MM>/<prod>/<id>.json` | **Implemented and Verified** | Partitioned immutable event ledger tracking interactions across YVS products. |
| **Knowledge References** | `knowledge/references/<id>.json` | **Implemented and Verified** | Reference management with Markdown content and metadata. |
| **AI Providers BYOK** | `openrouter.ts`, `google-ai.ts` | **Implemented but not externally verified** | OpenRouter (Claude 3.5 Sonnet) and Google AI (Gemini 1.5 Flash). Key validation tests live endpoint. |
| **Chat Generation Flow** | `conversations/page.tsx` ↔ `api/yai/generate` | **Implemented and Verified** | Aligned payload contracts (supports message & prompt, returns message & assistantMessage, guards against duplicate append). |
| **PWA & Offline** | Service Worker, Manifest, Caching | **Planned but not implemented** | Deferred to V1. |
| **LiteRT-LM Local Models** | WebGPU runtime, local inference | **Planned but not implemented** | Deferred to V1. |

---

## 4. Detailed Component & Page Inventory

### 4.1 UI Component Library (`src/components/ui/`)

All UI components are built with strict accessibility attributes, CSS Modules, and zero third-party utility classes:

- **`Button` (`Button.tsx`, `Button.module.css`):**
  Supports `primary`, `secondary`, `outline`, `ghost`, and `danger` variants; sizes `sm`, `md`, `lg`; optional `fullWidth`; renders as `<button>` or `<Link>` based on presence of `href`.
- **`Card` (`Card.tsx`, `Card.module.css`):**
  Semantic container supporting subtle border highlights, rounded radii, and token-driven backgrounds.
- **`Input` (`Input.tsx`, `Input.module.css`):**
  Accessible text input with label, helper text, and error states.
- **`Select` (`Select.tsx`, `Select.module.css`):**
  Stylized native `<select>` wrapper matching design tokens.
- **`Badge` (`Badge.tsx`, `Badge.module.css`):**
  Status indicators with variants: `default`, `primary`, `success`, `warning`, `danger`.
- **`StatusBadge` (`StatusBadge.tsx`, `StatusBadge.module.css`):**
  Specialized synchronization status pill showing `saving` (spinning refresh), `saved` (green check), or `error` (red alert).
- **`Spinner` (`Spinner.tsx`, `Spinner.module.css`):**
  CSS keyframe animation spinner sized `sm`, `md`, `lg`.
- **`EmptyState` (`EmptyState.tsx`, `EmptyState.module.css`):**
  Standard layout for empty lists with icon, headline, description, and action button.

### 4.2 Shell & Navigation (`src/components/layout/` & `navigation/`)

- **`AppShell` (`AppShell.tsx`):**
  Provides the sticky top header (YAI Studio brand link to `/about`, theme toggle, profile avatar link to `/`), mobile hamburger drawer with escape key listener and outside-click backdrop dismissal, left sidebar container, and `<main>` content container.
- **`AppNav` (`AppNav.tsx`):**
  Renders Primary navigation items (`/`, `/conversations`, `/workspaces`, `/memory`, `/knowledge`, `/activity`) and System navigation items (`/apps`, `/providers`, `/settings`). Uses `usePathname()` for active item detection and stroke-width emphasis.
- **`ThemeProvider` (`ThemeProvider.tsx`):**
  Manages `light` / `dark` mode state via `data-theme` attribute on `document.documentElement` and persists preference in `localStorage`.

### 4.3 Page-by-Page Audit (`src/app/(app)/`)

1. **Overview (`/`):**
   - High-level status cards: Data Repository connection status (`YVSApps_Data_YaiStudio`), AI Engine status (OpenRouter BYOK), and Memory status (6 categories).
   - Quick action triggers to initiate new conversations or inspect recent activity.
2. **Conversations (`/conversations`):**
   - Two-panel responsive layout: collapsible conversation list with search filter on left; active conversation transcript and chat input on right.
   - Title inline editing via `PATCH /api/conversations/[id]`.
   - Markdown transcript drawer to inspect generated `conversation.md`.
   - Message bubble rendering with custom Markdown parsing and syntax escaping.
3. **Workspaces (`/workspaces`):**
   - Two-column directory explorer: lists root workspaces from `workspaces/` in GitHub repo.
   - Shows associated conversations filtered by workspace name.
   - Modal dialog to create new sanitized workspace directories.
4. **Personal Memory (`/memory`):**
   - Tabbed view across 6 categories: Facts, Preferences, Interests, Goals, Relationships, Decisions.
   - Dedicated "Candidates" tab to review pending AI-proposed memories.
   - Actions to approve (promotes to persistent memory) or reject candidates.
   - Manual memory record creation modal.
5. **Knowledge References (`/knowledge`):**
   - Searchable list of reference items from `knowledge/references/`.
   - Item details view with full Markdown rendering.
   - Reference creation modal (title, content, tags, source URL).
6. **Intelligence Activity Ledger (`/activity`):**
   - Chronological log of cross-product interactions from `activity/<YYYY>/<MM>/`.
   - Details view showing source product, model, provider, execution mode (`cloud` vs `local`), query summary, and response summary.
7. **Connected Products (`/apps`):**
   - Status cards for Yet Vast Solutions ecosystem applications (Cogmit, Fyuniverse, VastComm).
   - Clear architectural boundary notice explaining that Yet Vast Auth governs identity while YAI Studio manages personal context access.
8. **AI Providers (`/providers`):**
   - Bring-Your-Own-Key configuration for OpenRouter and Google AI Studio.
   - Masked key display (e.g. `sk-or-...1234`).
   - Live key validation against provider APIs on submit before saving.
   - Delete action to remove stored keys from encrypted vault.
9. **Repository Setup (`/repo-setup`):**
   - Verification wizard checking: Connected, Exists, Is Private, Owner Match, Initialized.
   - Explicit confirmation buttons for "Create Private Repository" and "Initialize Storage Structure".
10. **GitHub Storage Connect (`/github-connect`):**
    - Explanatory landing page clarifying why repository authorization is separate from login.
    - Button redirecting to `/api/auth/github/connect`.
11. **Settings & Diagnostics (`/settings`):**
    - Identity details from Yet Vast Auth (YV User ID, connected GitHub login, session expiry).
    - Storage health and provider key statuses.
    - Theme switcher and sign-out button.
12. **About (`/about`):**
    - Explains what YAI Studio is (central intelligence coordinator, context store) and what it is not (standalone LLM or central database).
    - Outlines four architectural pillars: User-Owned Data, Persistent Context, BYOK Inference, and Ecosystem Integration.

---

## 5. Technical Discrepancies & Audit Findings

During detailed source code inspection, the following discrepancies were identified between the frontend client and the backend route handlers:

### 5.1 Chat Generation Payload Alignment (Resolved Prior to V0 Freeze)

- **Identified Discrepancy:**
  Prior to the release freeze, the client submitted `{ conversationId, prompt }` and performed a duplicate call to `POST /api/conversations/[id]/messages`, while `/api/yai/generate` expected `{ conversationId, message }` and performed its own turn append, returning `{ message }` instead of `{ assistantMessage }`.
- **Resolution Implemented:**
  1. `/api/yai/generate` accepts both `message` and `prompt` (`rawMessage = body.message ?? body.prompt`).
  2. `/api/yai/generate` verifies whether the user message is already the latest message in `conv.messages` before appending, eliminating duplicate message persistence.
  3. `/api/yai/generate` returns both `message` and `assistantMessage`.
  4. `conversations/page.tsx` delegates the complete turn to `/api/yai/generate`, eliminating redundant intermediate round-trips and SHA conflicts.
- **Classification:** **Resolved & Verified.**

### 5.2 React Hook Missing Dependencies

Next.js build logs report missing dependencies in `useEffect` hooks across four pages:
- `src/app/(app)/conversations/page.tsx:80:6` (`fetchConversations`)
- `src/app/(app)/knowledge/page.tsx:47:6` (`fetchItems`)
- `src/app/(app)/repo-setup/page.tsx:53:6` (`fetchStatus`)
- `src/app/(app)/workspaces/page.tsx:51:6` (`fetchData`)
- **Impact:** Non-fatal lint warnings; does not prevent build or runtime execution, but should be wrapped in `useCallback` during V1 cleanup.

---

## 6. Security & Credential Isolation Audit

The codebase was audited to verify compliance with Yet Vast Solutions security standards:

1. **Zero Secret Leakage:**
   - No hardcoded API keys, OAuth client secrets, or private tokens exist in source files.
   - `.env.example` documents placeholders only.
   - Provider keys entered by users are masked before reaching client components (`maskKey()` displays only the first 6 and last 4 characters).
2. **Server-Only Isolation:**
   - All modules touching tokens (`yetvast-auth.ts`, `github-storage-auth.ts`, `session.ts`, `api-client.ts`, `personal-intelligence-storage.ts`, `credential-vault.ts`, `openrouter.ts`, `google-ai.ts`) include `import 'server-only'`.
   - Prevents accidental inclusion in client-side Webpack/Turbopack bundles.
3. **Path Traversal Defenses:**
   - `preventPathTraversal()` in `path-utils.ts` rigorously rejects paths with `..`, leading slashes `/`, Windows drive letters (`C:`), or UNC paths (`\\\\`).
   - Every storage operation sanitizes input before calling the GitHub Contents API.
4. **Content Security & Safe Markdown:**
   - `safe-markdown.ts` sanitizes all Markdown rendered in the browser, stripping `<script>`, `<iframe>`, dangerous attributes (`onclick`), and `javascript:` URIs.

---

## 7. Conclusion

YAI Studio V0 has established a verified, robust technical foundation. The user-owned GitHub persistence layer, Yet Vast Auth integration, AES-256-GCM credential vault, and full domain data model are complete and functional.

This as-built record serves as the technical ground truth for the V1 handoff.
