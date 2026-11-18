# YAI Studio — Authentication and GitHub Access

## 1. Two independent authorization concerns

YAI has two separate gates:

1. **Yet Vast identity authentication:** establishes the user identity/session through the central Yet Vast Auth service.
2. **GitHub storage authorization:** grants YAI permission to discover, create and read/write the user's private data repository.

A successful GitHub sign-in does not automatically prove that YAI has the repository permissions needed for private repository CRUD. A linked GitHub identity in Yet Vast Auth is not necessarily a GitHub API access token or GitHub App installation grant.

## 2. Central Auth policy constraint

The supplied 16 November 2026 Yet Vast Auth documents describe:
- Google as the default persistent Yet Vast identity provider;
- explicit GitHub linking to an existing persistent identity;
- optional GitHub-only ephemeral access only when the app registration explicitly allows it;
- ephemeral GitHub-only access does not automatically create a permanent Yet Vast identity;
- the two registration policies — Google persistent identity and anonymous/ephemeral GitHub-only service access — are mutually exclusive in the documented registration model.

The YAI owner requests GitHub-required storage, optional Google identity and optional anonymous access. The actual approved YAI registration policy must be confirmed with Yet Vast Auth Admins before production authentication is enabled.

Do not silently configure incompatible provider policies. Do not build a parallel Firebase Auth identity system. Do not automatically merge identities by matching email addresses.

## 3. Required target user journey

- User chooses a supported sign-in route offered by the approved YAI registration.
- Yet Vast Auth performs its OAuth 2.0 Authorization Code + PKCE flow.
- YAI server validates the returned assertion using the official SDK and central JWKS.
- YAI creates its own host-bound, HTTP-only session.
- YAI requires a GitHub storage authorization before opening Personal Intelligence data.
- If GitHub repository permissions are missing, show a dedicated connect/reauthorize state.
- After GitHub authorization, check the authenticated GitHub account for the exact repository name `YVSApps_Data_YaiStudio`.
- If absent, explain and offer an explicit private repository creation action.
- If present, verify it belongs to the authenticated GitHub account and is private, then validate access.
- The UI must show the connected GitHub account and exact repository selected.

## 4. Auth SDK integration

Use the currently published official `@yetvast/auth` package and its actual current exports/types. The supplied Yet Vast consumer documentation contains server-side examples such as `createAppAuthorizeRedirect` and `exchangeCodeForAssertion`, but the coding agent must inspect the installed package version and verify current signatures.

Do not copy old application IDs, callback URLs, cookie names, origins, provider assumptions or environment variable names from VastAlliance, Home or another product.

The YAI application registration must be created/approved centrally. Record:
- stable logical application ID;
- active registration instance (if surfaced);
- approved production origin;
- exact callback URI(s);
- enabled providers and policy;
- whether ephemeral GitHub access is enabled;
- whether persistent identity is required.

## 5. GitHub repository authorization

Before implementing, inspect the current GitHub OAuth/App authorization options and the existing Cogmit GitHub storage reference. Select the least-privileged supported approach.

Evaluate a GitHub App installation or fine-grained repository access for the exact repository, rather than requesting broad account access by default. If repository creation requires additional permission, explain it and request it only at the point of explicit repository creation.

The server must:
- retain GitHub access credentials server-side;
- encrypt credentials at rest using a suitable secret-storage mechanism;
- never return raw GitHub tokens to the browser;
- validate the GitHub account identity using GitHub's authoritative user endpoint;
- bind the grant to the Yet Vast/YAI session and verified GitHub account;
- scope access to the intended user's repository;
- handle revocation, expiration and reauthorization;
- prevent one user's session from accessing another user's repository.

If the chosen Auth flow cannot provide GitHub API credentials/scopes, implement a separate, explicit GitHub storage authorization step. Do not pretend identity linking is storage authorization.

## 6. Session security

- YAI owns its own host-bound session cookie.
- Use `HttpOnly`, `Secure` in production, `SameSite=Lax` (or stricter where compatible), `Path=/`, and no wildcard parent domain.
- Validate OAuth state and PKCE verifier.
- Validate callback origin/redirect URI against configured trusted origins.
- Protect mutation endpoints against CSRF using origin checks and suitable token strategy.
- Verify issuer, audience, expiry and signature of central assertions.
- Do not trust client-supplied user IDs, provider IDs, roles or repository owners.
- Sign-out clears YAI session; provider disconnect/revocation is a distinct explicit operation.

## 7. Build-time package access is not runtime user auth

Private `@yetvast/*` packages use GitHub Packages registry configuration and `NODE_AUTH_TOKEN` during build/CI. This token is not an end-user OAuth credential and must never be exposed through `NEXT_PUBLIC_*` variables.

Follow `YET_VAST_PRIVATE_PACKAGE_CONSUMPTION_STANDARD.md`.
