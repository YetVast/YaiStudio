# Implementation Record: AI Runtime Monitor UI Restructuring

## Part A — Original Implementation Prompt

```markdown
# YAI Studio — AI Runtime Monitor UI Restructuring

## Objective

Refactor the AI Runtime Monitor page to improve the workflow for executing inference tests, inspecting resource telemetry, and saving test results.

This is primarily a UI/UX restructuring task. Do not undertake the deeper telemetry accuracy audit yet. Preserve the existing telemetry collection and inference mechanisms.

---

## 1. Move Test Once into Latest Baseline Telemetry

### Current behavior
- Clicking **Test Once** opens a modal/popup.
- The popup contains the diagnostic query, active provider/model information, test execution controls, query resource summary, model response, and complete raw telemetry JSON.

### Required behavior
Remove the popup-based workflow entirely.

Move all existing Test Once functionality and its components directly into the **Local Telemetry** tab.

### Local Telemetry tab structure

Organize the content in the following sequence:

**A. Latest Baseline Telemetry — Section Header**

- Display the section title.
- Add a **Test Once** button aligned to the right side of the header.
- Clicking Test Once should execute the same inference test currently executed by the popup.
- No modal, popup, or separate overlay should appear.

**B. Active Model Information**

Preserve the existing information:
- Active Provider
- Selected Model
- Version / Quantization
- Inference Backend

**C. Diagnostic Query**

Preserve the existing functionality:
- Diagnostic Query Prompt textarea.
- Reset to Default button.
- Clear button.
- Go / Run Test button.

**D. Test Run History**

Preserve:
- Test run history dropdown.
- Ability to select previous test executions.
- Clear History button.

**E. Query Resource Summary**

Move the complete existing Query Resource Summary here.

Preserve all existing metrics, including:
- Elapsed Duration
- Baseline JS Heap
- Peak Heap
- Incremental Peak
- Retained Memory
- Tokens (In / Out)
- Generation Speed
- VRAM Allocation
- Telemetry Coverage
- Used / Not Used / Measured Zero / Unavailable / Unsupported counts

Preserve the existing status indicator.

**F. Model Output Response**

Preserve the expandable model response section.

**G. Complete Raw Telemetry (Structured JSON)**

Preserve:
- Complete raw telemetry JSON.
- Copy JSON button.
- Collapse / Expand functionality.

All existing Test Once functionality must remain operational after this restructuring.

---

## 2. Add Save Details to Query Resource Summary

Add a **Save Details** button aligned to the top-right side of the Query Resource Summary header.

### Expected behavior

When clicked, save the currently selected test execution's complete telemetry details as a JSON file directly into the GitHub repository.

Target directory:

`telemetry-tests/`

If the repository already has an established telemetry test directory, inspect and reuse it rather than creating a duplicate directory.

### JSON contents

Save the complete test execution record, not just the visible summary metrics.

Include:

1. Test execution ID.
2. Execution timestamp.
3. Active provider.
4. Selected model.
5. Model version and quantization.
6. Inference backend.
7. Diagnostic query prompt.
8. Elapsed duration.
9. All resource summary metrics.
10. Telemetry coverage and measurement classifications.
11. Model output response.
12. Complete raw structured telemetry JSON.
13. Any additional metadata already available in the existing test execution object.

Do not omit fields simply because they are not currently displayed in the UI.

### File naming convention

Use a descriptive, timestamp-based filename.

Suggested convention:

`runtime-telemetry-<provider>-<model>-<YYYYMMDD-HHmmss>.json`

Example:

`runtime-telemetry-local-litert-ibm-granite-4-0-350m-20261123-143025.json`

Sanitize provider and model identifiers to produce valid filenames.

Use a consistent timestamp format and preserve the original execution timestamp inside the JSON.

### GitHub persistence requirements

- Inspect the existing GitHub integration and repository structure before implementing.
- Use the application's existing GitHub authentication and repository access mechanism.
- Save the JSON file through the existing GitHub integration/API.
- Do not expose GitHub tokens or credentials to the browser.
- Do not hardcode repository credentials.
- Handle GitHub API errors and network failures.
- Prevent accidental overwriting of an existing test record.
- Show clear success or failure feedback.
- On success, display the saved filename and repository path.
- Where practical, provide a link to open the saved file in GitHub.

Important: Save the details of the currently selected test execution, not necessarily the most recent execution. This is important when reviewing historical test runs.

---

## 3. Make Every AI Runtime Monitor Tab Expandable and Collapsible

### Objective

Every tab/section on the AI Runtime Monitor page should allow users to independently expand or collapse its contents.

### Expected behavior

- Add an expand/collapse control to every tab or section header.
- Clicking a header or its expand/collapse toggle should collapse or expand that section's contents.
- Clearly indicate the current state (expanded vs collapsed) using appropriate visual indicators (such as chevron icons).
- Section state should be independent: expanding or collapsing one section must not affect the state of others.
- Allow any combination of sections to be expanded or collapsed simultaneously.
- Collapsing a section must not reset or lose any underlying data, test runs, or form inputs.

---

## 4. Verification Requirements

Verify that:

1. Clicking **Test Once** directly executes the inference test without opening any modal or popup.
2. The diagnostic query can be viewed and edited directly in the tab.
3. All resource summary metrics are displayed correctly in the new location.
4. Raw telemetry JSON can be expanded, collapsed, and copied.
5. Previous test runs can be selected from history and inspected.
6. Clicking **Save Details** saves the selected test execution as a JSON file in `telemetry-tests/` in the user's GitHub repository.
7. The saved JSON contains the complete telemetry record and all required metadata.
8. File names follow the required naming convention and handle special characters properly.
9. Appropriate feedback is displayed after saving (success or failure).
10. Every tab/section on the AI Runtime Monitor page can be expanded and collapsed independently.
11. No regression in existing inference or telemetry collection capabilities.
```

---

## Part B — Initial Repository Findings

1. **Prior Implementation State:**
   - The "Test Once" telemetry engine was previously implemented across `src/lib/telemetry/test-runner/` (`TestOnceRunner`, `registered-components`, `telemetry-sampler`, and `TestHistoryStorage`).
   - In `src/app/(app)/monitor/page.tsx`, the user triggered the test via a dropdown ("Test Once ▾") located in the top navigation header. This action opened a fixed full-screen modal/popup (`.modalOverlay`, `.modalLarge`).
   - The modal contained the diagnostic query, active model info, execution actions ("Go / Run Test"), query summary tiles, model response, and raw JSON.

2. **Gaps and Anti-Patterns Identified:**
   - **Modal UX bottleneck:** Inspecting or running diagnostic tests required launching an overlay on top of the monitor rather than inspecting telemetry directly in context within the page.
   - **Persistence absence:** Historical baseline runs were stored only in the browser's `localStorage` and could not be committed or tracked in the user's private GitHub intelligence repository.
   - **Monolithic page view:** All sections on the monitor page (Overview tiles, Memory & Resource Telemetry, Operations) were permanently expanded, cluttering the view when running repeated diagnostics.

3. **Architectural Decisions & Invariants:**
   - **Server-Side GitHub Storage Invariant:** Under Yet Vast Solutions architecture, client bundles must never receive GitHub OAuth tokens or execute privileged GitHub API mutations directly. GitHub operations must go through authenticated Next.js API route handlers using `getStoredGitHubToken(session.yvUserId)` and `DATA_REPO_NAME` (`YVSApps_Data_YaiStudio`).
   - **CSS Modules Only:** Strictly use CSS Modules (`Monitor.module.css`). Do not introduce utility CSS or Tailwind. Canonical brand colors `#FFFF11` (YVS Yellow) and `#4B0084` (YVS Indigo-Violet) with semantic tokens.
   - **Independent Accordion State:** Section collapse/expand state must use dictionary/record state (`Record<string, boolean>`) so any combination of sections can be toggled without mutual exclusion.

---

## Part C — Implementation Report

### 1. Files Created, Modified, and Removed

- **Created:**
  - `src/app/api/telemetry/save-github/route.ts` — Server-side endpoint handling authenticated persistence of complete telemetry baseline records into user's private GitHub repository (`telemetry-tests/`).
  - `tests/telemetry/save-github.test.ts` — Vitest unit and integration test suite verifying authentication, authorization, validation, overwrite prevention, serialization, and GitHub API interactions.
  - `docs/implementation/2026-11-23-runtime-monitor-ui-restructuring.md` — Mandatory implementation record.
- **Modified:**
  - `src/app/(app)/monitor/page.tsx` — Restructured monitor UI: eliminated popup/modal workflow, moved all Test Once controls into in-page "Latest Baseline Telemetry" in sequential sub-sections A through G, added independent section collapse/expand handlers, and integrated "Save Details" top-right action with clear success/error banners.
  - `src/app/(app)/monitor/Monitor.module.css` — Removed modal CSS; added clickable section headers, toggle button styles, top-right header actions, and GitHub persistence success/error feedback banner styles.

### 2. Architecture & Data Flow

#### A. In-Page Baseline Telemetry Architecture (`src/app/(app)/monitor/page.tsx`)
The monitor screen now arranges its layout into four independently collapsible sections:
1. **Section 1: Runtime Overview & Metrics** (`expandedSections.overview`)
   - Collapsible header with toggle button.
   - System runtime, configured model, active operations in flight, and completed/failed counts.
2. **Section 2: Memory & Resource Telemetry** (`expandedSections.memoryTelemetry`)
   - Collapsible header with toggle button.
   - Device memory (estimated), application JS heap (measured), model & runtime VRAM (measured/estimated), storage free for models, and telemetry privacy invariant callout.
3. **Section 3: Latest Baseline Telemetry (Local Telemetry)** (`expandedSections.latestBaseline`)
   - **A. Section Header:** Contains section title and right-aligned **Test Once** button and toggle button. Clicking "Test Once" immediately invokes `handleRunTest()` in-place without opening any modal.
   - **B. Active Model Information:** Active Provider, Selected Model, Version / Quantization, and Inference Backend.
   - **C. Diagnostic Query Prompt:** Query prompt textarea (prepopulated with the default prompt), "Reset to Default" button, "Clear" button, and "Go / Run Test" / "Cancel Test" controls.
   - **D. Test Run History:** Select dropdown of previous runs with execution timestamps and status, plus "Clear History" button.
   - **E. Query Resource Summary:**
     - Header with execution status pill and top-right **Save Details** button.
     - Live feedback banners for GitHub persistence (success with filename, path, repo, and direct link to GitHub; or error callout with dismiss action).
     - Full metrics grid: Elapsed Duration, Baseline JS Heap, Peak Heap, Incremental Peak, Retained Memory, Tokens (In / Out), Generation Speed, VRAM Allocation.
     - Component participation counts: Used, Not Used, Measured Zero, Unavailable, Unsupported, Errors, and Coverage %.
   - **F. Model Output Response:** Collapsible preview box showing complete generated text and character count.
   - **G. Complete Raw Telemetry (Structured JSON):** Formatted JSON viewer with "Copy JSON" and "Collapse / Expand" controls.
4. **Section 4: Ongoing & Recent Operations** (`expandedSections.operations`)
   - Collapsible header with operation count and toggle button.
   - Real-time operation cards with stage breakdown, resource metrics, and execution logs.

#### B. GitHub Telemetry Persistence API (`/api/telemetry/save-github`)
- **Authentication & Authorization:** Enforces `requireSession(request)` and retrieves the stored GitHub token for the session's `yvUserId`.
- **Target Repository:** Verifies user's private data repository `YVSApps_Data_YaiStudio` exists.
- **Path & Filename Construction:**
  - Directory: `telemetry-tests/`
  - Sanitization: Provider and model strings are sanitized to lowercase alphanumeric strings with hyphens (e.g., `local-litert`, `ibm-granite-4-0-350m`).
  - Timestamp: Formatted in `YYYYMMDD-HHmmss` (e.g., `20261123-143025`).
  - Output name: `runtime-telemetry-<provider>-<model>-<YYYYMMDD-HHmmss>.json`.
- **Accidental Overwrite Prevention:** Queries `gh.getFile(owner, repo, path, token)`. If a file already exists at that path, rejects with HTTP 409 Conflict.
- **Full Payload Serialization:** Preserves test execution ID, execution timestamp, provider, model name, version, quantization, backend, prompt query, elapsed duration, execution object, query resources, measurement coverage, output response, tokens, system resources, steps, components, errors, savedBy (user ID and GitHub login), and savedAt timestamp.
- **Commit & Return:** Commits file using `gh.createFile` and returns `{ success: true, filename, path, repository, url, sha }`.

---

## Part D — Verification

### 1. Automated Test Execution
Executed the complete test suite using Vitest:
- Command: `npm.cmd test`
- Results:
  ```
   Test Files  17 passed (17)
        Tests  113 passed (113)
     Start at  01:57:45
     Duration  2.89s
  ```
- Specific tests executed:
  - `tests/telemetry/save-github.test.ts` (6 tests passed):
    - Rejection of unauthenticated requests (401).
    - Rejection when GitHub token is not connected (403).
    - Rejection of invalid payloads (400).
    - Repository missing handling (404).
    - Accidental overwrite prevention (409 Conflict).
    - Complete test record serialization, commit, and response verification.
  - `tests/telemetry/test-once-runner.test.ts` (15 tests passed).
  - `tests/telemetry/process-telemetry.test.ts` (6 tests passed).
  - All other 14 test suites in auth, inference, navigation, PWA, sync, versions, and storage passed.

### 2. TypeScript Static Typecheck
- Command: `npm.cmd run typecheck`
- Result: **Passed with 0 errors** (`tsc --noEmit`).

### 3. Linter Check
- Command: `npm.cmd run lint`
- Result: **Passed with 0 errors** across all modified files.

### 4. Production Build
- Command: `npm.cmd run build` (`next build`)
- Result: **Compiled successfully in 5.1s**. All 39 static and dynamic routes compiled and optimized, including `/monitor` (22.8 kB) and dynamic endpoint `/api/telemetry/save-github` (203 B).

---

## Part E — Remaining Work

1. **Future Enhancements (Planned):**
   - Telemetry Accuracy Audit: A comprehensive audit of browser memory measurement vs hardware VRAM instrumentation across different GPU vendors.
   - Batch Export: An option to export all test history records to the GitHub data repository in a single archive.
2. **Environment & Staging Requirements:**
   - User must have connected their GitHub account via Settings → GitHub Connect to persist files to `telemetry-tests/` in their `YVSApps_Data_YaiStudio` repository. If disconnected, the UI gracefully informs the user with an actionable message.
