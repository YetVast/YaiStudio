# YAI Studio — Agent Development Rules

You are implementing YAI Studio, a Yet Vast Solutions product. Read this file and every applicable document in `docs/` before implementation.

## Required workflow

**Inspect → Search → Reuse → Plan → Implement → Verify → Report**

1. Inspect the existing repository, current branch, uncommitted changes, package manifests, source structure, environment examples and tests.
2. Read the product requirements, architecture, authentication, data, security and implementation documents.
3. Inspect the current published `@yetvast/auth` SDK exports, types, package version and official integration contract. Do not copy another app's implementation blindly.
4. Identify existing Yet Vast Auth integration and GitHub repository CRUD patterns that can be reused. Do not assume a connected GitHub identity grants repository-content permissions.
5. Produce a concise implementation plan and identify unresolved high-impact decisions.
6. Implement in coherent vertical slices.
7. Run actual typecheck, lint, tests and production build commands available in this repository. Do not invent successful test results.
8. Review the diff for secrets, unrelated refactoring, security boundary violations and documentation drift.
9. Report OBSERVED, DOCUMENTED, TESTED, INFERRED, PLANNED and UNKNOWN facts separately.

## Binding rules

- Preserve the current repository's valid work. Do not overwrite or reset existing changes.
- Use Next.js App Router and TypeScript unless inspection establishes an existing approved alternative.
- Use CSS Modules only for component styling. Do not introduce Tailwind CSS, utility-first styling frameworks, or global ad-hoc styles.
- Use design tokens and the YVS visual language. Canonical brand colors: YVS Yellow `#FFFF11`, YVS Indigo-Violet `#4B0084`. Use semantic light/dark tokens; do not paint every component with brand colors.
- Use Inter and JetBrains Mono; Lucide icons.
- Keep server-only code, credentials and privileged operations out of client bundles.
- Enforce authorization and ownership on the server for every protected operation.
- Authentication proves identity; GitHub storage authorization grants access to the user's repository. They are not interchangeable.
- Never trust a user ID, GitHub username, repository name, role, permission or path supplied by the browser without server-side verification.
- Do not store personal intelligence in a YAI-owned central database. The user's private GitHub repository is the initial source of truth.
- Do not store secrets, API keys, OAuth tokens or credentials in the user's data repository.
- Do not treat every prompt as a permanent memory. Separate activity, candidate memory and accepted memory.
- Read operations must not silently create, repair, migrate, delete or write data.
- Repository creation must be an explicit user action with a confirmation step. If the required repository is missing, show a clear setup state; do not silently create a differently named repository.
- Use one authoritative source of truth for message content. If Markdown transcripts are generated from structured messages, document and enforce that direction.
- Do not mechanically copy Cogmit's `RootCog`, `NPPCogs`, `cogsIndex.json`, 57-day deletion policy or Cog-specific schema.
- Do not build LiteRT-LM execution in v0. Keep interfaces extensible for v1 without speculative abstractions.
- Do not introduce a database, vector database, queue, microservice, event bus or always-on inference server without a demonstrated requirement and explicit approval.
- Do not make production Auth registration, redirect URI, provider-policy or permission assumptions. Record required central configuration and stop before changing central Auth.
- Keep package-install authentication (`NODE_AUTH_TOKEN`) separate from runtime user authentication.
- Never claim a feature or check is complete unless verified.

## Stop and ask before

- Changing the Yet Vast Auth central provider policy or application registration.
- Choosing a different persistence authority or creating a central user-data database.
- Broadening GitHub scopes or creating an app installation with permissions beyond the approved minimum.
- Introducing billing, payments, public sharing or multi-user access to private intelligence.
- Implementing permanent deletion/history rewriting.
- Adding local inference or a PWA-specific runtime in v0.
- Making destructive repository changes or migrations.

## Completion report

State:
- files and behavior changed;
- tests/checks actually executed and their results;
- manual flows verified;
- checks not run;
- environment/central-registration steps still required;
- security and data-integrity risks remaining.
