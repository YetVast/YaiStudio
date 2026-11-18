# YAI Studio — V0 Build Plan and Acceptance Criteria

## Phase 0 — Repository and contract audit

- Inspect the cloned `yaistudio` repository and preserve existing work.
- Read this documentation pack.
- Inspect current `@yetvast/auth` package exports, types, version and release availability.
- Verify exact Yet Vast Auth application registration and callback policy with Auth Admin.
- Identify whether GitHub provider sign-in, ephemeral access and GitHub API storage authorization are supported as separate capabilities.
- Inspect reusable Cogmit GitHub CRUD patterns only as a reference; do not copy product-specific logic.
- Confirm Vercel/hosting and package-registry environment requirements.
- Produce an OBSERVED/DOCUMENTED/UNKNOWN audit before coding.

**Gate:** Do not implement an incompatible Auth flow or request broad GitHub permissions before the policy is resolved.

## Phase 1 — Application foundation and YVS design system

- Establish Next.js App Router/TypeScript conventions.
- Implement CSS Modules-only styling.
- Add semantic light/dark tokens using canonical YVS palette.
- Add responsive shell, navigation and accessible primitives.
- Add loading, empty, error and success states.
- Add `.npmrc` for private `@yetvast` packages if consumed and follow the package-consumption standard.
- Configure environment examples without secrets.

Acceptance:
- production build succeeds;
- no Tailwind is installed or used;
- light/dark themes work;
- keyboard focus and responsive layout verified.

## Phase 2 — Yet Vast Auth and GitHub storage connection

- Integrate the current official Yet Vast Auth SDK.
- Implement OAuth callback, assertion verification and YAI-owned host-bound session.
- Implement sign-out and session expiry handling.
- Implement explicit GitHub storage authorization if central Auth linking does not grant API permissions.
- Verify GitHub account identity server-side.
- Check exact repository `YVSApps_Data_YaiStudio`.
- If missing, show explanatory setup UI and explicit create-private-repository action.
- If existing, validate owner, visibility and required access.
- Implement explicit data-layout initialization after preview/confirmation.

Acceptance:
- unauthenticated users cannot access private routes;
- wrong GitHub account/repository is rejected;
- repository absence shows setup UI;
- no repository is created without explicit user action;
- revoked GitHub access is detected;
- no credentials reach browser bundles or logs.

## Phase 3 — GitHub storage adapter and data integrity

- Implement typed storage adapter.
- Implement repository tree/read/write/list operations.
- Implement SHA-aware updates and deletes.
- Handle rate limits, conflicts, retries and partial failures.
- Implement manifest and schema validation.
- Implement workspace and conversation index maintenance.
- Ensure reads are non-mutating.

Acceptance:
- create/read/update/move conversation;
- nested workspace create/list/move;
- index consistency checks;
- simulated SHA conflict and recovery;
- accurate saved/pending/failed UI state.

## Phase 4 — Core Personal Intelligence UI

- Overview.
- Conversations and message rendering.
- Nested workspaces.
- Personal Memory categories.
- Candidate approval/rejection.
- Knowledge notes/references.
- Activity Ledger.
- Settings and repository status.

Acceptance:
- data survives reload and is visible in the GitHub repository;
- Markdown export is generated from canonical structured messages;
- candidates do not silently become accepted memories;
- activity and memory are visibly distinct;
- user can inspect provenance.

## Phase 5 — Cloud YAI API

- Provider configuration UI.
- Secure server-side key storage using approved mechanism.
- OpenRouter BYOK integration.
- Optional Google AI Studio integration only if securely implemented and tested.
- Context retrieval and prompt assembly.
- Product/user authorization boundary.
- Streaming or completed response persistence.
- Activity and candidate recording.

Acceptance:
- provider keys never appear in browser network responses or GitHub data repo;
- unauthorized product/user requests are rejected;
- provider failures and quota errors are visible;
- generated response is persisted only after confirmed write;
- memory candidate creation follows the documented policy.

## Phase 6 — Product integration foundation

- Define stable YAI API contracts for context retrieval, generation and activity reporting.
- Define YAI Client public contract for future product consumers.
- Document product identity and authorization.
- Do not require YAI Studio UI to be open for API use.
- Do not implement local LiteRT-LM in v0.

Acceptance:
- API contract tests;
- caller product validation;
- no cross-product data leakage;
- integration documentation and examples.

## Phase 7 — Hardening and release readiness

- Typecheck, lint, tests and production build.
- Auth and GitHub integration tests.
- Authorization/path traversal tests.
- Accessibility and responsive checks.
- Review GitHub API usage and rate-limit behavior.
- Review secrets and environment variables.
- Document Vercel deployment, package token and runtime env separately.
- Verify actual deployed callback URL and central application approval.

## V0 Definition of Done

V0 is complete only when a real user can authenticate, authorize GitHub, create or connect the required private data repository, initialize it, create conversations/workspaces, manage memory and knowledge, inspect the Activity Ledger, configure a cloud provider securely, generate and persist a response, and use the product after reload — with server-side authorization and verified data integrity.

A visually complete UI with mocked data is not V0 completion.

## V1 roadmap — PWA and local AI

- PWA manifest/installability and service worker.
- LiteRT-LM Web adapter.
- WebGPU/device capability manager.
- Model catalog/download/version management.
- Origin-scoped storage accounting.
- Local/cloud/auto routing.
- Offline inference and explicit sync conflict semantics.
- Test mobile/desktop browser compatibility and thermal/memory constraints.

V1 local inference runs in the active product PWA context. YAI Studio must not be designed as a closed-PWA background model server.
