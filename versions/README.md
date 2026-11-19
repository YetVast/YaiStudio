# YAI Studio — Application Version History Standard & Developer Guide

This document establishes the official Yet Vast Solutions Application Version History standard within the YAI Studio repository, implementing `YVS_APPLICATION_VERSION_HISTORY_STANDARD.md`.

## 1. Version Numbering Convention: `vX.Y`

YAI Studio uses the two-part version format:

```text
vX.Y
```

- **`X` (Major Version)**: Major architectural milestone or breaking platform shift. **Changed only when explicitly instructed by the developer / product owner.**
- **`Y` (Commit Sequence)**: Automatically incremented by exactly one (`+1`) for every included Git commit in the lineage, regardless of size or type.
- Bug fixes, typo corrections, dependency bumps, refactors, UI tweaks, documentation updates, and feature implementations all increment `Y`.
- Do **not** use conventional semantic versioning patch numbers (no `vX.Y.Z`).
- Do **not** automatically bump `X` based on commit type or conventional prefix (e.g. `feat!` does NOT bump `X`).

### Sequence Examples

| Git Commit Event | Application Version |
|---|---|
| First tracked baseline commit (`d4cabeb`) | `v0.1` |
| Next commit (e.g. documentation update) | `v0.2` |
| Next commit (e.g. one-line bug fix) | `v0.3` |
| Developer explicitly authorizes Major 1 | `v1.1` |
| Next commit | `v1.2` |

## 2. Documented Baseline

- **Commit SHA**: `d4cabebcfd960b6547dd5217669c60d508982c28` (`d4cabeb`)
- **Subject**: `UI Consistency, Navigation & Mobile UX Improvements`
- **Branch**: `main`
- **Committed At**: `2026-11-19T12:29:34+05:30`
- **Initial Version**: `v0.1`

All commits preceding `d4cabeb` represent initial scaffolding and historical iterations. Version `v0.1` marks the baseline application version. Every commit after `d4cabeb` on the active lineage receives a sequential `v0.Y` (and subsequent `vX.Y`).

## 3. Major-Version Control Procedure

Major versions cannot be bumped automatically. Only explicit instructions from the developer authorize a major-version increment.

### Procedure to Authorize and Execute a Major Bump

1. **Explicit Instruction**: Receive explicit developer authorization to advance to the next major version (e.g. `0` -> `1`).
2. **Update Configuration**: Edit `versions/major-version.json`:
   - Set `"currentMajor"` to the new integer (e.g. `1`).
   - Append a new milestone entry into `"milestones"`:
     ```json
     {
       "major": 1,
       "name": "YAI Studio V1 Local-First Architecture",
       "authorizedBy": "Developer Name",
       "authorizedDate": "YYYY-MM-DDTHH:mm:ssZ",
       "description": "Milestone description explaining the scope of the new major series."
     }
     ```
3. **Commit the Change**:
   - Commit the updated `versions/major-version.json` with a descriptive message explaining the major milestone.
   - The commit that records this change **becomes the first commit in the new major series (`vX.1`)**.
4. **Subsequent Commits**:
   - The version generator identifies that this commit transitioned `currentMajor` to `X`.
   - The sequence starts at `vX.1`.
   - Subsequent commits automatically increment to `vX.2`, `vX.3`, etc.

## 4. Commit Message Quality Standard

Because Git history is the single source of truth for the public `/versions` page, every commit message serves as public application documentation.

### Standard Format

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
- <automated test results: npm run test>
- <typecheck results: npm run typecheck>
- <build verification: npm run build>

Known limitations & follow-up:
- <any deferred work or deliberate caveats>
```

For historical commits where only a subject was recorded, the `/versions` page displays the subject and an honest disclosure: *"No extended description was recorded for this commit."* No fabricated AI summaries are ever substituted.

## 5. Build-Time Generation & Reliability

Version history is generated at build time and bundled directly with the application:

1. `npm run generate:versions` (or `npm run prebuild`) executes `scripts/generate-version-history.ts`.
2. The generator:
   - Validates Git repository existence and baseline reachability.
   - Traverses commits from `d4cabeb` to `HEAD`.
   - Evaluates major-version boundaries from `versions/major-version.json`.
   - Parses author name, timestamps, subjects, bodies, changed files, insertions, and deletions.
   - Emits `src/generated/version-history.json` sorted latest-to-oldest.
3. Next.js bundles `src/generated/version-history.json` into the server component and static pages.
4. Production deployments (such as Vercel serverless functions) serve version data without executing Git binaries at runtime.
5. If shallow clones are used in CI/Vercel, the repository requires sufficient history containing `d4cabeb`.
