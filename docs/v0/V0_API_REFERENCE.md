# YAI Studio V0 — Complete REST API Reference

**Specification Version:** 1.0.0  
**Base URL:** `https://yaistudio.yetvast.com/api` (or local `http://localhost:3000/api`)  
**Authentication:** Signed host-bound session cookie (`yai_session`) unless marked Public.  
**Response Envelopes:** Standard JSON `application/json; charset=utf-8`.  

---

## 1. Authentication & Session Endpoints

### 1.1 `GET /api/auth/authorize`
- **Description:** Initiates the Yet Vast Auth PKCE authorization redirect. Generates PKCE challenge and state cookies, then redirects to Yet Vast Auth.
- **Authentication:** Public (No session required).
- **Query Parameters:**
  - `provider` (optional): Pre-select identity provider (e.g. `google` or `github`).
  - `identity_provider` (optional): Alias for `provider`.
- **Response:**
  - `307 Temporary Redirect` to `https://auth.yetvast.com/authorize?...`
  - Sets cookies: `yai_oauth_state` (10 min), `yai_oauth_verifier` (10 min).
- **Errors:**
  - `500 Internal Server Error`: `{ "error": "...", "gate": "Auth Registration Gate..." }`

---

### 1.2 `GET /api/auth/callback`
- **Description:** Handles OAuth authorization code callback from Yet Vast Auth. Exchanges code + PKCE verifier for signed assertion token, validates JWKS signature, establishes user session, and redirects user.
- **Authentication:** Public (Validates `state` cookie).
- **Query Parameters:**
  - `code` (required): Authorization code from Yet Vast Auth.
  - `state` (required): CSRF state token matching `yai_oauth_state`.
  - `error` (optional): Error code returned by authority.
- **Response:**
  - `307 Temporary Redirect` to `/` (if GitHub login verified) or `/github-connect` (if Google login needing GitHub storage).
  - Clears cookies: `yai_oauth_state`, `yai_oauth_verifier`.
  - Sets cookie: `yai_session` (HS256 signed JWT, 7 days).
- **Errors:**
  - Redirects to `/sign-in?error=invalid_oauth_state` on state mismatch.
  - Redirects to `/sign-in?error=assertion_verification_failed` on failed JWKS check.

---

### 1.3 `GET /api/auth/session`
- **Description:** Returns the authenticated session status and user metadata.
- **Authentication:** Session cookie (`yai_session`).
- **Response `200 OK`:**
  ```json
  {
    "authenticated": true,
    "user": {
      "yvUserId": "yv_usr_google_123456",
      "githubLogin": "octocat",
      "githubConnected": true,
      "repoVerified": false,
      "expiresAt": "2026-11-26T10:00:00.000Z"
    }
  }
  ```
- **Response `401 Unauthorized`:**
  ```json
  { "authenticated": false }
  ```

---

### 1.4 `POST /api/auth/sign-out`
- **Description:** Destroys the current user session and clears the encrypted credential vault cookie. Enforces CSRF origin checks.
- **Authentication:** Session cookie.
- **Headers:** `Origin` must match `Host`.
- **Response `200 OK`:**
  ```json
  { "success": true }
  ```
  - Clears `yai_session` and `yai_vault` cookies (`maxAge: 0`).
- **Errors:**
  - `403 Forbidden`: `{ "error": "CSRF validation failed" }`

---

### 1.5 `GET /api/auth/github/connect`
- **Description:** Initiates secondary GitHub OAuth flow for repository storage access (`repo` scope).
- **Authentication:** Requires active session.
- **Response:**
  - `307 Temporary Redirect` to `https://github.com/login/oauth/authorize?...`
  - Sets cookie: `yai_gh_oauth_state` (10 min).
- **Errors:**
  - `307 Redirect` to `/sign-in` if unauthenticated.

---

### 1.6 `GET /api/auth/github/callback`
- **Description:** Exchanges GitHub code for access token, verifies GitHub user login, encrypts and stores token in server vault, and updates session.
- **Authentication:** Requires active session and matching `yai_gh_oauth_state` cookie.
- **Query Parameters:** `code`, `state`.
- **Response:**
  - `307 Temporary Redirect` to `/repo-setup`.
  - Stores encrypted token in `credential-vault`.
  - Sets updated `yai_session` with `githubConnected: true`.
- **Errors:**
  - Redirects to `/github-connect?error=invalid_github_state` or `github_token_exchange_failed`.

---

## 2. GitHub Storage & Repository Endpoints

### 2.1 `GET /api/github/connection`
- **Description:** Checks whether GitHub storage is authorized and inspects status of `YVSApps_Data_YaiStudio`.
- **Authentication:** Requires active session.
- **Response `200 OK`:**
  ```json
  {
    "connected": true,
    "githubLogin": "octocat",
    "repoName": "YVSApps_Data_YaiStudio",
    "repoExists": true,
    "repoPrivate": true,
    "repoOwnerMatch": true,
    "isInitialized": true
  }
  ```
- **Response when disconnected `200 OK`:**
  ```json
  {
    "connected": false,
    "repoName": "YVSApps_Data_YaiStudio"
  }
  ```

---

### 2.2 `POST /api/github/repository/create`
- **Description:** Explicitly creates the private repository `YVSApps_Data_YaiStudio` in the user's GitHub account and verifies private visibility.
- **Authentication:** Requires active session with stored GitHub token.
- **Response `200 OK` (Created or Exists):**
  ```json
  {
    "success": true,
    "repository": "octocat/YVSApps_Data_YaiStudio",
    "url": "https://github.com/octocat/YVSApps_Data_YaiStudio"
  }
  ```
- **Errors:**
  - `400 Bad Request`: Repository exists but is public.
  - `403 Forbidden`: GitHub storage not authorized.
  - `500 Internal Server Error`: Post-creation verification failed.

---

### 2.3 `GET /api/storage/initialize`
- **Description:** Checks if repository layout is initialized and returns proposed schema layout.
- **Authentication:** Requires active session.
- **Response `200 OK`:**
  ```json
  {
    "repository": "octocat/YVSApps_Data_YaiStudio",
    "isInitialized": false,
    "proposedLayout": [
      "README.md",
      "yaiManifest.json",
      "conversationsIndex.json",
      "workspaces/",
      "unfiledConversations/",
      "memory/facts.json",
      "..."
    ]
  }
  ```

---

### 2.4 `POST /api/storage/initialize`
- **Description:** Executes explicit initialization of repository layout (`README.md`, `yaiManifest.json`, `conversationsIndex.json`, memory category files).
- **Authentication:** Requires active session.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "createdFiles": [
      "README.md",
      "yaiManifest.json",
      "conversationsIndex.json",
      "memory/facts.json",
      "memory/preferences.json",
      "memory/interests.json",
      "memory/goals.json",
      "memory/relationships.json",
      "memory/decisions.json"
    ]
  }
  ```

---

## 3. Conversations & Messages Endpoints

### 3.1 `GET /api/conversations`
- **Description:** Retrieves the global conversations index (`conversationsIndex.json`).
- **Authentication:** Requires active session.
- **Response `200 OK`:**
  ```json
  {
    "schemaVersion": 1,
    "updatedAt": "2026-11-19T10:00:00.000Z",
    "conversations": [
      {
        "id": "e4b2d189-9a2c-47b6-9df2-a39c91f0923e",
        "title": "V1 Architecture Strategy",
        "workspaceName": "Architecture",
        "path": "workspaces/Architecture/e4b2d189-9a2c-47b6-9df2-a39c91f0923e",
        "updatedAt": "2026-11-19T10:00:00.000Z"
      }
    ]
  }
  ```

---

### 3.2 `POST /api/conversations`
- **Description:** Creates a new conversation directory, `conversation.json`, empty `messages.json`, `conversation.md`, and adds an entry to `conversationsIndex.json`.
- **Authentication:** Requires active session.
- **Request Body:**
  ```json
  {
    "title": "Research on Local Inference",
    "workspacePath": "workspaces/Research",
    "model": "anthropic/claude-3.5-sonnet",
    "provider": "openrouter"
  }
  ```
- **Response `201 Created`:** Returns `ConversationMeta` object.

---

### 3.3 `GET /api/conversations/[id]`
- **Description:** Retrieves conversation metadata, full message history, file SHAs (for optimistic concurrency), and markdown transcript.
- **Authentication:** Requires active session.
- **Response `200 OK`:**
  ```json
  {
    "meta": {
      "id": "e4b2d189-9a2c-47b6-9df2-a39c91f0923e",
      "title": "Research on Local Inference",
      "createdAt": "2026-11-19T10:00:00.000Z",
      "updatedAt": "2026-11-19T10:00:00.000Z",
      "workspacePath": "workspaces/Research",
      "status": "active"
    },
    "messages": [],
    "metaSha": "7d9b4f...",
    "messagesSha": "2a1c8e...",
    "markdown": "# Research on Local Inference\n..."
  }
  ```
- **Errors:** `404 Not Found` if conversation directory does not exist.

---

### 3.4 `PATCH /api/conversations/[id]`
- **Description:** Updates conversation metadata (title, status). Requires current `metaSha` to prevent concurrent overwrite.
- **Authentication:** Requires active session.
- **Request Body:**
  ```json
  {
    "title": "Updated Conversation Title",
    "status": "archived",
    "metaSha": "7d9b4f..."
  }
  ```
- **Response `200 OK`:** Returns updated `ConversationMeta`.
- **Errors:** `400 Bad Request` if `metaSha` missing; `409 Conflict` if SHA stale.

---

### 3.5 `POST /api/conversations/[id]/messages`
- **Description:** Appends a message to `messages.json`, updates conversation timestamp in `conversation.json`, regenerates `conversation.md`, and touches index timestamp.
- **Authentication:** Requires active session.
- **Request Body:**
  ```json
  {
    "role": "user",
    "content": "Can we run Gemma 2B locally?",
    "model": "anthropic/claude-3.5-sonnet",
    "provider": "openrouter",
    "tokenCount": 12
  }
  ```
- **Response `201 Created`:** Returns created `Message` object.

---

## 4. Workspaces Endpoints

### 4.1 `GET /api/workspaces`
- **Description:** Lists workspace directories under `workspaces/` (or child path).
- **Authentication:** Requires active session.
- **Query Parameters:** `parent` (optional, default: `workspaces`).
- **Response `200 OK`:**
  ```json
  {
    "workspaces": [
      {
        "id": "a189f32b-3120-4dc5-b461-9c878e8749a2",
        "name": "Research",
        "description": "Exploratory AI topics",
        "createdAt": "2026-11-19T08:00:00.000Z",
        "updatedAt": "2026-11-19T08:00:00.000Z"
      }
    ]
  }
  ```

---

### 4.2 `POST /api/workspaces`
- **Description:** Sanitizes workspace name and creates `workspaces/<name>/workspaceData.json`.
- **Authentication:** Requires active session.
- **Request Body:**
  ```json
  {
    "name": "Product Development",
    "parentPath": null,
    "description": "Core product engineering"
  }
  ```
- **Response `201 Created`:** Returns created `WorkspaceData`.

---

## 5. Personal Memory Endpoints

### 5.1 `GET /api/memory/[type]`
- **Description:** Retrieves structured memory records for a given category.
- **Route Parameter:** `type` (`fact`, `preference`, `interest`, `goal`, `relationship`, `decision`, or plural equivalent).
- **Authentication:** Requires active session.
- **Response `200 OK`:** Returns `MemoryFile` object.

---

### 5.2 `POST /api/memory/[type]`
- **Description:** Adds an active memory record to `memory/<type>s.json`.
- **Route Parameter:** `type`.
- **Authentication:** Requires active session.
- **Request Body:**
  ```json
  {
    "content": "Prefers TypeScript strict mode with explicit return types.",
    "provenance": "Developer settings",
    "source": "manual",
    "confidence": 1.0
  }
  ```
- **Response `201 Created`:** Returns created `MemoryRecord`.

---

### 5.3 `GET /api/memory/candidates`
- **Description:** Lists pending memory candidates from `memory/candidates/` awaiting user review.
- **Authentication:** Requires active session.
- **Response `200 OK`:**
  ```json
  {
    "candidates": [
      {
        "id": "c1234567-89ab-cdef-0123-456789abcdef",
        "proposedType": "preference",
        "proposedContent": "Prefers JetBrains Mono for monospace code blocks.",
        "proposedAt": "2026-11-19T10:45:00.000Z",
        "status": "pending"
      }
    ]
  }
  ```

---

### 5.4 `POST /api/memory/candidates`
- **Description:** Proposes a new memory candidate into the review queue.
- **Authentication:** Requires active session.
- **Request Body:**
  ```json
  {
    "proposedType": "goal",
    "proposedContent": "Deploy YAI Studio V1 PWA before Q2.",
    "sourceConversationId": "e4b2d189-9a2c-47b6-9df2-a39c91f0923e"
  }
  ```
- **Response `201 Created`:** Returns created `MemoryCandidate`.

---

### 5.5 `POST /api/memory/candidates/[id]/review`
- **Description:** Records user decision (`approved` or `rejected`) on a candidate. If approved, automatically promotes content into active memory category.
- **Route Parameter:** `id` (Candidate UUID).
- **Authentication:** Requires active session.
- **Request Body:**
  ```json
  {
    "decision": "approved"
  }
  ```
- **Response `200 OK`:** `{ "success": true, "id": "...", "decision": "approved" }`

---

## 6. Knowledge & Activity Endpoints

### 6.1 `GET /api/knowledge`
- **Description:** Lists reference documents from `knowledge/references/`.
- **Authentication:** Requires active session.
- **Response `200 OK`:** `{ "items": [ ... ] }`

---

### 6.2 `POST /api/knowledge`
- **Description:** Creates a reference document in `knowledge/references/<id>.json`.
- **Authentication:** Requires active session.
- **Request Body:**
  ```json
  {
    "title": "LiteRT-LM Browser Runtime Notes",
    "content": "LiteRT-LM uses WebGPU for in-browser inference...",
    "source": "Google Documentation",
    "sourceUrl": "https://ai.google.dev",
    "tags": ["runtime", "local-ai"]
  }
  ```
- **Response `201 Created`:** Returns created `KnowledgeItem`.

---

### 6.3 `GET /api/activity`
- **Description:** Lists partitioned activity records from `activity/<YYYY>/<MM>/`.
- **Authentication:** Requires active session.
- **Query Parameters:** `limit` (optional, default: 50).
- **Response `200 OK`:** `{ "events": [ ... ] }`

---

### 6.4 `POST /api/activity`
- **Description:** Appends an immutable activity event into the partitioned ledger.
- **Authentication:** Requires active session.
- **Request Body:**
  ```json
  {
    "sourceProduct": "cogmit",
    "querySummary": "Summarized chapter 3 notes",
    "responseSummary": "Created 3 outline points",
    "executionMode": "cloud",
    "model": "anthropic/claude-3.5-sonnet",
    "provider": "openrouter"
  }
  ```
- **Response `201 Created`:** Returns created `ActivityEvent`.

---

## 7. AI Providers & Generation Endpoints

### 7.1 `GET /api/providers`
- **Description:** Lists configuration statuses (masked key, configured boolean) for supported cloud AI providers.
- **Authentication:** Requires active session.
- **Response `200 OK`:**
  ```json
  {
    "providers": [
      {
        "provider": "openrouter",
        "configured": true,
        "maskedKey": "sk-or-...1234",
        "storedAt": "2026-11-19T09:00:00.000Z"
      },
      {
        "provider": "google-ai",
        "configured": false
      }
    ],
    "limitationNote": "Server-side AES-256-GCM encrypted vault..."
  }
  ```

---

### 7.2 `POST /api/providers/[provider]`
- **Description:** Validates user-supplied API key with a live test call to the provider, encrypts it with AES-256-GCM, and stores it in the server vault.
- **Route Parameter:** `provider` (`openrouter` or `google-ai`).
- **Authentication:** Requires active session.
- **Request Body:** `{ "key": "sk-or-v1-..." }`
- **Response `200 OK`:** Returns updated `ProviderKeyStatus`.
- **Errors:** `400 Bad Request` if test validation fails (`"Invalid API Key"`).

---

### 7.3 `DELETE /api/providers/[provider]`
- **Description:** Removes stored API key from the encrypted vault.
- **Route Parameter:** `provider`.
- **Authentication:** Requires active session.
- **Response `200 OK`:** `{ "success": true, "provider": "openrouter", "configured": false }`

---

### 7.4 `GET /api/providers/[provider]/models`
- **Description:** Dynamically fetches available models using the user's stored BYOK key.
- **Route Parameter:** `provider`.
- **Authentication:** Requires active session.
- **Response `200 OK`:** Returns array of `{ id, name, contextLength, pricing }`.

---

### 7.5 `GET /api/yai/context`
- **Description:** External integration endpoint for authorized YVS products (Cogmit, Fyuniverse). Returns active facts, preferences, and goals.
- **Authentication:** Requires active session.
- **Response `200 OK`:**
  ```json
  {
    "yvUserId": "yv_usr_google_123456",
    "facts": [ ... ],
    "preferences": [ ... ],
    "goals": [ ... ]
  }
  ```

---

### 7.6 `POST /api/yai/generate`
- **Description:** Assembles active personal memory context, executes cloud inference, appends user & assistant turns to `messages.json`, regenerates `conversation.md`, and logs to Activity Ledger.
- **Authentication:** Requires active session with connected GitHub storage.
- **Request Body:**
  ```json
  {
    "conversationId": "e4b2d189-9a2c-47b6-9df2-a39c91f0923e",
    "message": "Explain our storage invariants.",
    "model": "anthropic/claude-3.5-sonnet",
    "provider": "openrouter"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "message": {
      "id": "6d78a9bc-...",
      "sequence": 4,
      "role": "assistant",
      "content": "...",
      "createdAt": "2026-11-19T10:15:04.000Z",
      "model": "anthropic/claude-3.5-sonnet",
      "provider": "openrouter",
      "tokenCount": 85
    },
    "model": "anthropic/claude-3.5-sonnet",
    "provider": "openrouter"
  }
  ```
- **Errors:**
  - `400 Bad Request`: Missing `conversationId` or `message`.
  - `403 Forbidden`: GitHub storage not connected.
  - `404 Not Found`: Conversation does not exist.
  - `500 Internal Server Error`: Generation or storage failure.
