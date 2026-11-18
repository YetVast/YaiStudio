# Yet Vast Solutions — YAI Studio & Shared Platform Architecture

**Conversation Consolidation and Architecture Decision Record**  
**Prepared:** 10 November 2026  
**Scope:** YAI Studio · Yet Vast Auth · YAI API · YAI Client · LiteRT-LM · GitHub-backed Personal Intelligence · Cogmit · Fyuniverse

> This Markdown file is the structured, editable Project knowledge version of the accompanying DOCX. It preserves the document's headings, prose, lists, tables and code examples.

YET VAST SOLUTIONS

# YAI Studio & Shared Platform Architecture
Conversation Consolidation and Architecture Decision Record

Prepared: 10 November 2026
Scope: YAI Studio · Yet Vast Auth · YAI API · YAI Client · LiteRT-LM · GitHub-backed Personal Intelligence · Cogmit · Fyuniverse


## Document purpose and status

This document consolidates the architecture discussion in this conversation. It records the user's product direction, the architecture options considered, the recommendations made, implementation examples, constraints, security boundaries, zero-cost operating assumptions and next steps.

| Status convention — Established means the user explicitly confirmed the direction. Recommended means a design recommendation made during the discussion but not yet explicitly accepted as a final implementation decision. Exploratory means an option retained for evaluation. Nothing in this document should be interpreted as already implemented unless explicitly stated. |
| --- |

This is an architecture record, not a claim that the described packages, APIs, schemas or integrations already exist. Code interfaces and repository structures are illustrative starting points.


## 1. Executive architecture statement

Yet Vast products are intended to be independently deployable Next.js applications/PWAs. They should integrate with a central intelligence platform, YAI Studio, through APIs and shared client packages rather than depending on the YAI Studio user interface being open.

YAI Studio is the central authority for Personal Intelligence: identity-aware context, persistent memories, knowledge, retrieval, orchestration, model routing, product permissions and visibility into how interactions across products contribute to a user's central intelligence.

YAI Studio's own interface is a PWA used to inspect, understand, configure, correct and manage Personal Intelligence. It is not a required runtime host for AI requests from other products.

Two AI execution paths are to remain available:

- Cloud execution: product PWA → YAI API hosted on Vercel → configured provider such as OpenRouter (with the user's own API key) or Google AI Studio.
- Local execution: product PWA imports the shared YAI Client/local runtime integration and runs LiteRT-LM in the active browser context on the user's device.
For initial zero-infrastructure-cost development, GitHub is the proposed source of truth for user-owned Personal Intelligence repositories, while Vercel hosts Next.js and API functions within applicable plan limits. No always-on Legion Go or dedicated inference server is required for the two paths above.


## 2. Product boundaries and responsibilities


### 2.1 YAI Studio

YAI Studio is the central intelligence platform and its management interface. It is more than a chatbot UI. Its responsibilities include:

- Canonical user-aware intelligence coordination across Yet Vast products.
- Personal Intelligence: persistent memories, preferences, goals, relationships, decisions and other user-approved knowledge.
- Context retrieval and preparation for product requests.
- RAG and knowledge retrieval orchestration; document ingestion/indexing capabilities may be added as required.
- Product identity, authorization and access boundaries.
- Model/provider selection and cloud/local execution coordination.
- Memory candidate evaluation, conflict handling, retention and updates.
- An Intelligence Activity Ledger showing queries and answers from products and how they contribute to central Personal Intelligence.
- A user interface for viewing, correcting, modifying and managing Personal Intelligence, connected accounts and provider configuration.
| Established decision — YAI Studio is PWA-only. No native Android or iOS application is planned. Native development should be reconsidered only if a demonstrated requirement cannot be met adequately by the PWA/browser platform. |
| --- |


### 2.2 Yet Vast product applications

Cogmit, Fyuniverse and future Yet Vast applications are independently deployable Next.js frontends/PWAs. They own their product-specific user experience, workflows and product data. They integrate with YAI Studio through APIs and shared SDKs.

- A product must not need the YAI Studio PWA to be open or installed to make an authenticated cloud AI request.
- A product can execute local inference in its own active PWA context if it integrates the local runtime.
- Products submit interaction activity and memory candidates to YAI Studio; they do not independently become the authority for central Personal Intelligence.
- Product-specific data remains owned by the product. YAI Studio may retrieve it only through authorized, explicit integration boundaries; central intelligence should not automatically absorb all product data.

### 2.3 YAI Studio PWA versus YAI APIs

The YAI Studio PWA is a management and inspection surface. The APIs are the integration boundary and operational interface used by Cogmit, Fyuniverse and other products. This separation is intentional.

- The user can close YAI Studio and still use Cogmit or Fyuniverse with YAI API cloud inference.
- The user can close YAI Studio and still use local inference in an active product PWA.
- The YAI Studio UI is used to configure provider keys, inspect activity, manage memories and connected accounts, and change Personal Intelligence.

## 3. Deployment and execution architecture


### 3.1 Vercel's role

Vercel remains the hosting platform for the Next.js YAI Studio PWA and its API/orchestration routes. It can validate requests, retrieve authorized context, call external providers, coordinate memory operations and stream responses.

Vercel is not intended to host a persistent LiteRT-LM model-serving process. A serverless function is not a permanently running device-independent inference server. Model initialization, large model files, memory requirements, execution lifecycle and standard lack of dedicated GPU inference make it a poor primary host for a persistent model runtime.


### 3.2 Lenovo Legion Go

The Lenovo Legion Go was considered as a possible external inference machine. If it hosted the LiteRT-LM server, it would need to remain powered on, connected and reachable to receive requests. This is not the preferred production architecture.

Under the selected direction, the Legion Go can be used as a development and testing device for local inference rather than an always-on production server.


### 3.3 Local inference in a PWA

A PWA can potentially execute supported LiteRT-LM models through the browser JavaScript API and WebGPU. The runtime is executed in the active product's browser context, not by waking a separate YAI Studio PWA.

The user installs Cogmit or Fyuniverse. When that product is open, its own code can initialize the local model runtime, load a supported model and execute inference. YAI Studio does not need to be open.

The browser JavaScript API was described during the discussion as early preview, while the Kotlin Android API was described as stable and the iOS Swift API as early preview. Browser support, model compatibility and performance must be verified against current LiteRT-LM documentation before implementation.


### 3.4 Why one PWA cannot reliably act as a shared always-on model server

The idea of having Cogmit send a request to the installed YAI Studio PWA, which then wakes up and runs LiteRT-LM even when closed, was examined and not selected as a dependable architecture.

- Separate PWAs generally have separate origins, storage partitions and service-worker scopes.
- Cross-context browser communication mechanisms are constrained by origin and storage boundaries; they are not a universal bus between unrelated PWAs.
- A service worker can be started for certain browser events, but browsers and mobile operating systems may terminate or suspend it. It is not a general-purpose permanently running process.
- A persistent loaded LLM engine, GPU resources and long-running inference session cannot be assumed to survive when the PWA is closed or backgrounded.
Therefore, the reliable local inference design is: the currently active product PWA executes the model itself, using shared code from Yet Vast packages. A shared YAI PWA is not a device-wide inference daemon.


## 4. Two supported AI execution paths


### 4.1 Option A — Central cloud inference through YAI API

| User-confirmed direction — Keep a cloud API path in which users configure their OpenRouter API key in YAI Studio. YAI Studio's Vercel-hosted backend should then be able to respond to authorized requests from Yet Vast client applications without the YAI Studio PWA being open. |
| --- |

Expected flow:

1. User signs into YAI Studio and configures an OpenRouter API key (and, where supported, a Google AI Studio provider configuration).
1. YAI Studio backend stores the provider credential securely; it must not expose the key to product browser clients.
1. Cogmit or Fyuniverse sends an authenticated request to YAI API.
1. YAI API validates the user and calling product, checks authorization and relevant usage policies.
1. YAI API retrieves relevant Personal Intelligence and prepares context.
1. YAI API selects the configured provider/model and calls it server-side.
1. YAI API streams or returns the result to the requesting product.
1. YAI API records activity and processes any proposed memory contribution.
This path works even if the YAI Studio PWA is closed, not installed or never opened after provider configuration, provided the backend is available and the user's provider authorization/key remains valid.


### 4.2 Option B — Local inference through YAI Client and LiteRT-LM

| User-confirmed direction — Keep local inference as a separate supported option. Each Yet Vast PWA can integrate a shared YAI client/runtime package and execute LiteRT-LM on the user's device. |
| --- |

Expected flow:

1. User opens a Yet Vast product PWA, such as Cogmit.
1. The product's YAI Client obtains the authenticated user context through Yet Vast Auth.
1. The product asks YAI API for authorized context and execution guidance when online.
1. The product initializes the local LiteRT-LM runtime in its own active browser context.
1. The model executes locally and generates the response.
1. The product reports interaction metadata, outcome and eligible memory candidates to YAI API.
1. YAI API updates central Personal Intelligence storage when connected and authorized.
Local inference can avoid sending the prompt to an external model provider. However, if context retrieval or activity reporting calls YAI API, those parts still involve network communication. Offline inference and offline memory synchronization are separate capabilities that need explicit design.


### 4.3 Execution selection

Both paths remain open and should be first-class modes. Selection may be explicit by the user, configured per product, or automatically selected based on task requirements, device capability, model availability, connectivity and user preference.

| Task example | Potential preferred path | Notes |
| --- | --- | --- |
| Simple rewriting or classification | Local | If a suitable model is installed and device performance is adequate. |
| Draft summarisation | Local or cloud | Depends on document size, model capability and privacy preference. |
| Complex reasoning | Cloud | Use a stronger configured provider when local capability is insufficient. |
| Large document analysis | Hybrid or cloud | May require ingestion, chunking, retrieval and larger context handling. |
| Offline assistance | Local | Only for data and models available on the device. |
| Personal memory retrieval | YAI API plus local/cloud inference | YAI remains the central authority; authorized context can be supplied to local inference. |


## 5. Browser/PWA constraints for local AI

| Constraint | Practical implication |
| --- | --- |
| PWA lifecycle | A PWA is not guaranteed to run continuously in the background. A task may pause or terminate when the browser is backgrounded. |
| WebGPU | Availability and performance vary by device, browser, OS and driver. |
| Memory/RAM | Model weights, runtime, KV cache and application memory compete for limited device resources. |
| Storage | Model files may be large; users may need to download substantial data. Browser storage can be cleared or evicted. |
| Battery and thermals | Sustained inference consumes power and may cause thermal throttling. |
| SDK maturity | LiteRT-LM Web was described as early preview; feature parity with native APIs must not be assumed. |
| Model compatibility | Not every LiteRT-LM model or feature is necessarily available in browser execution. |

A proposed Device Capability Manager in YAI Client should check WebGPU availability, browser/device capability, supported model compatibility, storage availability and practical memory/performance constraints. It should recommend a local model or fall back to cloud inference when appropriate.

A model-management component should support model discovery, download, versioning, compatibility checks, storage accounting and user-controlled removal. Avoid automatically downloading large models into every product PWA.


## 6. Cross-PWA storage and runtime sharing

If applications are deployed on different origins (for example, cogmit.yvsol.com, fyuniverse.yvsol.com and yai.yvsol.com), browser storage is isolated by origin/storage partition. Downloading a model through YAI Studio does not guarantee that Cogmit or Fyuniverse can access the same cached model.

Possible approaches considered:

- Embed the shared inference integration in each product through a common package. Each product initializes the runtime in its own active context and manages its own origin-scoped model cache.
- Explore a shared runtime origin, iframe or other cross-context mechanism later. This introduces browser security, storage isolation, lifecycle, GPU access and mobile compatibility complexity.
| Recommendation — Start with a shared SDK imported by each product, not a separate YAI PWA acting as a shared runtime. Model downloads/caches may be duplicated across origins unless a later, carefully tested shared-origin strategy is adopted. |
| --- |

A common code package does not mean one shared runtime process. It means the same maintained implementation is bundled or imported by multiple products.


## 7. Shared Yet Vast package ecosystem


### 7.1 Proposed package boundaries

| Package | Responsibility | Status |
| --- | --- | --- |
| @yvsol/auth-client | Google/GitHub sign-in, account linking, session lifecycle, token access and canonical Yet Vast identity. | Recommended; user requested planning this. |
| @yvsol/github-storage | GitHub connection and repository/file CRUD, SHA handling, directory listing and repository operations. | Recommended extraction from Cogmit. |
| @yvsol/yai-client | Product-facing YAI API integration, context retrieval, local/cloud execution selection and activity reporting. | Established direction. |
| @yvsol/yai-local-runtime | LiteRT-LM Web adapter and device capability/model handling. | Proposed separation; can initially live inside YAI Client. |
| @yvsol/api-client | Common authenticated API transport and request handling. | Future candidate; may initially remain internal to other packages. |
| @yvsol/ui | Shared UI components. | Future candidate; not required for current architecture. |
| @yvsol/config | Shared configuration/design tokens. | Future candidate; not required for current architecture. |
| @yvsol/analytics | Cross-product analytics integration. | Future candidate; not required for current architecture. |

Do not put GitHub CRUD inside the authentication package. Authentication, external account connections and storage are distinct concerns. A package may internally depend on another package, but their responsibilities and public interfaces should remain separate.


### 7.2 Yet Vast Auth package

The user specified two initial OAuth sign-in options: Google and GitHub.

- Google OAuth sign-in.
- GitHub OAuth sign-in.
- One canonical Yet Vast user identity regardless of which provider the user initially chooses.
- Link/unlink an additional identity provider with explicit user authorization.
- Session initialization, refresh and sign-out.
- Current-user retrieval and access-token acquisition.
- Connected account/service status.
- Product identity and product-level authorization context.
The package is a client SDK, not the identity backend. Actual authentication, identity linking, token validation, account records and authorization policies live in a backend identity service/provider.

Firebase Authentication was discussed as a possible underlying identity provider because it is already part of the user's technical context. This is a recommended implementation candidate, not a finalized commitment. The package should abstract the underlying provider so it can change later.


### 7.3 Illustrative Yet Vast Auth interface

interface YVAuthClient {
  initialize(): Promise<void>;
  signInWithGoogle(): Promise<YVUser>;
  signInWithGitHub(): Promise<YVUser>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<YVUser | null>;
  getAccessToken(): Promise<string>;
  getConnections(): Promise<YVConnection[]>;
  connectGitHub(): Promise<void>;
  disconnectGitHub(): Promise<void>;
  hasConnection(provider: "github" | "google"): Promise<boolean>;
}

Illustrative usage:

const auth = createYVAuth({ appId: "cogmit" });
await auth.initialize();
const user = await auth.getCurrentUser();
const token = await auth.getAccessToken();

The API above is a design sketch, not an agreed final schema. Token handling should avoid exposing refresh tokens to arbitrary product code or sharing raw tokens between applications.


## 8. Identity providers versus connected services

A critical distinction was established: signing in with a provider and authorizing an external service connection are separate operations.

| Concept | Meaning | Example |
| --- | --- | --- |
| Identity provider | Proves who the user is and enables sign-in. | Google OAuth or GitHub OAuth. |
| Connected service | Grants a product permission to access an external service/resource. | GitHub repository storage authorization. |
| Canonical Yet Vast identity | Stable user identity used across Yet Vast products. | One yv_user_id linked to Google and/or GitHub identities. |

A user may sign in to Yet Vast with Google and separately connect GitHub for Cogmit storage. Signing in with GitHub does not automatically grant every repository permission required for file operations.

Do not automatically merge two Yet Vast identities solely because their Google and GitHub email addresses match. Require explicit account linking and verify ownership/authorization.

Each product determines which connected services it requires. Cogmit requires GitHub storage authorization; Fyuniverse does not require GitHub unless a feature explicitly depends on it.


## 9. Cogmit's GitHub requirement and reuse of existing implementation

| User-confirmed product requirement — Cogmit currently uses GitHub as its storage layer and has implemented almost all CRUD operations against GitHub files. Cogmit should enforce GitHub account linking before GitHub-backed storage functionality is available. |
| --- |

Expected Cogmit behavior:

| Scenario | Expected behavior |
| --- | --- |
| User signs into Cogmit with GitHub | Authenticate into Yet Vast, then ensure the required GitHub storage authorization/scopes are available. |
| User signs into Cogmit with Google | Authenticate into Yet Vast, then require the user to connect GitHub for Cogmit storage. |
| GitHub storage account not connected | Show a required connection flow and do not initialize GitHub-backed storage. |
| GitHub authorization is revoked or expires | Detect failed authorization and request reconnection/reauthorization. |
| GitHub connection is valid | Allow Cogmit storage operations subject to repository permissions. |

The first implementation task should be an audit of Cogmit's existing code. Identify and extract:

- OAuth authorization flow and callback handling.
- Permission/scopes currently requested.
- Access-token storage and refresh/expiration behavior.
- Repository discovery, creation and selection.
- File/directory listing and reading.
- File creation, update and deletion.
- SHA retrieval and SHA conflict handling.
- Commit metadata and error handling.
- Rate-limit handling and retry behavior.
- Existing data layout and assumptions in Cogmit.
Reuse working behavior where possible, but do not blindly transplant product-specific assumptions into a shared package. Separate generic GitHub storage operations from Cogmit's content model and UI.


## 10. GitHub authorization and security

The discussion identified GitHub OAuth for sign-in and GitHub storage authorization as separate. For repository operations, evaluate GitHub Apps with fine-grained repository permissions rather than assuming broad OAuth access is necessary.

- Request only the permissions required for the selected repository and operations.
- Store provider access tokens securely on the server, encrypted at rest where server-side storage is used.
- Do not expose OpenRouter keys, GitHub storage tokens or refresh tokens to product browser code.
- Use verified backend identity, not a userId supplied by the browser, to identify the caller.
- Validate the calling product and its authorization to access requested user data.
- Do not assume one product may access another product's data simply because both belong to Yet Vast.
- Provide clear disconnect/revocation behavior and explain which products depend on a connection.
A private GitHub repository is not the same as an encrypted vault. GitHub and anyone with authorized repository access can inspect its contents. Client-side encryption with user-controlled keys is a possible future enhancement, but it complicates server-side retrieval and memory processing.


## 11. GitHub as the Personal Intelligence source of truth

| User-proposed architecture — Store YAI Studio queries, answers and user Personal Intelligence in a user-owned GitHub repository so the user can clone and inspect their Personal Intelligence data. |
| --- |

This is a proposed initial persistence strategy intended to avoid operating a separate database service and to provide portability, inspectability and Git history.

Illustrative repository name: yv-personal-intelligence. The actual repository naming convention, ownership model, visibility and creation flow remain to be decided.


### 11.1 Illustrative repository structure

yv-personal-intelligence/
├── profile/
│   ├── identity.json
│   └── preferences.json
├── memory/
│   ├── facts.json
│   ├── preferences.json
│   ├── goals.json
│   ├── relationships.json
│   └── decisions.json
├── knowledge/
│   ├── topics/
│   └── references/
├── activity/
│   └── 2026/
│       └── 11/
│           ├── cogmit/
│           ├── fyuniverse/
│           └── yai-studio/
├── conversations/
│   └── 2026/
│       └── 11/
├── intelligence/
│   ├── memory-index.json
│   ├── relationships.json
│   └── manifest.json
└── README.md

This is an illustrative structure only. The final taxonomy, schemas, versioning strategy, retention rules and indexing approach need a dedicated specification.


### 11.2 Potential user benefits

- Ownership: the user controls the repository under their GitHub account.
- Portability: the user can clone the repository to a local machine.
- Transparency: the user can inspect stored memory and activity files.
- Version history: Git commits provide a history of file changes.
- Recoverability: earlier versions can be inspected and potentially restored.
- Interoperability: other tools may consume the documented structured data format.
- Lower infrastructure dependency: no dedicated memory database is required initially.
This makes Personal Intelligence a portable user data asset rather than an opaque platform-only memory store.


## 12. Separate interaction history from persistent memory

Queries, answers, retrieved context, memory candidates and accepted persistent memories must be represented as different data types. A query/answer log is not itself a memory.

| Data type | Purpose | Suggested location |
| --- | --- | --- |
| Query | What the user asked. | Activity/conversation log. |
| Answer | What the model returned. | Conversation log. |
| Retrieved context | Which memories/knowledge influenced the answer. | Interaction metadata. |
| Memory candidate | A possible fact/preference/goal to retain. | Candidate record or pending queue. |
| Persistent memory | Information accepted into central Personal Intelligence. | Memory files. |
| Memory change event | Why a memory was created, changed, merged or removed. | Memory audit log. |

Illustrative activity record:

{
  "eventId": "evt_001",
  "timestamp": "2026-11-10T18:30:00Z",
  "source": { "product": "cogmit" },
  "query": "What type of articles should I publish next?",
  "answer": "Consider publishing...",
  "retrievedMemoryIds": ["mem_012", "mem_019"],
  "memoryChanges": ["mem_024"]
}

Illustrative accepted memory:

{
  "id": "mem_024",
  "type": "interest",
  "value": "Interested in publishing analytical articles",
  "source": "cogmit",
  "confidence": 0.92,
  "createdAt": "2026-11-10T18:30:00Z"
}

The confidence value and field names are examples, not finalized semantics.

Do not convert every user query into a permanent memory. A transient question (for example, a weather query) may be recorded as activity if the user has enabled activity logging, but should not automatically become a personal preference or fact.

Raw query/answer retention should be configurable. Some interactions may contain sensitive or temporary information and should not be retained indefinitely.


## 13. Intelligence Activity Ledger

| User-confirmed product direction — YAI Studio's UI should show queries received from different apps through APIs and how those interactions contribute to central persistent personal memories. |
| --- |

The interface should evolve beyond a conventional conversation list into an Intelligence Activity Ledger. Potential fields and views:

- Which product initiated the interaction (Cogmit, Fyuniverse, YAI Studio or another product).
- When the request occurred and its request/event identifier.
- What information/context the product submitted.
- What YAI Studio retrieved from existing memory or knowledge.
- Which model/provider and execution mode were used, where appropriate.
- What response was generated, subject to retention settings.
- What memory candidates were extracted.
- Which candidates were accepted, rejected or left pending.
- Which persistent memories were created, updated, merged or removed.
- Why a piece of information was retained and which source interaction supports it.
- Which products have permission to access relevant memories.
The ledger should distinguish activity logging from memory retention. The user should be able to inspect and manage persistent memories independently from the raw interaction record.


## 14. GitHub storage constraints and mitigation


### 14.1 Git history and deletion

GitHub file updates create commits. Removing a memory from the current file does not automatically erase it from earlier commits. A request for permanent deletion may require repository history rewriting, and existing clones may still retain prior copies.

Therefore, define deletion semantics explicitly: logical deletion from current Personal Intelligence, audit retention, repository-history purge procedure, and user guidance for previously cloned copies. Do not promise that a normal file delete erases all historical copies.


### 14.2 Concurrent writes and SHA conflicts

GitHub Contents API updates/deletes require the current file SHA. Concurrent operations on the same file can conflict. The system needs conflict detection, retry/merge policy and write serialization or batching for files that receive frequent changes.

Avoid writing every query into one frequently updated activity.json file. Prefer immutable event files, partitioned logs or batched commits. The exact strategy should be tested against API limits and repository growth.


### 14.3 Rate limits and throughput

Authenticated GitHub REST API requests generally have primary and secondary rate limits. GitHub was discussed as suitable for an early personal-scale system with caching, batching and sensible request management, not as an unlimited transactional database.

Introduce a rebuildable index/cache only when retrieval or API traffic demonstrates a need. Keep GitHub as the authoritative source initially.


### 14.4 Data privacy

Private repository visibility is not equivalent to encryption. Avoid storing passwords, API keys, OAuth secrets, payment credentials or other secrets in memory files. Consider client-side encryption later if the product's threat model requires it. That will limit server-side semantic retrieval unless the user supplies decryption capability or selected data is made available to the service.


### 14.5 GitHub is not a transactional database

GitHub is a version-controlled file store with API constraints, not a transactional database or native vector database. It is suitable for the initial portable source of truth, but high-frequency writes, concurrent updates, complex queries and semantic retrieval may require derived indexes or a future storage adapter.


## 15. Storage abstraction and future migration

Even if GitHub is the only initial persistence provider, define a storage abstraction so YAI memory logic is not coupled directly to GitHub's API.

interface PersonalIntelligenceStorage {
  initialize(userId: string): Promise<void>;
  read(path: string): Promise<unknown>;
  create(path: string, data: unknown): Promise<void>;
  update(path: string, data: unknown): Promise<void>;
  delete(path: string): Promise<void>;
  list(path: string): Promise<string[]>;
  export(): Promise<Blob>;
}

Initial implementation:

PersonalIntelligenceStorage
          |
          └── GitHubStorageAdapter

Possible future adapters, only if justified:

PersonalIntelligenceStorage
          |
          ├── GitHubStorageAdapter
          ├── GoogleDriveStorageAdapter
          └── CloudDatabaseAdapter

No future adapter needs to be built now. The abstraction protects the memory engine from provider-specific CRUD, SHA and repository behavior.

A useful initial division is: GitHub is the authoritative persistent memory source; Vercel Functions handle orchestration; browser storage holds temporary/local state and model assets; any later index/cache is derived and rebuildable from GitHub.


## 16. Zero-cost development and operating model

The user's explicit goal is to develop and initially operate Yet Vast applications with zero paid cloud/server infrastructure. The discussed approach uses free tiers, user-owned storage and user-funded cloud AI or local inference.

| Component | Initial approach | Cost/qualification |
| --- | --- | --- |
| Cogmit/Fyuniverse/YAI Studio PWAs | Next.js hosted on Vercel | Free tier subject to usage and plan terms. |
| YAI API | Vercel Functions | Free tier subject to invocation, duration and platform limits. |
| Authentication | Firebase Authentication candidate | Free tier/quotas apply; final provider not locked. |
| Personal Intelligence persistence | Private GitHub repositories | No separate database server; GitHub plan/API limits apply. |
| GitHub CRUD | GitHub REST API | No separate hosting charge; rate limits and terms apply. |
| Cloud AI | User's OpenRouter key; potentially Google AI Studio | Model usage may be paid by the user; not inherently free. |
| Local AI | LiteRT-LM on user device | No model API fee; user pays in device compute, storage, battery and data. |
| Dedicated inference server | Not used initially | No always-on Legion Go or dedicated GPU server. |
| Dedicated memory database | Not required initially | GitHub is initial source of truth. |

| Cost boundary — Zero paid infrastructure is a development/early-stage target, not a guarantee of zero cost at unlimited scale. Free-tier quotas, commercial-use restrictions, provider charges, storage limits and future growth must be monitored. |
| --- |

Vercel Hobby was noted as intended for personal, non-commercial use. If Yet Vast becomes a commercial service, the hosting plan and terms must be revisited. Free-tier limits can change and should be checked before launch.

OpenRouter BYOK does not make inference free. The user pays for the models used through their own key. LiteRT-LM avoids provider inference charges but uses the user's device resources.


## 17. Provider key and cloud API security

The OpenRouter API key must never be sent to Cogmit/Fyuniverse browser code.

1. User configures the key through YAI Studio.
1. YAI backend stores the key securely, encrypted at rest.
1. Product sends an authenticated request to YAI API.
1. Backend validates user identity, product identity and authorization.
1. Backend retrieves the user's provider key server-side.
1. Backend calls OpenRouter and streams/returns the result.
1. Provider credentials remain server-side and are never returned in API responses.
The same principle applies to GitHub storage credentials. Product clients should receive only appropriately scoped application/session tokens, not unrestricted provider secrets.


## 18. Illustrative YAI Client contract

A shared YAI Client should hide product-level complexity around context retrieval, local/cloud execution and activity reporting. It should obtain identity/session credentials from Yet Vast Auth.

interface YAIClient {
  initialize(): Promise<void>;

  getContext(request: {
    productId: string;
    task: string;
    query: string;
  }): Promise<YAIContext>;

  generate(request: {
    query: string;
    context: YAIContext;
    execution: "local" | "cloud" | "auto";
  }): Promise<YAIResponse>;

  reportActivity(activity: {
    requestId: string;
    productId: string;
    response: string;
    memoryCandidates?: MemoryCandidate[];
  }): Promise<void>;
}

This is illustrative, not a final API schema. Internally, separate orchestration from runtime adapters. The YAI Client should not hard-code LiteRT-LM as the only local runtime or OpenRouter as the only cloud provider.

Potential internal adapters include OpenRouterProvider, GoogleAIStudioProvider and LiteRTLMWebProvider. Product applications should consume stable interfaces rather than provider-specific APIs.


## 19. Recommended implementation sequence

1. Audit Cogmit's existing GitHub implementation in detail. Record OAuth flow, scopes, token handling, repository operations, CRUD, SHA behavior, errors, rate limits and data assumptions.
1. Define Yet Vast identity model and backend account-linking behavior. Confirm how Google and GitHub identities map to one canonical Yet Vast user.
1. Extract @yvsol/auth-client with Google and GitHub sign-in, sessions, identity linking and token access.
1. Extract @yvsol/github-storage from Cogmit's reusable GitHub connection and repository/file CRUD operations.
1. Define Cogmit's mandatory GitHub storage connection policy and enforce it server-side where storage operations occur.
1. Specify the Personal Intelligence repository schema, file taxonomy, manifest, event records, memory records, versioning and deletion policy.
1. Implement GitHub-backed YAI persistence through a storage adapter.
1. Build YAI API with authentication, product authorization, context retrieval, provider configuration and OpenRouter BYOK.
1. Implement cloud execution through YAI API first, so products can use AI without opening YAI Studio.
1. Create @yvsol/yai-client and integrate it with Cogmit as the first consuming product.
1. Add the Intelligence Activity Ledger and memory candidate/approval/update pipeline.
1. Add LiteRT-LM Web through a local runtime adapter and device capability checks.
1. Test local/cloud selection, browser suspension, model downloads, storage limits, mobile WebGPU compatibility and fallback behavior.
1. Evaluate actual usage before introducing a database, vector store, dedicated inference server or native apps.

## 20. Established decisions, recommendations and open questions


### 20.1 Established by the user in this conversation

- YAI Studio is PWA-only; no native mobile application is planned.
- YAI Studio UI is for viewing, configuring and modifying Personal Intelligence.
- Yet Vast products integrate with YAI Studio through APIs.
- YAI Studio UI should show queries from different products and how they contribute to central persistent personal memories.
- Both cloud YAI API execution and local YAI Client/LiteRT-LM execution should remain available.
- For cloud execution, users configure their OpenRouter API key in YAI Studio; the Vercel-hosted YAI API should answer authorized product requests without the YAI Studio PWA being open.
- For local execution, each Yet Vast PWA can integrate the YAI Client and run LiteRT-LM on the user's device.
- Yet Vast Auth should support Google and GitHub OAuth sign-in.
- Cogmit must require a GitHub connection because its current storage is GitHub-based.
- Cogmit already has most GitHub file CRUD operations implemented; those should be audited for extraction/reuse.
- The user is considering GitHub as the storage location for YAI Studio queries, answers and Personal Intelligence, with a user-owned cloneable memory repository.
- The initial development/operating goal is zero paid cloud/server infrastructure.

### 20.2 Recommendations made during the discussion

- Keep authentication, GitHub storage and YAI integration in separate shared packages.
- Use one canonical Yet Vast user identity and explicitly link multiple identity providers.
- Separate identity-provider sign-in from connected-service authorization.
- Use a server-side identity/auth backend; the Auth package is only a client SDK.
- Evaluate GitHub Apps and fine-grained repository permissions for storage authorization.
- Keep provider keys and GitHub storage credentials server-side.
- Use GitHub as initial source of truth behind a storage abstraction.
- Separate interaction logs, retrieved context, memory candidates and accepted persistent memories.
- Build an Intelligence Activity Ledger with source product, context, memory changes and provenance.
- Avoid one frequently updated activity file; use partitioned/immutable event files or batching.
- Add a Device Capability Manager and model manager for local inference.
- Start with cloud YAI API integration, then add LiteRT-LM Web.
- Do not build native apps, a dedicated inference server or a separate database without a demonstrated requirement.

### 20.3 Open design questions requiring decisions

- Will Firebase Authentication be the initial identity backend, or will a different OIDC identity service be used?
- Will GitHub storage authorization use the existing Cogmit OAuth implementation initially, or will a GitHub App be introduced immediately?
- Will each user create/own a private repository, or will a centralized service-owned repository be used with user-specific directories? The user-owned cloneable repository direction suggests the former, but ownership and provisioning need confirmation.
- What is the canonical repository name and naming convention?
- What exact GitHub scopes/permissions are required for repository creation, selection and CRUD?
- What are the final Personal Intelligence memory categories and JSON schemas?
- Will raw queries and answers be retained by default, opt-in, or configurable per product/category?
- What is the retention and permanent-deletion policy, including Git history and previously cloned repositories?
- Will memory candidates be automatically accepted based on policy, require user approval, or use a mixed model?
- How will conflicting or duplicate memory updates be resolved?
- How will GitHub writes be queued, batched and retried when SHA conflicts or rate limits occur?
- What model formats and specific LiteRT-LM Web models will be supported first?
- Will local model files be duplicated per product origin, or will a shared-origin model distribution/cache strategy be explored?
- What are the exact product-level permissions for Cogmit, Fyuniverse and future applications?
- What are the fallback rules when local inference is unavailable, offline, too slow or incompatible?
- What usage thresholds trigger migration from GitHub-backed files/free tiers to a database or paid hosting?

## 21. Architecture principles to preserve

- YAI Studio is the central intelligence authority, not a required always-on local AI server.
- The YAI Studio PWA is a management UI; APIs are the product integration boundary.
- Every Yet Vast product remains independently deployable.
- One Yet Vast identity can be authenticated through Google or GitHub and can link both.
- Identity is separate from external service authorization.
- Cogmit requires GitHub storage authorization; other products declare their own requirements.
- Cloud inference secrets remain on the server.
- Local inference runs inside the active product PWA, not by relying on a closed YAI PWA waking up.
- Local and cloud execution remain interchangeable behind stable SDK interfaces.
- Personal Intelligence is central and persistent; product data remains product-owned unless explicitly authorized.
- Activity history and durable memory are different data classes.
- GitHub is the proposed initial user-owned source of truth, with portability as a product benefit.
- Storage abstractions should prevent a future migration from rewriting the intelligence engine.
- Zero paid infrastructure is an initial constraint, not an unlimited-scale guarantee.

## 22. Immediate next action

| Next task — Perform a thorough technical audit of the existing Cogmit Next.js project, specifically its GitHub OAuth and file CRUD implementation. Produce an extraction map showing reusable code, Cogmit-specific code, security gaps, required scopes, API contracts and the proposed boundaries for @yvsol/auth-client and @yvsol/github-storage. |
| --- |

After that audit, define the Yet Vast identity and Personal Intelligence repository specifications before implementing the shared packages. This sequence minimizes rewrites and keeps the architecture grounded in working Cogmit code.


## Appendix A — Key terminology

| Term | Meaning in this architecture |
| --- | --- |
| YAI Studio | Central Personal Intelligence platform and its PWA management interface. |
| YAI API | Server-side API used by Yet Vast products for context, memory, orchestration and cloud inference. |
| YAI Client | Shared product SDK for calling YAI APIs and coordinating AI execution. |
| YAI local runtime | Browser-side LiteRT-LM adapter used by an active product PWA. |
| Yet Vast Auth | Shared client authentication SDK backed by a central identity service. |
| GitHub Storage | Reusable integration for repository and file operations. |
| Personal Intelligence | User-specific persistent memories, preferences, goals, relationships, decisions and knowledge. |
| Intelligence Activity Ledger | Trace of cross-product queries, context use, model responses and memory contributions. |
| BYOK | Bring Your Own Key: user supplies their own provider API key, stored and used server-side. |
| PWA | Progressive Web App; installable web application with browser-controlled lifecycle and capabilities. |
