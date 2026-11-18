# YAI Studio — Security and Privacy

## 1. Trust boundaries

Treat browser input, OAuth callbacks, GitHub API responses, model output and product API requests as untrusted.

Trusted authorities:
- Yet Vast Auth for central identity assertions and application approval;
- GitHub for repository ownership and repository content access;
- YAI server for YAI-specific authorization and business rules;
- configured model provider for inference response only, not authorization.

## 2. Data confidentiality

Personal Intelligence may contain highly sensitive personal information. Therefore:
- data repository must be private;
- GitHub tokens and provider API keys must never be stored in that repository;
- credentials must remain server-side and be encrypted at rest;
- do not log full prompts, answers, memory contents or tokens by default;
- provide user-configurable activity retention;
- explain that private GitHub visibility is not equivalent to end-to-end encryption;
- explain that Git history and existing clones can retain deleted content.

## 3. Authorization

For every protected operation:
- verify YAI session server-side;
- bind session to the authenticated Yet Vast identity and verified GitHub account;
- validate repository owner against the connected account;
- verify the exact repository and private visibility;
- check operation-specific permission;
- validate all paths and prevent path traversal;
- reject cross-user resource access;
- do not rely on UI hiding or client-provided IDs.

## 4. GitHub token handling

- Store access/refresh credentials only in server-controlled secure storage.
- Use least privilege.
- Prefer repository-scoped GitHub App/fine-grained access where feasible.
- Separate repository discovery, repository creation and repository content permissions.
- Do not request organization-wide or all-repository access without a demonstrated need.
- Handle revoked/expired grants.
- Never return raw credentials to client code.
- Redact tokens from errors, logs and telemetry.

## 5. Provider key handling

OpenRouter and Google AI Studio credentials are secrets:
- submit over HTTPS;
- store only in an approved server-side encrypted secret store;
- never put them in `NEXT_PUBLIC_*`;
- never commit them;
- never write them to the user's GitHub data repository;
- mask them in UI after save;
- support replacement and deletion;
- never return the raw stored key to the browser.

If secure server-side persistence is not available in the chosen free-tier architecture, document the limitation and ask for an approved storage solution. Do not downgrade to plaintext storage.

## 6. OAuth/session security

- Authorization Code + PKCE S256.
- One-time state validation.
- Exact callback URI and trusted origin validation.
- Verify assertion issuer, audience, signature and expiration.
- Host-bound HTTP-only session cookie; Secure in production; SameSite=Lax or stricter; Path=/; no wildcard domain.
- CSRF protection for mutations.
- Rate-limit sensitive endpoints.
- Fail closed when central Auth application status or provider policy disallows access.

## 7. AI safety and data integrity

- Model output is untrusted content.
- Never allow model output to authorize actions, change roles, select another user's repository or execute code.
- Validate structured model output against schemas.
- Memory candidates require review by default.
- Do not silently overwrite conflicting memory.
- Preserve provenance for memory changes.
- Do not claim data is saved until GitHub confirms the commit.
- Handle partial writes and SHA conflicts explicitly.

## 8. Privacy controls and user disclosures

Explain:
- what data is stored in GitHub;
- which repository and account own it;
- what YAI server can read;
- what cloud AI provider receives during cloud inference;
- what local inference in a future version would keep on-device;
- what is retained in Activity Ledger;
- how archive/current deletion differs from Git history purge;
- how to revoke GitHub access and provider credentials.
