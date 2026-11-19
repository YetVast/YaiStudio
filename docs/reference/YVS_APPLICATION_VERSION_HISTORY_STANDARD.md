# Yet Vast Solutions — Application Version History Standard

**Document type:** Cross-application engineering standard  
**Applies to:** Every independently deployable application under the Yet Vast Solutions umbrella  
**Initial implementation target:** YAI Studio  
**Status:** Proposed standard for implementation  
**Prepared:** 19 November 2026

---

## 1. Purpose

Every Yet Vast Solutions application must expose a public, read-only `/versions` page. Anyone should be able to inspect the application's complete version history, from the latest commit to the oldest tracked commit, and understand what changed in every version.

This is also the developer's durable engineering journal. It must make it easy to answer:

- What changed in this application?
- Which commit introduced the change?
- Why was the change made?
- Which files or subsystems were affected?
- Was it a feature, fix, refactor, security change, documentation change, or another type of work?
- What was the state of the application at a particular version?

The implementation must be based on actual Git history. It must not invent release notes or imply that unverified work was completed.

## 2. Version-numbering rule

Use the two-part version format:

`vX.Y`

- `X` = major version. Only the application developer/product owner may intentionally change it.
- `Y` = commit sequence within that major version. It increments by exactly one for every included Git commit, regardless of the size or type of change.
- Bug fixes, typo corrections, dependency updates, refactors, documentation-only commits, and feature work all receive a new `Y`.
- Do not use conventional semantic-versioning patch semantics. Do not use a third numeric component.
- Do not automatically infer a major release from the size, risk, or category of a change.
- A major-version change is an explicit developer decision. When the developer directs a major bump, the next commit begins the new major series at `vX.1`.

Examples:

| Commit sequence | Version |
|---|---|
| First tracked baseline commit | `v0.1` |
| Next commit, even if a one-line bug fix | `v0.2` |
| Next commit, even if documentation-only | `v0.3` |
| Next commit | `v0.4` |
| Developer explicitly authorizes major 1 | `v1.1` |
| Next commit | `v1.2` |

The version is an application-history identifier, not an npm package version. Do not change dependency versions or package.json versions merely to implement this standard.

## 3. What counts as a commit

Every commit in the application's designated version-history lineage must receive one version number. This includes:

- Feature commits
- Bug-fix commits
- Refactoring commits
- Styling/UI commits
- Dependency and configuration commits
- Documentation commits
- Test commits
- Revert commits
- Merge commits, if they are part of the selected history policy

The implementation must define and document one deterministic Git-history policy. Recommended default: track commits reachable from the application's primary branch (`main`), using the repository's actual commit graph and a clearly identified initial baseline. Do not silently mix unrelated branches into the public release sequence. If the project elects to include all commits from merged branches, document how the sequence is ordered and ensure it remains deterministic.

A commit must never be silently omitted because its change is small.

## 4. Initial YAI Studio baseline

The current documented YAI Studio V0 baseline is:

- Baseline commit: `d4cabeb`
- Commit subject: `UI Consistency, Navigation & Mobile UX Improvements`
- Branch: `main`
- Baseline date: 19 November 2026
- Existing descriptive release tag in project documentation: `v0.1.0-baseline`

For this new application-history convention, map that baseline commit to **`v0.1`**. Treat the old `v0.1.0-baseline` label as a historical tag/documentation artifact; do not use its three-part format for the new `/versions` sequence.

The next commit after the baseline in the selected history lineage must be `v0.2`, then `v0.3`, and so on. Before implementation, inspect the actual repository and confirm that `d4cabeb` exists and is an ancestor of the current primary branch. If it is not, do not fabricate the mapping: identify the correct baseline with the developer.

## 5. Source of truth and data-generation design

Git is the authoritative source for commit identity and metadata. The application must not depend on a developer manually copying commit hashes, dates, authors, or changed-file lists into a separate hand-maintained catalogue.

Implement a deterministic version-history generator that reads the selected Git history and produces a serializable version manifest for the application.

The manifest should include, at minimum, the following fields for every commit:

```ts
type ApplicationVersionEntry = {
  version: string;                 // e.g. "v0.2"
  major: number;
  sequence: number;                // Y within the major
  commitHash: string;              // full SHA
  shortCommitHash: string;
  subject: string;                 // commit subject
  description: string;             // commit body / release-note detail
  authorName: string;
  authorEmail?: string;            // expose only if approved; otherwise omit
  authoredAt: string;              // ISO-8601
  committedAt: string;             // ISO-8601
  branch?: string;                 // only if reliably known
  changeType: string[];            // feature, fix, refactor, docs, test, chore, security, etc.
  changedFiles: string[];
  filesChanged: number;
  insertions?: number;
  deletions?: number;
  isBaseline?: boolean;
  isMajorVersionStart?: boolean;
  tags?: string[];
};
```

The exact schema may be improved to fit the repository, but the fields above describe the intended information architecture.

### 5.1 Commit descriptions

The commit subject and body are the human-authored explanation of the change. The `/versions` page must display the commit subject and full useful description.

Every commit should have:

1. A concise subject describing the change.
2. A meaningful body explaining what changed and why.
3. Important implementation details, affected flows or subsystems, and relevant testing/verification.
4. Any known limitation or follow-up work, where applicable.

Do not generate fabricated descriptions from file names alone. If a historical commit has no body, show its actual subject and a clear neutral fallback such as “No extended description was recorded for this commit.” Do not pretend an AI-generated guess is the original commit description.

The implementation prompt should instruct the coding agent to use the available repository history and current diff to prepare accurate commit descriptions for new commits. For future commits, the developer or coding agent must provide a detailed commit body before committing.

### 5.2 Major-version control

Major version changes must be explicit and auditable. Implement a small tracked major-version control mechanism, or another deterministic mechanism that survives deployment and can reconstruct historical major boundaries.

Requirements:

- Initial major is `0`.
- Normal commits preserve the current major and increment `Y`.
- Only an explicit developer instruction may change the major.
- A major bump starts the new major at `vX.1`.
- The commit that records the authorized major change is the first commit in the new major series.
- The generator must be able to reconstruct which commits belong to which major after a clean clone and during a production build.
- Never infer a major bump from a commit message such as `feat!` unless the developer explicitly authorized it.
- Document the exact developer workflow for authorizing a major bump.

Avoid a self-referential design that tries to store a commit's own final SHA inside the same commit. Git commit hashes are derived from the commit contents; a commit cannot reliably contain its own final hash. Obtain the SHA from Git history at generation time.

## 6. Recommended repository structure

Adapt names to the existing YAI Studio conventions after inspecting the repository. A suggested structure is:

```text
YaiStudio/
├── versions/
│   ├── README.md                  # Versioning policy and developer workflow
│   └── major-version.json         # Explicit current major / major-boundary control
├── scripts/
│   └── generate-version-history.ts
├── src/
│   ├── app/
│   │   └── (public)/
│   │       └── versions/
│   │           ├── page.tsx       # Public /versions route
│   │           └── Versions.module.css
│   ├── components/
│   │   └── versions/              # Reusable version-history UI if appropriate
│   └── generated/
│       └── version-history.json   # Generated build artifact; do not hand-edit
└── package.json
```

This is a proposal, not a command to duplicate existing folders or violate the repository's architecture. Choose the correct route-group placement so `/versions` is public and is not redirected to sign-in.

The generated manifest should normally be created during the build (or another deterministic prebuild step) from Git history. Do not commit a generated manifest on every build unless the repository has a specific reason to do so. Do not make the build depend on a network API.

## 7. Public `/versions` page requirements

The `/versions` route must be publicly accessible without signing in. It is read-only and must not expose private user data, secrets, environment variables, credentials, private repository contents, or sensitive commit diffs.

The page should:

- Show the application name and a clear “Version History” heading.
- Show the current/latest version prominently.
- Show the total number of tracked commits/versions.
- List all tracked versions in **latest-to-oldest** order.
- Display the version number, commit subject, description, commit date, short SHA, author display name, change categories, and changed-file count.
- Allow a user to expand an entry to inspect the full description and changed-file list.
- Include insertions/deletions when reliable and useful.
- Clearly identify the baseline and major-version boundaries.
- Provide a link to the corresponding public Git commit only if the repository URL is intentionally public and the link can be formed safely. Otherwise display the SHA as plain text.
- Provide useful empty, loading, and generation-error states.
- Be responsive and usable on mobile and desktop.
- Support the application's existing light/dark theme and design tokens.
- Use the existing component and CSS Module conventions.
- Preserve the application's existing navigation and visual language.

Do not expose raw diffs by default. A changed-file list and verified summary are sufficient for the public history page. Public visibility of `/versions` does not mean the underlying source repository must become public.

## 8. Public-route and security requirements for YAI Studio

YAI Studio currently uses Next.js App Router, with public routes grouped under `src/app/(public)/` and authenticated application routes under `src/app/(app)/`. Its middleware currently protects routes other than a small allowlist.

Therefore:

- Put `/versions` in the public route group or otherwise ensure it is not wrapped in the authenticated application layout.
- Inspect and update `src/middleware.ts` so `/versions` and any required static assets are accessible without a YAI session.
- Do not weaken authentication for any existing protected route.
- Do not expose the private `YVSApps_Data_YaiStudio` personal-intelligence repository or any user-owned data.
- The version manifest must contain only public-safe Git metadata and descriptions.
- Do not include author email by default; use a safe display name unless the developer explicitly approves email publication.
- Never include secrets or `.env` values in generated output.
- Do not include file contents or raw patches in the public manifest.
- Validate or sanitize commit text before rendering it. Render descriptions as plain text or use the project's existing safe Markdown renderer with appropriate sanitization. Do not inject raw HTML.

## 9. Build, deployment, and reliability

The implementation must work in local development, CI, and Vercel production builds.

- Inspect whether the deployment checkout includes sufficient Git history. If Vercel/CI uses a shallow clone, configure the checkout depth appropriately in the relevant CI workflow or provide a safe fallback.
- Do not assume a `.git` directory is available at runtime in a serverless function. Generate the manifest at build time and bundle it as application data.
- Ensure the build fails clearly if required baseline/history data is missing or malformed; do not silently publish an incomplete history.
- If Git metadata is unavailable in a development environment, show a clear developer-facing error and document the recovery steps. Do not invent version entries.
- Keep generation deterministic: the same Git graph and major-version configuration must produce the same ordered manifest.
- Avoid runtime Git commands from the public route.
- Avoid external GitHub API dependencies for the core page.
- Keep the generated manifest small enough for efficient page delivery. If history becomes large, consider pagination or a compact index with lazy-loaded details.

## 10. Developer commit workflow

The standard workflow for every future commit is:

1. Complete the implementation.
2. Review the actual diff and run relevant checks.
3. Write a descriptive commit subject and body.
4. Commit the change.
5. The generator derives the new commit's SHA, date, author display name, changed files, and statistics from Git.
6. The commit receives the next sequential `vX.Y` number automatically.
7. The `/versions` page displays it at the top after the next build/deployment.

The developer should not manually increment `Y`. The version generator must calculate it from the selected Git history and explicit major-version boundaries.

If the project uses a Git hook or commit helper, it may validate that the commit has a useful subject/body, but it must not create recursive commits, rewrite existing commit history, or make committing impossible when a hook is unavailable. The version sequence must not depend on a local-only hook.

### Commit-message quality guideline

Suggested format:

```text
Fix conversation generation request contract

Align the conversations client payload with the YAI generation route.
Remove the duplicate user-message append so a submitted turn is stored
exactly once.

Affected areas:
- conversations UI
- YAI generation API

Verification:
- npm run typecheck
- npm run build

Known limitations:
- None identified.
```

The exact format can be adapted, but useful context must be preserved in the commit body.

## 11. Acceptance criteria

The implementation is complete only when all of the following are verified:

1. `/versions` opens in a fresh private/incognito browser session without authentication.
2. Existing protected routes remain protected.
3. The page shows the YAI Studio baseline commit `d4cabeb` as `v0.1`, provided repository inspection confirms the baseline lineage.
4. Every subsequent included commit receives exactly one sequential version.
5. A minor bug-fix commit increments `Y` by one.
6. A documentation-only commit increments `Y` by one.
7. A normal commit never changes `X`.
8. An explicitly authorized major bump changes `X` and starts the new series at `vX.1`.
9. Entries are displayed latest-to-oldest.
10. Each entry shows actual Git metadata and a useful description where one exists.
11. Historical commits without extended bodies are represented honestly, without fabricated descriptions.
12. The public page does not expose secrets, private user data, environment values, raw diffs, or private GitHub storage.
13. The history generator works from a clean clone and in the production build environment.
14. `npm run typecheck`, relevant tests, and `npm run build` pass.
15. The implementation includes tests for ordering, numbering, major-boundary handling, missing descriptions, and public-route access.
16. The developer workflow and major-bump procedure are documented in the repository.

## 12. Cross-application standardization

After YAI Studio proves the pattern, adopt the same `/versions` contract across all Yet Vast Solutions applications.

Each application owns its own Git history and version sequence. Do not create one shared global version counter across unrelated applications. The umbrella standard should define consistent semantics and UI expectations, while each repository generates its own history from its own commits.

A future shared package may provide the version-history UI or schema, but it must not force every application into a shared deployment or shared Git repository.

## 13. Implementation-agent instructions

When implementing this standard in YAI Studio:

1. Read the repository's existing architecture, project documentation, package scripts, route groups, middleware, design tokens, CSS Modules, and Git history before editing.
2. Treat the current codebase as the source of truth; do not assume this proposed file structure already exists.
3. Confirm the baseline commit and history lineage before assigning versions.
4. Present a concise implementation plan and then implement the complete feature.
5. Do not modify unrelated application behavior.
6. Do not introduce Tailwind CSS. Use CSS Modules and the existing YVS design tokens.
7. Do not introduce a database or store version history in the user's Personal Intelligence GitHub repository. This is application source/release metadata, not user memory.
8. Do not expose `/versions` through the authenticated app shell.
9. Run tests, typecheck, and production build; fix regressions caused by the implementation.
10. Report exact files changed, numbering logic, public-route verification, tests/build results, and any limitations.
11. Do not claim completion for checks that were not actually run.

---

**Core rule:** Every commit is a version. The developer controls the major number; Git history determines the sequential sub-version. The public `/versions` page is the transparent, chronological record of the application's evolution.
