# YAI Studio V0 — Authentication & Security Architecture

**Security Baseline:** V0 As-Built  
**Identity Authority:** Yet Vast Auth (`@yetvast/auth` v0.3.0)  
**Storage Authorization:** GitHub OAuth 2.0 (`repo` scope)  
**Session Standard:** Host-Bound Signed JWT Cookie (`yai_session`)  
**Credential Vault:** AES-256-GCM Encrypted Persistent Storage  

---

## 1. Dual-Boundary Security Architecture

The core tenet of YAI Studio's security model is the **strict separation between Identity Authentication and Storage Authorization**:

```text
 ┌────────────────────────────────────────────────────────┐
 │                      USER BROWSER                      │
 └─────────────┬────────────────────────────┬─────────────┘
               │ 1. Sign In Request         │ 4. Authorize Storage
               v                            v
 ┌──────────────────────────┐  ┌──────────────────────────┐
 │      YET VAST AUTH       │  │       GITHUB OAUTH       │
 │   (Identity Authority)   │  │   (Storage Authority)    │
 ├──────────────────────────┤  ├──────────────────────────┤
 │ - Google/GitHub IdP      │  │ - Scope: 'repo'          │
 │ - EdDSA Assertion JWT    │  │ - CRUD on user repos     │
 │ - Subject: 'yvUserId'    │  │ - Token never in browser │
 └─────────────┬────────────┘  └────────────┬─────────────┘
               │ 2. Assertion               │ 5. Token Exchange
               v                            v
 ┌────────────────────────────────────────────────────────┐
 │                   YAI STUDIO BACKEND                   │
 ├────────────────────────────────────────────────────────┤
 │ - Validates EdDSA signature against Auth JWKS          │
 │ - Issues host-bound 'yai_session' cookie (HS256)       │
 │ - Encrypts GitHub token with AES-256-GCM               │
 │ - Persists encrypted secrets in Credential Vault       │
 └────────────────────────────────────────────────────────┘
```

1. **Authentication Boundary (Yet Vast Auth):**
   - Proves **identity** ("Who is this user?").
   - Resolves a persistent canonical identifier (`yvUserId`).
   - Does **not** grant permission to access the user's private GitHub repository.
2. **Authorization Boundary (GitHub OAuth):**
   - Proves **storage access** ("May YAI Studio read and write files in the user's repository?").
   - Issues a GitHub access token scoped to `repo`.
   - Token is kept strictly server-side, encrypted at rest, and never exposed to the client.

---

## 2. Yet Vast Auth Integration (`src/lib/auth/yetvast-auth.ts`)

YAI Studio integrates with Yet Vast Auth via the official `@yetvast/auth` SDK (v0.3.0) using dynamic consumer registration discovery.

### 2.1 Dynamic Application Discovery
Rather than hardcoding an application ID, the SDK automatically resolves the approved registration from Yet Vast Auth's central registry by matching the application's origin:

- **Auth Server Origin:** `YETVAST_AUTH_ORIGIN` (default: `https://auth.yetvast.com`)
- **Application Origin:** `NEXT_PUBLIC_YAI_ORIGIN` (canonical: `https://yaistudio.yetvast.com`)
- **Discovered Registration:** `yaistudio-yetvast-com-4dfnb2r9`
- **Canonical Callback URI:** `https://yaistudio.yetvast.com/api/auth/callback`

### 2.2 PKCE Authorization Flow (`/api/auth/authorize`)
1. User clicks **"Sign in with Yet Vast Auth"**.
2. Handler generates a high-entropy PKCE `code_verifier`, derives `code_challenge` (`S256`), and generates a cryptographically random `state` token.
3. Sets short-lived, HttpOnly, Secure cookies:
   - `yai_oauth_state` (`maxAge: 600`, SameSite=Lax)
   - `yai_oauth_verifier` (`maxAge: 600`, SameSite=Lax)
4. Redirects the user's browser to Yet Vast Auth's `/authorize` endpoint:
   ```text
   https://auth.yetvast.com/authorize?app_id=yaistudio-yetvast-com-4dfnb2r9&redirect_uri=https://yaistudio.yetvast.com/api/auth/callback&state=<state>&code_challenge=<challenge>&code_challenge_method=S256
   ```

### 2.3 Assertion Verification & Session Issuance (`/api/auth/callback`)
1. Receives `code` and `state` from Yet Vast Auth.
2. Validates `state` against `yai_oauth_state` cookie.
3. Calls Yet Vast Auth token endpoint (`/api/token`) with `code` and `codeVerifier`.
4. SDK verifies the returned identity assertion JWT:
   - Validates signature against central JWKS (`https://auth.yetvast.com/.well-known/jwks.json`).
   - Verifies issuer (`https://auth.yetvast.com`), audience (`yaistudio-yetvast-com-4dfnb2r9`), and expiration.
5. Clears OAuth state cookies.
6. Establishes the YAI Studio session cookie (`yai_session`).

---

## 3. Host-Bound Session Management (`src/lib/auth/session.ts`)

YAI Studio maintains an independent, host-bound session cookie rather than relying on external session servers:

- **Cookie Name:** `yai_session`
- **Signing Algorithm:** HS256 via `jose` library
- **Secret Key:** `YAI_SESSION_SECRET` (minimum 32 characters, enforced at startup)
- **Duration:** 7 days (`604,800` seconds)
- **Security Flags:**
  - `HttpOnly: true` (prevents client-side JavaScript access / XSS theft)
  - `Secure: true` in production (enforced over HTTPS)
  - `SameSite: 'lax'` (protects against CSRF on state-changing requests while preserving top-level navigation)
  - `Path: '/'`
  - **No `Domain` attribute:** Strictly host-bound to prevent sibling subdomain access.

### Session Payload Structure:
```typescript
export interface SessionPayload {
  yvUserId: string;          // Canonical Yet Vast User ID (e.g. "yv_usr_...")
  githubLogin?: string;      // Authenticated GitHub username
  githubConnected: boolean;  // True if GitHub storage grant has been completed
  repoVerified: boolean;     // True if YVSApps_Data_YaiStudio exists & verified
  iat: number;               // Issued at (seconds)
  exp: number;               // Expiration (seconds)
}
```

---

## 4. Credential Vault & Encryption at Rest (`src/lib/storage/credential-vault.ts`)

User secrets—including the GitHub OAuth token and Bring-Your-Own-Key (BYOK) provider credentials (OpenRouter, Google AI Studio)—require persistent storage across Vercel serverless Lambda instances without ever being committed to GitHub or exposed to the browser.

### 4.1 Encryption Architecture (AES-256-GCM)
- **Key Derivation:** Derived from `YAI_CREDENTIAL_ENCRYPTION_KEY` (or `CREDENTIAL_ENCRYPTION_SECRET`), hashed to 32 bytes via SHA-256 if not provided as a raw 32-byte base64 buffer.
- **Algorithm:** Authenticated AES-256-GCM (Galois/Counter Mode).
- **Initialization Vector:** 96-bit (12 bytes) cryptographically random IV generated per encryption operation (`crypto.randomBytes(12)`).
- **Authentication Tag:** 128-bit authentication tag appended to detect any tampering or bit flipping.
- **Payload Structure:**
  ```json
  {
    "ciphertext": "<hex>",
    "iv": "<hex>",
    "tag": "<hex>",
    "updatedAt": "2026-11-19T10:00:00.000Z"
  }
  ```

### 4.2 Multi-Tier Storage Persistence
To operate reliably in serverless environments, the vault queries three hierarchical tiers:

```text
               ┌─────────────────────────────────────────┐
               │         getUserVault(yvUserId)          │
               └────────────────────┬────────────────────┘
                                    │
                         1. Check In-Memory Cache
                                    │ (Hit) -> Return sub-ms
                                    v (Miss)
                     2. Query Vercel KV REST API
                        (KV_REST_API_URL / TOKEN)
                                    │ (Hit) -> Decrypt, memoize & return
                                    v (Miss)
                   3. Read Encrypted 'yai_vault' Cookie
                        (Carried in request headers)
                                    │ (Hit) -> Decrypt, sync to KV & return
                                    v (Miss)
                          Return empty vault
```

1. **Tier 1 (In-Memory Cache):** Ephemeral memoization during a single Lambda request.
2. **Tier 2 (Vercel KV REST API):** Serverless Redis store accessible across all Lambda instances worldwide. Uses native `fetch` over HTTPS (zero extra npm dependencies).
3. **Tier 3 (Host-Bound Encrypted Cookie `yai_vault`):** Zero-infrastructure fallback. The entire AES-GCM ciphertext payload is stored in a 30-day HttpOnly, Secure cookie. This allows full operation on Vercel even before external KV storage is provisioned.

### 4.3 Identity Isolation Guard
Every vault record is sealed with the user's canonical `yvUserId`. When decrypting, `decryptVaultData()` strictly asserts:
```typescript
if (vault.yvUserId !== expectedUserId) {
  console.warn(`[YAI Vault] Security: Vault user mismatch`);
  return null;
}
```
This guarantees cross-user isolation even if an encrypted cookie is transferred or tampered with.

---

## 5. Threat Model & Security Defenses

| Threat | Impact | Implemented Mitigation |
| :--- | :--- | :--- |
| **Path Traversal Attack** | Attacker accesses or overwrites files outside repository scope | `preventPathTraversal()` strictly blocks `..`, leading `/`, drive letters (`C:`), and UNC paths. |
| **XSS Token Theft** | Malicious script steals session or GitHub credentials | All tokens and session cookies use `HttpOnly`. Tokens never enter the DOM or client bundles. |
| **Cross-Site Request Forgery (CSRF)** | Attacker forces state mutations (e.g. sign out, repo creation) | `SameSite=Lax` on all cookies; origin and host validation headers verified in sensitive endpoints (`POST /api/auth/sign-out`). |
| **OAuth State Tampering** | Attacker intercepts or replays OAuth callbacks | High-entropy PKCE `code_verifier` and cryptographically random `state` verified before code exchange. |
| **Stale Overwrite / Race Conditions** | Concurrent writes overwrite newer conversational data | GitHub Contents API requires explicit current file SHA for all update and delete requests. |
| **Malicious Markdown / HTML Injection** | Attacker injects `<script>` or `javascript:` in chat content | `safe-markdown.ts` sanitizes rendered Markdown, stripping scripts, iframes, and dangerous handlers. |
| **Server-Side Token Exposure in Logs** | GitHub/Provider keys leak into Vercel log stream | Logging functions explicitly exclude token values; provider keys are masked (`maskKey()`) before UI exposure. |

---

## 6. Server-Only Module Boundaries

To prevent bundlers (Webpack / Turbopack) from inadvertently including server secrets in client JavaScript files, the following modules declare `import 'server-only'` at line 1:

- `src/lib/auth/session.ts`
- `src/lib/auth/yetvast-auth.ts`
- `src/lib/auth/github-storage-auth.ts`
- `src/lib/github/api-client.ts`
- `src/lib/storage/personal-intelligence-storage.ts`
- `src/lib/storage/credential-vault.ts`
- `src/lib/storage/path-utils.ts`
- `src/lib/storage/conversation-markdown.ts`
- `src/lib/providers/index.ts`
- `src/lib/providers/openrouter.ts`
- `src/lib/providers/google-ai.ts`
- `src/lib/providers/key-store.ts`

Any attempt to import these files into a client component (`'use client'`) causes an immediate compile-time build error.
