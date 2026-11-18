# FULL PROJECT CREATION PROMPT — YAI STUDIO (V0)

You are the principal product architect and senior full-stack engineer initializing **YAI Studio**, a first-class product under **Yet Vast Solutions (YVS)**.

The repository `yaistudio` has already been created and cloned by the product owner. Work in the existing repository. Do not create a different repository, reset it, overwrite valid work or assume it is empty.

Your task is to inspect the repository, establish the complete v0 architecture and implement the full functional YAI Studio v0 application. This is not a landing-page exercise or a mock UI exercise. V0 must be a usable web application with real authentication, real GitHub-backed user storage, Personal Intelligence management and secure cloud AI foundations. V1 will add installable PWA and local LiteRT-LM execution.

## 0. Mandatory reading

Before editing, read:
- `AGENTS.md`
- `README.md`
- `docs/product/PRODUCT_REQUIREMENTS.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/auth/AUTHENTICATION_AND_GITHUB_ACCESS.md`
- `docs/data/PERSONAL_INTELLIGENCE_DATA_MODEL.md`
- `docs/security/SECURITY_AND_PRIVACY.md`
- `docs/implementation/V0_BUILD_PLAN_AND_ACCEPTANCE.md`
- `docs/decisions/ARCHITECTURE_DECISIONS.md`
- all relevant files in `docs/reference/`

Treat supplied source documents as authoritative for their stated subject. Distinguish documented decisions, user requirements, recommendations and unknowns.

## 1. First action: repository audit

Inspect:
- current branch and git status;
- all existing files and source layout;
- package.json and lockfile;
- Next.js/React/TypeScript versions;
- current CSS/styling implementation;
- environment examples;
- existing auth, GitHub, storage, API, UI and test code;
- current deployment configuration.

Do not destroy or replace existing work. Produce a short audit:
- OBSERVED existing implementation;
- DOCUMENTED requirements;
- reusable code;
- gaps;
- unknowns and high-impact decisions.

Then propose a phased plan. If an architectural gate blocks implementation, implement only safe independent foundations and report the blocker. Do not guess.

## 2. Product identity and purpose

YAI Studio is the central Personal Intelligence platform for Yet Vast Solutions. It manages:
- user context;
- persistent memories;
- preferences, interests, goals, relationships and decisions;
- knowledge and references;
- conversations and AI answers;
- cross-product activity;
- memory candidates and approved memory changes;
- model/provider configuration;
- product/API access boundaries.

YAI is not an LLM and not merely a chatbot. The YAI Studio UI is the management/inspection surface. YAI API is the integration boundary for independently deployed Yet Vast products.

Cogmit, Fyuniverse and future products must be able to call YAI APIs without YAI Studio being open. Product data remains product-owned unless explicitly authorized for YAI retrieval or memory contribution.

## 3. Technology and YVS standards

Use the existing compatible project stack; default target:
- Next.js App Router;
- React;
- TypeScript;
- Vercel deployment;
- Yet Vast Auth;
- GitHub-backed user data repository;
- CSS Modules only;
- semantic design tokens;
- Lucide icons;
- Inter and JetBrains Mono.

### Styling prohibition
Use CSS Modules for component styling. Do not introduce Tailwind CSS, shadcn utility styling, styled-components or another styling system. Keep global CSS limited to resets, font declarations and semantic theme tokens. Do not scatter hardcoded colors through components.

### YVS visual identity
Canonical brand colors:
- YVS Yellow: `#FFFF11`
- YVS Indigo-Violet: `#4B0084`

Light theme:
- Indigo-Violet as primary/action color;
- Yellow as accent.

Dark theme:
- Yellow as primary/high-attention color;
- Indigo-Violet as structural/brand accent.

Use neutral surfaces and semantic tokens for background, foreground, card, muted, border, input, primary, secondary, accent, destructive, success, warning and focus/ring. Keep brand colors purposeful, not everywhere. Design must be simple, polished, modern, readable, information-focused, responsive and accessible. Avoid generic AI landing-page aesthetics, excessive gradients, glassmorphism, decorative blobs, oversized hero text, excessive shadows, giant rounded cards and visual noise.

Use a real application shell with compact navigation and clear information hierarchy. Include light/dark theme switching and respect system preference.

## 4. Authentication — Yet Vast Auth only

Integrate the current official `@yetvast/auth` SDK and current supported server exports. Inspect package version, published availability, types, examples and the actual central Auth docs before implementation. Do not build a second identity authority or use Firebase Auth as a parallel login system.

YAI owner requirements:
- GitHub authorization is mandatory for Personal Intelligence storage.
- Google identity is optional, subject to the approved Yet Vast Auth application policy.
- Anonymous/ephemeral access is optional, subject to explicit central Auth support and application registration.
- Users must authorize GitHub storage access before using their data repository.

CRITICAL CENTRAL POLICY GATE:
The supplied 16 November 2026 Yet Vast Auth documentation describes Google persistent identity and GitHub-only ephemeral access as mutually exclusive registration policies. It also says GitHub-only ephemeral access does not automatically create a permanent Yet Vast identity. Do not implement both as freely selectable sign-in methods unless the current Auth release and Auth Admin explicitly support that combination.

Determine the approved YAI registration policy and exact supported journey. If unresolved, do not invent it. Implement safe UI scaffolding and document the exact Auth Admin decision required. Do not modify central Yet Vast Auth or its production registration.

Implement:
- OAuth Authorization Code + PKCE using official SDK;
- state validation;
- server-side assertion exchange and JWKS verification;
- issuer, audience, expiry and signature checks;
- YAI-owned host-bound HTTP-only session;
- sign-out/session expiry;
- exact configured callback URI and trusted origin validation;
- CSRF protection for mutations;
- server-side authorization for every private endpoint.

Never copy app IDs, origins, callback paths, cookie names or env variable names from VastAlliance/Home. Obtain YAI's own central registration and verify exact callback values.

### GitHub identity is not GitHub storage permission
A Yet Vast Auth GitHub identity/link does not automatically prove GitHub REST API access to private repository contents. Determine whether the official Auth flow provides an authorized GitHub API grant with the necessary permissions. If not, implement a separate explicit GitHub App/fine-grained repository authorization flow. Do not pretend identity linking is repository authorization.

Use least privilege. Evaluate repository-scoped GitHub App/fine-grained access. Repository creation may require additional permission; request it only for the explicit create action and explain why. Keep all tokens server-side and encrypted at rest.

## 5. User-owned GitHub data repository

The exact repository name is:

`YVSApps_Data_YaiStudio`

This is the user's data repository, not the application source repository `yaistudio`.

After Yet Vast authentication and GitHub storage authorization:
1. Verify GitHub account identity server-side.
2. Discover the repository by exact name under the authenticated user's account.
3. Verify repository owner and private visibility.
4. Verify the necessary repository access.
5. If the repository is missing, display an onboarding/setup screen. Explain what the repository stores, that it should be private, that the user owns it, what access YAI needs, and that Git history retains prior versions.
6. Provide an explicit **Create private repository** action.
7. Do not create it silently during login, render, page load or a read operation.
8. After creation, verify it exists and belongs to the expected account.
9. If it exists but is not initialized, show a preview of the proposed directory/files and require explicit **Initialize Personal Intelligence storage** confirmation.
10. If access is revoked/expired, show a reconnect flow.

Never silently fall back to another repository name, another GitHub account, YAI-owned storage, Firestore or localStorage as the authoritative store.

## 6. GitHub-backed data structure

Use the filesystem as the user's workspace hierarchy, inspired by transferable Cogmit principles, not by copying Cogmit domain entities.

Proposed root:

```text
YVSApps_Data_YaiStudio/
├── README.md
├── yaiManifest.json
├── conversationsIndex.json
├── workspaces/
│   └── <Workspace Name>/
│       ├── workspaceData.json
│       ├── <Nested Workspace Name>/
│       │   ├── workspaceData.json
│       │   └── <ConversationId>/
│       │       ├── conversation.json
│       │       ├── messages.json
│       │       └── conversation.md
│       └── <ConversationId>/
│           ├── conversation.json
│           ├── messages.json
│           └── conversation.md
├── unfiledConversations/
├── memory/
│   ├── facts.json
│   ├── preferences.json
│   ├── interests.json
│   ├── goals.json
│   ├── relationships.json
│   ├── decisions.json
│   ├── candidates/
│   └── memoryChanges/
├── knowledge/
│   ├── topics/
│   └── references/
├── activity/
│   └── YYYY/MM/<productId>/<eventId>.json
├── intelligence/
│   ├── memory-index.json
│   ├── relationships.json
│   └── manifest.json
└── exports/
```

Create only the files required for the chosen initial schema. Do not create empty decorative folders.

Rules:
- Workspace directory name represents its name; nested workspace folders are allowed at arbitrary depth.
- A workspace may contain its metadata, conversations immediately beneath it, and nested workspaces. Do not add an unnecessary `conversations/` layer.
- Conversation ID is stable and distinct from its current path.
- `messages.json` is the canonical structured source for message order, role, content, timestamp and model metadata.
- `conversation.md` is generated from `messages.json` as a human-readable projection/export; it is not a second editable source of truth.
- `conversation.json` contains conversation metadata.
- `conversationsIndex.json` is a flat navigation index of ID/title/immediate workspace/path/updated time. It is not a duplicate workspace tree and not canonical conversation content.
- `unfiledConversations/` holds conversations without a workspace.
- Do not use Cogmit's `RootCog`, `ChildCog`, `NPPCogs`, `cogsIndex.json`, `deletedCogs` or 57-day deletion semantics.
- Git history is version history. Normal file deletion does not erase previous commits or existing clones.
- Do not claim permanent erasure in v0.

Use schema validation at boundaries. Define IDs, timestamps, allowed roles/statuses and path constraints. Protect against path traversal, invalid names and collisions. Define an index consistency/rebuild strategy.

For GitHub Contents API:
- retrieve and supply current SHA for updates/deletes;
- handle 409/conflict and 422 errors appropriately;
- do not concurrently update/delete the same path;
- batch related writes where practical;
- implement idempotent retries;
- handle rate limits and partial commits;
- do not persist every streamed token as a separate commit;
- report save status accurately.

## 7. Complete v0 product UI

Build a real application shell with the following sections:

### Overview
- Personal Intelligence status;
- recent conversations;
- recent activity;
- pending memory candidates;
- connected GitHub repository status;
- configured provider status;
- clear first-run empty states.

### Conversations
- create/list/open/search conversations;
- render user and assistant messages safely;
- edit title;
- assign/move to nested workspace;
- timestamps and model/provider metadata;
- save/sync status;
- error/conflict recovery;
- generated Markdown transcript.

### Workspaces
- create, rename, nest and move workspaces;
- list conversations within workspace;
- handle path/index updates safely;
- validate names and collisions.

### Personal Memory
Views for facts, preferences, interests, goals, relationships and decisions.
Each memory should show source/provenance, status, timestamps and approved metadata. Support review/accept/reject of candidate memories. User edits/removals must be explicit. Default v0 policy: candidates require user approval.

### Knowledge
- Markdown-first notes/references;
- topic organization;
- source/provenance and links;
- basic metadata/title search;
- no vector DB in v0.

### Intelligence Activity Ledger
- source product;
- request/event ID;
- time;
- query/summary and response subject to retention setting;
- retrieved memory/knowledge references;
- model/provider/execution mode;
- memory candidates;
- accepted/rejected/pending status;
- resulting memory changes and provenance.

Keep activity distinct from durable memory. Allow the user to inspect how interactions from Cogmit, Fyuniverse, YAI Studio and other approved products contribute to central intelligence.

### Connected Apps
Show approved/connected product integrations and access scope. Do not create a central app registry in YAI; Yet Vast Auth remains authoritative for application registration/approval. YAI owns only YAI-specific product permissions and user consent records as applicable.

### AI Providers and Models
- OpenRouter BYOK primary cloud provider.
- Google AI Studio optional if securely implemented and verified.
- model selection/configuration;
- key add/replace/delete flow;
- masked key status, never return stored raw key;
- provider availability/quota/error states.

Provider keys must be stored using an approved server-side encrypted secret mechanism. If no secure persistent mechanism exists in the selected deployment, STOP and report the required decision. Never put provider keys in browser storage, GitHub data repo, Firestore plaintext or source control.

### Settings
- account identity;
- linked providers;
- GitHub account/repository status;
- storage setup/reconnect;
- provider settings;
- retention/privacy controls;
- clone/export guidance;
- Git-history deletion caveat;
- safe diagnostics.

## 8. YAI API and integration contracts

Establish the YAI API boundary even if the first UI uses internal service functions. Future product consumers should be able to:
- retrieve authorized Personal Intelligence context;
- submit a generation request;
- report interaction activity;
- submit memory candidates;
- query approved product access.

Every request must verify:
- authenticated Yet Vast identity/session;
- calling product identity/registration where applicable;
- user consent and product permission;
- data scope and requested operation;
- rate/usage policy.

Never trust a `userId` or `productId` merely because the browser supplied it. YAI Studio UI must not be required to remain open for these APIs to work.

Define stable typed contracts and document example integration. Do not build a public SDK package unless there is an existing approved publishing process and a real consumer requirement.

## 9. Cloud inference

Implement the cloud path as:
Product/UI → YAI API → authorization → context retrieval → provider adapter → response → activity/memory-candidate processing → persistence.

OpenRouter BYOK is the primary initial route. Google AI Studio may be supported as a second provider if practical.

The API key stays server-side. The client never calls OpenRouter directly using the user's secret. Provider adapters must normalize errors and response metadata. Validate model output before using it as structured data. Model output cannot grant permissions or trigger privileged operations.

Do not implement local LiteRT-LM execution in v0.

## 10. V1 PWA/local AI boundary

Prepare clean interfaces, but defer implementation:
- installable PWA;
- service worker;
- LiteRT-LM Web;
- WebGPU capability manager;
- model downloads/catalog/versioning;
- device storage/memory checks;
- local/cloud/auto selection;
- offline sync.

Local inference runs in the active product PWA context. Do not design YAI Studio as a permanent background inference daemon. Cogmit and Fyuniverse should eventually bundle/import the shared YAI Client/local runtime and execute locally in their own active context.

## 11. Security, privacy and error handling

- server-side authorization on every private route;
- host-bound HTTP-only session;
- exact origin/callback validation;
- PKCE/state/issuer/audience/signature/expiry checks;
- CSRF protection;
- least-privilege GitHub scopes;
- server-only encrypted GitHub/provider credentials;
- no secrets in browser bundle or GitHub data repo;
- path traversal prevention;
- no cross-user repository access;
- safe Markdown rendering;
- model output treated as untrusted;
- no silent writes from reads;
- no empty catch blocks or swallowed errors;
- no false save success;
- structured logs with sensitive content redacted;
- clear handling for auth failure, revoked grant, missing repo, wrong owner, rate limit, SHA conflict, provider outage, partial commit and offline state.

## 12. Engineering quality

Follow `AGENTS.md` and YVS standards:
- inspect before changing;
- search/reuse before adding;
- smallest coherent implementation;
- no unrelated refactoring;
- no speculative infrastructure;
- accessible, responsive UI;
- typed contracts and validation;
- deterministic tests;
- run actual typecheck/lint/test/build commands;
- review final diff;
- update documentation.

Do not install dependencies without checking whether an existing/native capability solves the need. Keep client bundles lean and server-only modules protected.

For private `@yetvast/*` packages, add the credential-free root `.npmrc`:

```ini
@yetvast:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Use `NODE_AUTH_TOKEN` only for package installation in CI/Vercel. Never use it as an application runtime credential. Verify actual published package versions before pinning them.

## 13. Environment configuration

Inspect the actual SDK and implementation before finalizing variable names. Provide `.env.example` with placeholders only. Likely configuration categories:
- YAI public origin;
- Yet Vast Auth origin;
- stable logical YAI application ID;
- exact callback URI/origin;
- session signing/encryption secret;
- GitHub App/client configuration or approved OAuth storage grant;
- server-side credential encryption key/secret-store configuration;
- OpenRouter provider key storage reference;
- Google AI Studio provider key storage reference;
- NODE_AUTH_TOKEN for package installation only.

Do not invent central Auth IDs, callback URLs, secret names or values. Never commit `.env.local`.

## 14. Implementation sequence

1. Repository audit and auth/storage gates.
2. YVS design foundation and application shell.
3. Yet Vast Auth integration and YAI session.
4. GitHub storage authorization.
5. Repository discovery, missing-repository onboarding and explicit creation.
6. Storage initialization and GitHub adapter.
7. Conversations and nested workspaces.
8. Personal Memory and candidate review.
9. Knowledge.
10. Intelligence Activity Ledger.
11. Provider configuration and secure cloud inference.
12. YAI API contracts and product authorization.
13. Testing, security, accessibility, deployment and documentation.

Build in vertical slices. Avoid a huge untestable scaffold. Do not mark the product complete while core flows are mocked.

## 15. Required first response and final report

Before coding, report the repository audit and any blocking Auth/credential-storage decisions. Then proceed with all safe work.

At completion, provide:
- implemented features;
- key architecture and data-flow decisions;
- files/modules created or changed;
- actual tests/checks and results;
- flows manually verified;
- Vercel environment variables and package-registry setup;
- central Yet Vast Auth registration requirements;
- GitHub permission requirements;
- remaining limitations and risks;
- explicit v1 PWA/LiteRT-LM backlog.

Do not claim that central Auth configuration, GitHub App permissions, Vercel secrets or production deployment are complete unless you actually verified them.
