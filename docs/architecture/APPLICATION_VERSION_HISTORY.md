# Application Version History System — Architecture & Operations Guide

**Standard Specification Reference:** `docs/reference/YVS_APPLICATION_VERSION_HISTORY_STANDARD.md`  
**Operational Target:** YAI Studio (`YetVastSolutions/YaiStudio`)  
**Implementation Date:** 19 November 2026  
**Status:** Active Production System

---

## 1. Version Numbering Rules

YAI Studio implements the Yet Vast Solutions two-part version numbering convention:

$$\mathbf{vX.Y}$$

- **`X` (Major Version)**: Represents major platform shifts, breaking architectural pivots, or strategic milestones.
  - **Invariant**: The major version number is changed **only when explicitly instructed by the developer / product owner**.
  - Conventional commit prefixes (e.g., `feat!`, `BREAKING CHANGE`) do **never** automatically increment `X`.
  - Initial major version is `0`.
- **`Y` (Commit Sequence)**: Represents the sequential commit count within the active major version.
  - **Invariant**: Automatically incremented by exactly one (`+1`) for **every Git commit** included in the lineage.
  - Every commit receives a version: feature work, bug fixes, refactorings, UI enhancements, documentation additions, dependency updates, and maintenance chores.
  - No commit is ever omitted or skipped because of its size or scope.
- **No Semantic Patch Digit**: Conventional three-part semantic versioning (`vX.Y.Z`) is not used for application history.
- **Isolation from NPM Package Version**: The application history version is independent of `package.json`'s package version or internal module versions.

### Numbering Progression Example

| Commit in Lineage | Major Context | Assigned Version | Status |
|---|---|---|---|
| `d4cabeb` | Major 0 | `v0.1` | **Documented Baseline** |
| `fd909fb` | Major 0 | `v0.2` | V0 As-Built Docs |
| `597b3bd` | Major 0 | `v0.3` | V0 Readme |
| `4942611` | Major 0 | `v0.4` | Fix Generation Contracts |
| `8b09987` | Major 0 | `v0.5` | PWA Foundation |
| `cfada5e` | Major 0 | `v0.6` | V1 Local-First IDB & LiteRT |
| Next commit | Major 0 | `v0.7` | Version History Implementation |
| *Developer authorizes Major 1* | Major 1 | `v1.1` | First commit of Major 1 series |
| Subsequent commit | Major 1 | `v1.2` | Next commit in Major 1 series |

---

## 2. Documented Baseline

The initial application baseline is pinned to:

- **Commit SHA**: `d4cabebcfd960b6547dd5217669c60d508982c28` (`d4cabeb`)
- **Subject**: `UI Consistency, Navigation & Mobile UX Improvements`
- **Committed At**: `2026-11-19T12:29:34+05:30`
- **Initial Version**: `v0.1`

All commits preceding `d4cabeb` represent early scaffolding and history. `v0.1` represents the official established baseline for YAI Studio.

---

## 3. How Automatic Version Generation Works

The version generation mechanism is deterministic and derives version metadata directly from the repository's Git commit graph.

```
Git Commit History (d4cabeb -> HEAD)
               │
               ▼
   [scripts/generate-version-history.ts]
               │
   ┌───────────┴────────────────────────┐
   │ 1. Validate baseline reachability  │
   │ 2. Read commit metadata (%H, %s, %b)│
   │ 3. Extract diffstat (insert/delete)│
   │ 4. Read versions/major-version.json│
   │ 5. Calculate sequential vX.Y       │
   │ 6. Classify change types           │
   │ 7. Order latest-to-oldest          │
   └───────────┬────────────────────────┘
               ▼
   [src/generated/version-history.json]
               │
   ┌───────────┴────────────────────────┐
   │                                    │
   ▼                                    ▼
[/versions Page]                [/api/versions API]
Server Component prerendered    Static JSON Route Handler
```

### Manifest Pipeline

1. **Baseline Reachability Check**:
   Executes `git rev-parse --verify d4cabeb^{commit}` and `git merge-base --is-ancestor d4cabeb HEAD`.
   If baseline is missing or unreachable (e.g., shallow clone), execution halts with an actionable error.
2. **Reachable Commits Extraction**:
   Extracts sequential commits using `git rev-list --reverse d4cabeb..HEAD`.
3. **Commit Metadata & Diffstat Parsing**:
   - Executes `git show -s --format="%H%x00%h%x00%an%x00%aI%x00%cI%x00%s%x00%b" <commit>`.
   - Executes `git diff-tree --no-commit-id --numstat -r <commit>`.
   - Null-byte (`\0`) separation guarantees that multi-line commit bodies with Markdown and special characters are parsed cleanly.
4. **Change Classification**:
   Derives categories (`feature`, `fix`, `ui`, `documentation`, `test`, `security`, `refactor`, `chore`) using conventional commit prefixes and file paths.
5. **Ordering**:
   Manifest is emitted with entries in **latest-to-oldest** order so the newest release appears first on `/versions`.

---

## 4. Where Major-Version Configuration is Maintained

Major version configuration is tracked at:

```
versions/major-version.json
```

Schema:

```json
{
  "$schema": "./major-version.schema.json",
  "baselineCommit": "d4cabebcfd960b6547dd5217669c60d508982c28",
  "baselineVersion": "v0.1",
  "currentMajor": 0,
  "milestones": [
    {
      "major": 0,
      "name": "YAI Studio V0 Foundation Baseline",
      "startCommit": "d4cabebcfd960b6547dd5217669c60d508982c28",
      "authorizedBy": "Yagnavalk Chaapala",
      "authorizedDate": "2026-11-19T12:29:34+05:30",
      "description": "Baseline application version established at commit d4cabeb with UI consistency, navigation, and mobile UX improvements."
    }
  ]
}
```

---

## 5. Procedure to Authorize and Execute a Major-Version Increment

Because Git commit hashes depend on file contents, a commit cannot contain its own final hash. The system is designed to avoid self-referential paradoxes:

1. **Receive Explicit Direction**: Developer / product owner explicitly directs a major increment (e.g. from `0` to `1`).
2. **Update `versions/major-version.json`**:
   - Set `"currentMajor": 1`.
   - Add a milestone object to `"milestones"`:
     ```json
     {
       "major": 1,
       "name": "YAI Studio V1 Local-First Architecture",
       "authorizedBy": "Developer Name",
       "authorizedDate": "2026-11-19T14:00:00Z",
       "description": "Introduction of IndexedDB local-first storage, sync orchestrator, and offline PWA capabilities."
     }
     ```
3. **Commit the Change**:
   Commit `versions/major-version.json` with an informative commit body.
   - **This commit automatically becomes `v1.1`** (the first commit of the new major series).
   - `isMajorVersionStart` will be marked as `true`.
4. **Subsequent Commits**:
   - All subsequent commits automatically become `v1.2`, `v1.3`, etc.
   - Previous major version entries (`v0.1`–`v0.6`) remain completely intact.

---

## 6. How Commit Descriptions Should Be Written

Git commit messages are public release documentation. Coding agents and developers must structure commit messages as follows:

```text
<type>(<scope>): <concise subject line>

<Detailed explanation of what changed and why this change was necessary.>

Subsystems & files affected:
- <subsystem / component 1>
- <subsystem / component 2>

Implementation details:
- <key architectural or code decisions>
- <state changes, data structures, or API contracts>

Verification performed:
- <npm run test results>
- <npm run typecheck results>
- <npm run build results>

Known limitations & follow-up:
- <any deferred work or deliberate caveats>
```

### Historical Commits Without Extended Body

For historical commits with only a subject, the system displays the actual subject and an honest disclosure:  
*"No extended description was recorded for this commit."*  
No AI-generated hallucinations are ever substituted.

---

## 7. How the Public `/versions` Page Receives Its Data

- **Public Route**: `src/app/(public)/versions/page.tsx`
- **Public API**: `src/app/api/versions/route.ts`
- **Data Source**: Bundled static JSON artifact `src/generated/version-history.json`
- **Zero Runtime Git Requirement**: Serverless deployment environments (e.g. Vercel) never execute Git CLI commands at request time.
- **Zero Authentication Required**: `src/middleware.ts` allows unrestricted access to `/versions` and `/api/versions`.
- **Zero Central Database**: Uses release metadata bundled into the application build.

---

## 8. Build-Time Generation in Production Deployments

In `package.json`:

```json
"scripts": {
  "prebuild": "node --no-warnings --experimental-strip-types scripts/generate-version-history.ts",
  "build": "next build",
  "generate:versions": "node --no-warnings --experimental-strip-types scripts/generate-version-history.ts"
}
```

1. Whenever `npm run build` is called (in local, CI, or Vercel), npm runs `"prebuild"` first.
2. `generate-version-history.ts` runs using Node 22+ native type stripping (`--experimental-strip-types`).
3. Next.js static prerendering bakes the latest manifest directly into `/versions`.
4. If building inside a shallow git clone, the CI script or Vercel build command should ensure adequate fetch depth (e.g. `git fetch --unshallow` or depth sufficient to contain `d4cabeb`).
