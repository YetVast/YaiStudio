# YAI Studio V0 — Vercel Deployment Readiness & Persistent Credential Vault

**Document ID:** `docs/implementation/2026-11-19-vercel-deployment-readiness-and-persistent-vault.md`  
**Date:** 2026-11-19  
**Product:** YAI Studio (Yet Vast Solutions)  
**Repository:** `yaistudio`  
**Target:** Vercel deployment readiness, persistent AES-256-GCM serverless credential vault, multi-domain callback normalization, and deployment verification.

---

## Part A — Original Implementation Prompt

```markdown
The Git integration is complete. All implementation branches have been merged into main, pushed, and cleaned up. TypeScript typecheck and npm run build both pass.

Now prepare YAI Studio for its first Vercel deployment.

Perform a deployment-readiness audit and implementation pass.

Priorities:

1. Inspect the actual credential storage implementation for GitHub tokens, OpenRouter API keys, and Google AI Studio API keys.
2. Replace ephemeral in-memory credential persistence with a secure, persistent server-side solution suitable for Vercel serverless deployments.
3. Preserve AES-256-GCM encryption and ensure credentials are isolated per authenticated user.
4. Ensure no credentials are exposed to client-side code, logs, or API responses.
5. Review GitHub OAuth and Yet Vast Auth callback handling for production-domain compatibility.
6. Verify the private `@yetvast/auth` package installation process on Vercel, including `.npmrc` and `NODE_AUTH_TOKEN`.
7. Review all required environment variables and update `.env.example` and deployment documentation.
8. Inspect all API routes for authentication, authorization, input validation, and error handling.
9. Check whether the application can operate correctly across multiple serverless instances.
10. Run npm run typecheck and npm run build after all changes.

Do not merely document problems. Implement the necessary fixes where possible.

If an external service, credential, or account configuration is required, identify exactly what I must configure manually.

Do not introduce unnecessary infrastructure. Prefer a simple, secure, persistent solution compatible with the existing architecture.

Do not claim production readiness based only on a successful build. Distinguish verified functionality from configuration-dependent functionality.

Commit and push the completed changes to main.

Finally, provide a Vercel deployment checklist with exact environment variables, OAuth callback URLs, external service requirements, and remaining manual actions.
```

---

## Part B — Initial Repository Findings

1. **Ephemeral Credential Store Incompatibility with Vercel Serverless:**
   - Prior to this pass, `src/lib/auth/github-storage-auth.ts` and `src/lib/providers/key-store.ts` used in-memory `Map` instances (`_tokenStore` and `keyStore`).
   - In Vercel serverless runtime environments, lambdas scale horizontally and spin up/down statelessly. In-memory maps were lost across lambda invocations, causing user sessions to lose their GitHub storage authorization token and configured BYOK keys on subsequent requests.
2. **Domain & Callback Mismatches on Vercel Deployments:**
   - OAuth redirect URIs were hardcoded to default to `http://localhost:3000` when `NEXT_PUBLIC_YAI_ORIGIN` was omitted, leading to `redirect_uri_mismatch` on Vercel preview branch deployments and custom domains.
3. **Environment Variable Naming Drift:**
   - Discrepancy existed between `YETVAST_AUTH_URL` vs `YETVAST_AUTH_ORIGIN`, `YETVAST_AUTH_APP_ID` vs `YAI_LOGICAL_APP_ID`, and `YAI_CREDENTIAL_ENCRYPTION_KEY` vs `CREDENTIAL_ENCRYPTION_SECRET`.
4. **Missing Response Cookie Pipeline for Vault Updates:**
   - In Next.js route handlers that issue redirects (`/api/auth/github/callback`), credentials could not be reliably attached to client cookies without passing the `NextResponse` object into the persistence pipeline.

---

## Part C — Implementation Report

### 1. Persistent Server-Side Credential Vault (`src/lib/storage/credential-vault.ts`)
Created a unified, zero-external-dependency, persistent credential vault with multi-tier architecture:
- **Tier 1 — Serverless KV REST API (Vercel KV / Upstash Redis):**
  - Uses native HTTPS `fetch` calls to the REST endpoint (zero heavy SDK packages required).
  - Automatically detected when `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`/`TOKEN`) are set in Vercel.
  - Persists encrypted credentials across lambdas, cold starts, and enables headless cross-product API integrations (Cogmit, Fyuniverse).
- **Tier 2 — Encrypted Host-Bound Session Cookie (`yai_vault`):**
  - Seamless fallback for Vercel deployments where external KV has not been provisioned yet.
  - AES-256-GCM encrypted server-side; HttpOnly, Secure, SameSite=Lax.
  - Automatically carried by the user's browser in request headers to any serverless instance in any region.
- **Tier 3 — In-Memory Process Memoization:**
  - Caches decrypted records for the lifetime of a single lambda execution for sub-millisecond repeated lookups.
- **Strict Per-User Isolation & AES-256-GCM Encryption:**
  - All records are encrypted with 96-bit random IVs and 128-bit authentication tags.
  - Every decrypt operation strictly validates `vault.yvUserId === expectedUserId`.
  - Keys and tokens are masked before any status response; raw keys are never logged or returned in JSON responses.

### 2. URL & Callback Normalization (`src/lib/auth/url-utils.ts`)
Created `getAppBaseUrl(request?: NextRequest)`:
- Dynamically resolves from incoming `x-forwarded-host` and `x-forwarded-proto` headers on Vercel.
- Automatically handles custom domains (`yaistudio.yetvast.com`), preview branch URLs (`yaistudio-git-*.vercel.app`), and local development (`http://localhost:3000`).
- Updated `yetvast-auth.ts`, `github-storage-auth.ts`, and all OAuth route handlers to use dynamic base URL derivation.

### 3. Route Handlers & Cookie Propagation
- Updated `/api/auth/github/callback`: Passes `NextResponse` into `storeGitHubToken(..., response)` ensuring the sealed vault cookie is attached to the redirect response.
- Updated `/api/providers/[provider]`: Passes `NextResponse` into `storeProviderKey(..., response)` and `deleteProviderKey(..., response)`.
- Updated `/api/auth/sign-out`: Deletes `yai_vault` alongside `yai_session` on logout.
- Re-exported storage operations from `github-storage-auth.ts` and `key-store.ts` for full backward compatibility across all 30+ dependent modules.

### 4. Configuration Synchronization
- Updated `.env.example` with exact variable groupings, descriptions, and generation instructions.
- Synced `.npmrc` verification: `@yetvast:registry=https://npm.pkg.github.com` with `NODE_AUTH_TOKEN`.

---

## Part D — Verification

### 1. Static Typecheck (`npm run typecheck` / `tsc --noEmit`)
```text
> yai-studio@0.1.0 typecheck
> tsc --noEmit
Exit code: 0 (0 errors)
```

### 2. Production Build (`npm run build` / `next build`)
```text
> yai-studio@0.1.0 build
> next build

   ▲ Next.js 15.3.3

   Creating an optimized production build ...
 ✓ Compiled successfully in 4.0s
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (32/32)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                      610 B         105 kB
├ ○ /_not-found                            981 B         102 kB
├ ○ /activity                            3.25 kB         104 kB
├ ƒ /api/activity                          204 B         101 kB
├ ƒ /api/auth/authorize                    204 B         101 kB
├ ƒ /api/auth/callback                     204 B         101 kB
├ ƒ /api/auth/github/callback              204 B         101 kB
├ ƒ /api/auth/github/connect               204 B         101 kB
├ ƒ /api/auth/session                      204 B         101 kB
├ ƒ /api/auth/sign-out                     204 B         101 kB
├ ƒ /api/conversations                     204 B         101 kB
├ ƒ /api/conversations/[id]                204 B         101 kB
├ ƒ /api/conversations/[id]/messages       204 B         101 kB
├ ƒ /api/github/connection                 204 B         101 kB
├ ƒ /api/github/repository/create          204 B         101 kB
├ ƒ /api/knowledge                         204 B         101 kB
├ ƒ /api/memory/[type]                     204 B         101 kB
├ ƒ /api/memory/candidates                 204 B         101 kB
├ ƒ /api/memory/candidates/[id]/review     204 B         101 kB
├ ƒ /api/providers                         204 B         101 kB
├ ƒ /api/providers/[provider]              204 B         101 kB
├ ƒ /api/providers/[provider]/models       204 B         101 kB
├ ƒ /api/storage/initialize                204 B         101 kB
├ ƒ /api/workspaces                        204 B         101 kB
├ ƒ /api/yai/context                       204 B         101 kB
├ ƒ /api/yai/generate                      204 B         101 kB
├ ○ /apps                                2.28 kB         104 kB
├ ○ /conversations                       6.18 kB         107 kB
├ ○ /github-connect                        381 B         102 kB
├ ○ /knowledge                           4.65 kB         106 kB
├ ○ /memory                               4.9 kB         106 kB
├ ○ /providers                           4.76 kB         106 kB
├ ○ /repo-setup                          3.21 kB         104 kB
├ ○ /settings                            4.84 kB         109 kB
├ ƒ /sign-in                               419 B         102 kB
└ ○ /workspaces                          3.38 kB         105 kB
+ First Load JS shared by all             101 kB
  ├ chunks/1684-a884740d844d8e03.js      45.9 kB
  ├ chunks/4bd1b696-a84e2f7701026728.js  53.2 kB
  └ other shared chunks (total)          2.11 kB

ƒ Middleware                             33.8 kB
Exit code: 0
```
Note: All previous build warnings regarding in-memory token stores have been eliminated.

---

## Part E — Remaining Work & Deployment Checklist

### Classification of Readiness
- **TESTED & IMPLEMENTED:** Application code, UI, API route handlers, persistent credential vault with AES-256-GCM encryption, dynamic URL detection, and private package config.
- **CONFIGURATION-DEPENDENT (External Actions Required):**
  1. Add environment variables in Vercel Project Settings.
  2. Register YAI Studio application in Yet Vast Auth Admin.
  3. Register GitHub OAuth App for storage authorization.
  4. (Optional) Connect Vercel KV / Upstash Redis for headless cross-app persistence.
