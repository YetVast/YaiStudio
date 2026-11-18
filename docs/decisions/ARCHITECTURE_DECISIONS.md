# YAI Studio — Architecture Decisions and Open Gates

## Established product direction

1. YAI Studio is the central Personal Intelligence platform and management interface.
2. YVS products integrate with YAI through APIs and shared client contracts.
3. YAI Studio UI is not required to remain open for other products to use YAI API.
4. Both cloud execution and future local LiteRT-LM execution are intended.
5. Cloud provider credentials are configured in YAI and kept server-side.
6. GitHub is the initial user-owned source of truth for Personal Intelligence.
7. Users should be able to clone and inspect their data repository.
8. Activity history, memory candidates and accepted memories are separate data classes.
9. YAI should have an Intelligence Activity Ledger.
10. V0 is the full web application; v1 adds PWA/local LiteRT-LM.

## Product-owner requirements added for this initialization

1. GitHub authorization is mandatory for Personal Intelligence storage.
2. Google identity is optional, subject to Yet Vast Auth policy.
3. Anonymous/ephemeral access is optional and must be explicitly enabled centrally.
4. Data repository name is exactly `YVSApps_Data_YaiStudio`.
5. If missing, show an explicit create-repository prompt.
6. Workspace/project hierarchy should support nested levels, taking structural inspiration from Cogmit.
7. YVS color theme must be followed.
8. CSS Modules only.

## Recommended implementation decisions

- Use `messages.json` as canonical structured conversation content; generate `conversation.md` as a readable projection.
- Use a flat global `conversationsIndex.json` for discovery; filesystem paths represent nested workspace hierarchy.
- Use immutable partitioned Activity Ledger event files.
- Require user approval before converting memory candidates into persistent memories in v0.
- Use GitHub storage behind an adapter.
- Use server-side provider key storage; do not use GitHub data repo as a secret store.
- Prefer least-privileged repository-scoped GitHub authorization.

## Open gates — must be verified, not guessed

### Auth policy
The supplied current Yet Vast Auth documentation describes Google persistent identity and anonymous GitHub-only access as mutually exclusive application registration policies. The requested YAI experience needs a clear approved combination. Confirm with Auth Admin whether:
- YAI can offer GitHub-only ephemeral sign-in and Google as an optional linked provider;
- YAI instead requires Google persistent identity and then mandates GitHub storage authorization;
- a newer Auth release/policy supports the desired combination.

Do not implement a conflicting flow or modify central Auth without approval.

### GitHub storage authorization
Confirm whether the official Yet Vast Auth GitHub flow exposes an API authorization grant with the exact repository permissions needed. If not, implement a separate GitHub App/fine-grained authorization flow. A linked GitHub identity alone is insufficient evidence of repository CRUD permission.

### Repository creation permission
Confirm the minimum permission required to create a private repository in the user's account. Request broader scope only for this explicit operation and explain the permission.

### Provider key persistence
Confirm an approved secure server-side secret store for BYOK credentials. Do not store keys in plaintext in GitHub, Firestore, localStorage or browser cookies.

### Product origin and registration
Confirm production origin, exact OAuth callback URI, stable logical app ID, active registration instance and provider policy from Yet Vast Auth Admin.

### Message persistence and commits
Confirm the initial GitHub commit granularity and batching strategy. The recommended default is to persist a completed user/assistant turn as one logical operation, not every streamed token.

## Explicitly not decided

- Permanent Git-history purge implementation.
- Database migration threshold.
- Vector database/embedding implementation.
- Cross-origin shared model cache.
- Native mobile applications.
- Public YAI instance.
- Automatic acceptance of memory candidates.
- Exact final JSON schema beyond the initial contracts documented in the data-model file.
