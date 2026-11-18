# YAI Studio — Product Requirements

## 1. Product definition

YAI Studio is the central Personal Intelligence platform within Yet Vast Solutions. It is an identity-aware intelligence system that manages a user's context, persistent memories, knowledge, goals, relationships, decisions, preferences and cross-product intelligence activity.

It is not simply a chat interface and is not itself an LLM. It coordinates configured model providers and local execution capabilities while maintaining a user-controlled, portable Personal Intelligence store.

The YAI Studio web interface is the user's management and inspection surface. YAI APIs are the integration boundary for independently deployed YVS products.

## 2. Product responsibilities

YAI Studio v0 must establish the foundations for:

- personal profile and user-approved context;
- persistent memory categories and lifecycle;
- conversations and AI answers;
- knowledge organization and references;
- nested workspaces/projects;
- cross-product Intelligence Activity Ledger;
- memory candidate review and acceptance;
- provider configuration and cloud model execution;
- user-owned GitHub storage and export/portability;
- product/API identity and authorization foundations;
- visible synchronization, conflict and error states.

Product-specific data remains owned by its originating product. YAI must not indiscriminately ingest all Cogmit, Fyuniverse or future product data. Products submit explicitly authorized activity and memory candidates.

## 3. V0 scope

V0 is a complete web application, not a static mockup. Build the application around the user's GitHub-backed data repository and Yet Vast Auth integration.

### 3.1 Access and onboarding

- Sign-in through Yet Vast Auth.
- GitHub authorization is required before accessing the Personal Intelligence repository.
- Google identity is optional only to the extent supported by the central Auth application's approved provider policy.
- If GitHub-only ephemeral access is enabled, represent its limitations accurately; do not fabricate a persistent Yet Vast identity.
- Distinguish GitHub identity sign-in from GitHub repository-content authorization.
- After GitHub authorization, check for the exact repository `YVSApps_Data_YaiStudio` in the authenticated user's account.
- If it is absent, show a setup screen explaining what the repository stores, why it is required, visibility expectations and required permissions. Offer an explicit **Create private repository** action.
- Do not silently create the repository on page load.
- If the user declines or lacks permission, keep the application in a clear limited/setup state. Do not pretend storage is ready.
- If the repository exists but required files are missing, offer an explicit initialization action with a preview of the folders/files to be created.
- If access is revoked, expired or insufficient, explain the problem and request reconnection/reauthorization.

### 3.2 Main application navigation

Provide a coherent application shell with:
- Overview / Home;
- Conversations;
- Workspaces;
- Personal Memory;
- Knowledge;
- Intelligence Activity;
- Connected Apps;
- AI Providers / Models;
- Settings.

Navigation must be responsive and accessible. Avoid overbuilding separate dashboards that repeat the same data.

### 3.3 Conversations

- Create, list, search and open conversations.
- Support user and assistant messages with timestamps, sequence/order and model/provider metadata where available.
- Allow conversation title editing and workspace assignment/movement.
- Support nested workspaces/projects.
- Provide clear save/sync status and retry on failure.
- Store only after explicit user actions or clearly communicated conversation persistence behavior. Do not silently imply a message is saved before GitHub confirms the write.
- Support Markdown rendering for assistant/user content safely; sanitize untrusted content and do not execute embedded HTML/scripts.
- Keep the message data model distinct from memory objects.
- Include a clear delete/archive action only after its lifecycle semantics are documented. V0 must not claim permanent erasure from Git history.

### 3.4 Personal Memory

Provide structured views for:
- facts;
- preferences;
- interests;
- goals;
- relationships;
- decisions;
- other approved memory types as the schema evolves.

Each memory should expose its source/provenance, creation/update time, status and confidence only where the system has a defined confidence model. Users can inspect, edit, accept, reject or remove current memory records.

Memory candidates must not become persistent memories automatically unless a documented user-approved policy explicitly allows it. V0 should default to review/approval.

### 3.5 Knowledge

- Organize user-owned knowledge items and references.
- Support Markdown-first notes and structured metadata.
- Preserve source/provenance and links.
- Keep knowledge separate from raw conversation history and persistent memory.
- Do not add vector databases or embedding infrastructure in v0 without approval. Basic metadata/title search is sufficient initially; full-text search strategy can be extended later.

### 3.6 Intelligence Activity Ledger

Show cross-product activity with:
- originating product;
- event/request ID;
- timestamp;
- query or activity summary, subject to retention settings;
- context/memory references used;
- execution provider/model and cloud/local mode when applicable;
- response summary or response content subject to retention;
- memory candidates produced;
- accepted/rejected/pending outcomes;
- persistent memory changes and provenance.

Clearly distinguish activity logs from durable memories. Allow users to inspect how an interaction contributed to Personal Intelligence.

### 3.7 AI providers

V0 should support the cloud execution foundation described in the YAI architecture source:
- OpenRouter BYOK as the primary initial cloud provider.
- Google AI Studio provider support may be included if the integration can be implemented securely and tested; do not expose provider keys to browser code.
- Provider keys are entered through a secure settings flow and stored server-side using an approved secret-storage mechanism. If the existing free-tier deployment cannot provide secure persistent secret storage, stop and document the gap rather than storing keys in plaintext in GitHub or browser storage.
- Allow model/provider selection and explicit execution mode where implemented.
- Return clear provider availability, quota, configuration and error states.
- The YAI API must validate user, calling product, permissions and usage policy before provider calls.

### 3.8 Settings and transparency

Include:
- account identity and connected providers;
- GitHub storage connection/repository status;
- repository setup/reconnect status;
- provider/model configuration;
- activity and retention controls;
- export/clone guidance;
- data and deletion limitations, including Git history;
- application version and diagnostics safe for the user.

## 4. V1 scope — explicitly deferred

V1 adds:
- installable PWA behavior and manifest/service worker;
- local LiteRT-LM Web integration in the active browser/PWA context;
- WebGPU and device capability detection;
- model discovery/download/version/compatibility management;
- local/cloud/auto execution selection;
- model storage quota and user-controlled removal;
- offline inference and explicit offline synchronization behavior.

The YAI Studio PWA is not an always-on local inference daemon. Cogmit/Fyuniverse must eventually execute local inference in their own active PWA contexts through a shared YAI Client/runtime package. Do not assume one PWA can wake another closed PWA.

## 5. Out of scope for v0

- Native Android/iOS applications.
- Always-on Legion Go or dedicated inference server.
- Central database as the authoritative Personal Intelligence store.
- Vector database / RAG infrastructure beyond a minimal extensible retrieval boundary.
- Automatic ingestion of all data from every YVS product.
- Public sharing or public YAI instance.
- Automatic permanent deletion of Git history.
- Billing or monetization.
- Cross-origin shared model cache.
- Complex multi-tenant organization administration.

## 6. Product quality requirements

- Responsive desktop/tablet/mobile layouts.
- Light and dark themes.
- Keyboard accessibility and visible focus.
- Clear loading, empty, success, partial, offline, conflict and error states.
- No false save-success messages.
- Safe Markdown rendering.
- Server-side authorization for all private operations.
- Observable, structured, privacy-safe logs.
- Tests for authentication, repository ownership, path validation, data integrity, memory approval and API authorization.
