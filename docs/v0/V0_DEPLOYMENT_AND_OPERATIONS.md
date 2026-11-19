# YAI Studio V0 — Deployment & Operations Guide

**Platform:** Vercel Serverless Platform  
**Node.js Runtime:** Node.js 20.x / 22.x  
**Next.js Version:** 15.5.29  
**Configuration Reference:** [`.env.example`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/.env.example)  

---

## 1. Vercel Deployment Architecture

YAI Studio is designed as a cloud-native Next.js application optimized for deployment on Vercel:

```text
 ┌────────────────────────────────────────────────────────┐
 │                      VERCEL EDGE                       │
 │  - Edge Network (Global CDN / Anycast)                 │
 │  - Edge Middleware (src/middleware.ts: 34.6 kB)        │
 │    Checks 'yai_session' cookie & redirects             │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            v
 ┌────────────────────────────────────────────────────────┐
 │               VERCEL SERVERLESS FUNCTIONS              │
 │  - Dynamic Route Handlers (src/app/api/*)              │
 │  - Dynamic Pages (/sign-in)                            │
 │  - Pre-rendered Static Pages (13 routes)               │
 └─────────────┬────────────────────────────┬─────────────┘
               │                            │
               v                            v
 ┌──────────────────────────┐  ┌──────────────────────────┐
 │    VERCEL KV REST API    │  │     GITHUB REST API      │
 │  Upstash Redis REST via  │  │ User private repository  │
 │  HTTPS (zero extra npm)  │  │  YVSApps_Data_YaiStudio  │
 └──────────────────────────┘  └──────────────────────────┘
```

### 1.1 Edge Middleware Execution
- File: `src/middleware.ts`
- Size: `34.6 kB`
- Matches: All application routes except static assets (`/_next/static`, `/_next/image`, `/favicon.ico`).
- Functionality: Reads `yai_session` cookie. If missing on protected routes, returns `401 Unauthorized` for `/api/*` or `307 Redirect` to `/sign-in` for pages.

### 1.2 Serverless Function Characteristics
- Execution Environment: Node.js Serverless runtime (Region: Washington D.C., `iad1` recommended for proximity to GitHub APIs).
- Max Duration: Default Vercel timeout (Hobby: 10s/15s, Pro: up to 300s).
- Dependency Externalization: `jose` is externalized in `next.config.ts` via `serverExternalPackages: ['jose']` to ensure fast cold starts and zero bundling warnings.

---

## 2. Environment Variables Matrix

All configuration is provided via environment variables. The following table provides an exhaustive audit of all variables:

| Variable Name | Environment Tier | Scope | Required / Optional | Purpose & Behavior | Sample / Format |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_YAI_ORIGIN` | Client & Server | Runtime | **Required** in Prod | Canonical application origin used for OAuth redirect derivation and OpenRouter `HTTP-Referer`. | `https://yaistudio.yetvast.com` |
| `NEXT_PUBLIC_APP_URL` | Client & Server | Runtime | Optional | Fallback alias for `NEXT_PUBLIC_YAI_ORIGIN`. | `https://yaistudio.yetvast.com` |
| `YETVAST_AUTH_ORIGIN` | Server | Runtime | **Required** in Prod | Canonical origin of central Yet Vast Auth identity server. | `https://auth.yetvast.com` |
| `YETVAST_AUTH_URL` | Server | Runtime | Optional | Fallback alias for `YETVAST_AUTH_ORIGIN`. | `https://auth.yetvast.com` |
| `YAI_SESSION_SECRET` | Server | Runtime | **Required** | Secret key for signing host-bound HS256 JWT session cookie (`yai_session`). | Minimum 32 characters base64 string. |
| `YAI_CREDENTIAL_ENCRYPTION_KEY` | Server | Runtime | **Required** in Prod | 256-bit AES-GCM key used to encrypt GitHub tokens and BYOK AI provider keys at rest. | 32-byte base64 string. |
| `CREDENTIAL_ENCRYPTION_SECRET` | Server | Runtime | Optional | Fallback alias for `YAI_CREDENTIAL_ENCRYPTION_KEY`. | 32-byte base64 string. |
| `GITHUB_CLIENT_ID` | Server | Runtime | **Required** for Storage | Client ID of the GitHub OAuth App with `repo` scope. | GitHub Client ID (e.g. `Iv1...`) |
| `GITHUB_CLIENT_SECRET` | Server | Runtime | **Required** for Storage | Client Secret of the GitHub OAuth App. | GitHub Client Secret. |
| `YAI_GITHUB_CLIENT_ID` | Server | Runtime | Optional | Explicit prefix alias for `GITHUB_CLIENT_ID`. | GitHub Client ID. |
| `YAI_GITHUB_CLIENT_SECRET` | Server | Runtime | Optional | Explicit prefix alias for `GITHUB_CLIENT_SECRET`. | GitHub Client Secret. |
| `YAI_GITHUB_CALLBACK_URI` | Server | Runtime | Optional | Explicit override for GitHub OAuth callback URL (defaults to `${origin}/api/auth/github/callback`). | `https://yaistudio.yetvast.com/api/auth/github/callback` |
| `KV_REST_API_URL` | Server | Runtime | Optional | REST endpoint URL for Vercel KV / Upstash Redis persistent vault. | `https://...-kv.upstash.io` |
| `KV_REST_API_TOKEN` | Server | Runtime | Optional | Authentication Bearer token for Vercel KV REST API. | Upstash Redis Bearer token. |
| `UPSTASH_REDIS_REST_URL` | Server | Runtime | Optional | Alias for `KV_REST_API_URL`. | `https://...-kv.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Runtime | Optional | Alias for `KV_REST_API_TOKEN`. | Upstash Redis Bearer token. |
| `NODE_AUTH_TOKEN` | Build System | **Build-Time Only** | **Required** in CI/Build | Personal access token with `read:packages` scope to install private `@yetvast/*` packages from GitHub Packages. | `ghp_...` |

---

## 3. GitHub Packages & Build Configuration

YAI Studio consumes the private `@yetvast/auth` package from GitHub Packages (`https://npm.pkg.github.com`).

### 3.1 `.npmrc` Specification
The repository root contains [`.npmrc`](file:///c:/Users/yviyv/yvscodes/YetVastSolutions/YaiStudio/.npmrc):
```properties
@yetvast:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

### 3.2 Vercel Build Setup
In Vercel Project Settings > Environment Variables:
1. Add `NODE_AUTH_TOKEN` as a **Build-time** variable.
2. Ensure the GitHub token possesses the `read:packages` permission under the Yet Vast Solutions organization.
3. This token is used exclusively during `npm install` and is never included in the application bundle or runtime environment.

---

## 4. Operational Procedures & Runbooks

### 4.1 Deployment Runbook (Vercel)
1. Verify git working tree is clean: `git status`.
2. Execute local production verification:
   ```bash
   npm.cmd run typecheck
   npm.cmd run test
   npm.cmd run build
   ```
3. Push to `main` branch: `git push origin main`.
4. Vercel automatically detects the commit, runs `npm install` (using `NODE_AUTH_TOKEN`), and executes `next build`.
5. Post-deployment verification:
   - Load `/sign-in` in an incognito window.
   - Click "Sign in with Yet Vast Auth" and verify redirect to `https://auth.yetvast.com`.
   - Check that application ID `yaistudio-yetvast-com-4dfnb2r9` appears in the authorize URL query string.

### 4.2 Key Rotation Procedures

#### Rotating Session Secret (`YAI_SESSION_SECRET`):
- Impact: Invalidate all existing active user sessions. Users will be redirected to `/sign-in`.
- Procedure:
  1. Generate new 32-character key: `openssl rand -base64 32`.
  2. Update `YAI_SESSION_SECRET` in Vercel Project Settings.
  3. Redeploy application without build cache.

#### Rotating Credential Encryption Key (`YAI_CREDENTIAL_ENCRYPTION_KEY`):
- Impact: Stored credentials in Tier 1 (KV) and Tier 2 (Cookies) encrypted with the old key cannot be decrypted. Users will need to re-authorize GitHub storage and re-enter provider keys.
- Procedure:
  1. Generate new 32-byte key: `openssl rand -base64 32`.
  2. Update `YAI_CREDENTIAL_ENCRYPTION_KEY` in Vercel.
  3. Flush KV cache keys (`DEL yai:vault:*`) if necessary.
  4. Redeploy. Users re-authorize on their next visit.

---

## 5. Reliability, Rate Limits & Fault Tolerance

1. **GitHub API Rate Limits:**
   - Authenticated GitHub users receive 5,000 requests per hour.
   - Normal conversational usage consumes 2–4 requests per turn.
   - `throwIfError()` detects `403` and `429` responses and raises typed `RateLimitError` with optional `retryAfter` metadata.
2. **Cold Starts:**
   - Pre-rendered static pages (13 routes) serve instantly from the Vercel Edge Cache.
   - Serverless functions have minimal initialization overhead (~150ms) due to zero heavy ORMs and zero large bundle dependencies.
3. **Disaster Recovery:**
   - Because all personal intelligence data resides in the user's private GitHub repository, YAI Studio server infrastructure is completely stateless.
   - A catastrophic failure or deletion of the Vercel deployment causes **zero data loss**; redeploying the code against the same configuration immediately reconnects to existing user repositories.
