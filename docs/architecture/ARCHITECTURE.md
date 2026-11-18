# YAI Studio — Architecture

## 1. System context

```text
                         Yet Vast Solutions
                                  |
          +-----------------------+----------------------+
          |                       |                      |
      Cogmit                  Fyuniverse             Other YVS Apps
          |                       |                      |
          +-----------------------+----------------------+
                                  |
                       YAI API / YAI Client
                                  |
                         YAI Studio Backend
                                  |
               +------------------+------------------+
               |                  |                  |
          Yet Vast Auth       GitHub Storage      Cloud AI Providers
          identity/session    user-owned repo     OpenRouter / Google
               |
          Google / GitHub
          provider identity
```

YAI Studio is a central intelligence authority and management interface. Each product remains independently deployable and owns its own product data and UX.

## 2. Main boundaries

### 2.1 Yet Vast Auth

Owns canonical persistent identity, provider mappings, central application registration/approval, OAuth policy, authorization-code exchange and signed identity assertions.

YAI consumes Yet Vast Auth. It must not create a competing central identity database or copy central Auth administration.

### 2.2 YAI application

Owns:
- YAI product UI;
- YAI-specific user session;
- authorization decisions for YAI features;
- conversation/memory/knowledge domain logic;
- GitHub storage adapter;
- provider orchestration;
- YAI API routes;
- Activity Ledger and memory workflow.

### 2.3 GitHub

Initial authoritative persistence for the user's YAI data is a private repository in the user's own GitHub account named exactly `YVSApps_Data_YaiStudio`.

GitHub is versioned file storage, not a transactional database or vector database. Use an adapter boundary and handle rate limits, SHA conflicts, retries, batching and partial failures.

### 2.4 Cloud AI providers

Cloud providers are called server-side. OpenRouter BYOK is the primary initial provider direction. Provider keys never enter browser bundles or user data repositories.

### 2.5 Future YAI Client and local runtime

YAI Client is the stable product-facing integration SDK. Local LiteRT-LM execution is a separate runtime adapter and is deferred to v1. Products must not depend on the YAI Studio UI being open.

## 3. V0 request flow

1. User visits YAI Studio.
2. User authenticates through the approved Yet Vast Auth flow.
3. YAI server validates the signed assertion against Auth JWKS and creates a host-bound YAI session.
4. User completes GitHub repository authorization, distinct from identity authentication where required.
5. Server validates the connected GitHub account and checks for `YVSApps_Data_YaiStudio`.
6. If absent, UI offers explicit private repository creation.
7. If present, server validates repository owner, visibility and access.
8. User initializes the data structure through an explicit operation if required.
9. YAI UI reads/writes through server-side storage services.
10. For cloud generation, YAI API retrieves authorized context, selects provider/model, calls provider server-side and records activity/memory candidates according to user settings.

## 4. Suggested Next.js module boundaries

Adapt to existing repository structure; do not force a large architecture rewrite.

```text
src/
  app/
    (public)/
    (app)/
    api/
      auth/
      github/
      conversations/
      workspaces/
      memory/
      knowledge/
      activity/
      providers/
      yai/
  components/
    layout/
    navigation/
    conversations/
    memory/
    knowledge/
    activity/
    settings/
    ui/
  lib/
    auth/
    github/
    storage/
    domain/
    services/
    providers/
    validation/
    security/
    logging/
  styles/
  types/
```

Keep server-only services separated from client components. Route handlers validate requests and coordinate services; business rules live in domain/service modules.

## 5. API surfaces

Initial internal API areas may include:
- `/api/auth/*` — callback/session/sign-out;
- `/api/github/connection` — connection and repository status;
- `/api/github/repository/create` — explicit user-confirmed creation;
- `/api/storage/initialize` — explicit data-layout initialization;
- `/api/conversations/*`;
- `/api/workspaces/*`;
- `/api/memory/*`;
- `/api/knowledge/*`;
- `/api/activity/*`;
- `/api/providers/*`;
- `/api/yai/generate` — authenticated cloud generation.

Use typed request/response contracts and consistent error envelopes. Exact route names may be adapted to existing conventions. Every private route must verify session, user ownership and relevant GitHub authorization server-side.

## 6. Persistence abstraction

Define a small `PersonalIntelligenceStorage` contract for reading/writing domain records. Initial adapter: `GitHubPersonalIntelligenceStorage`.

Do not leak GitHub SHA, branch or Contents API details into UI components or memory/conversation business logic. Do not add alternate storage adapters until required.

## 7. Future v1 local execution

The active product PWA initializes LiteRT-LM locally where browser, WebGPU, model and device support allow. A closed YAI PWA is not a dependable inference server. Model files may be origin-scoped and duplicated across products. The local runtime needs capability checks, user-controlled model downloads and cloud fallback.

## 8. Reliability and consistency

- Reads never mutate.
- Multi-file logical writes must have an explicit commit and recovery strategy.
- Use GitHub file SHA for update/delete and handle conflicts.
- Do not run concurrent updates/deletes against the same path.
- Prefer batching related writes into one commit where supported.
- Use immutable/partitioned activity records rather than one hot growing file.
- Make retries idempotent.
- Report partial failures accurately.
- Indexes are rebuildable navigation aids, not content authorities.
