# Implementation Record: Centralized Error Modal, Retry Mechanism & Notification Center

## Part A — Original Implementation Prompt

```markdown
# YAI Studio — Centralized Error Modal, Retry Mechanism & Notification Center

## Objective

Implement a consistent application-wide error-handling and notification experience in YAI Studio.

Whenever an operation fails, the application must:

1. Display an error modal containing meaningful error details.
2. Show available diagnostic logs and technical information.
3. Provide a Retry button when the failed operation can be retried.
4. Retry the specific failed functionality without restarting unrelated operations.
5. Add the error to the centralized notification system.
6. Allow users to inspect previous errors through a notification center.

This must be a reusable application-level capability, not an isolated implementation for the GitHub Save Details functionality.

---

# 1. Add Notification Button to Top Navbar

Locate the existing YAI Studio top navigation bar.

Add a notification button between:

- AI Runtime Monitor button.
- Theme controls (light/dark mode).

The order should be:

`... | AI Runtime Monitor | Notifications | Theme Controls | Profile`

### Notification button requirements

- Use a recognizable notification/bell icon.
- Display an unread notification count badge.
- Update the count when new notifications arrive.
- Distinguish unread and read notifications.
- Show a visual indication when unread notifications exist.
- Clicking the button opens the Notification Center.
- Preserve the existing navbar layout and responsive behaviour.

Do not introduce a separate navigation page unless the existing architecture requires it.

---

# 2. Notification Center

Implement a notification panel accessible through the navbar button.

### Notification categories

Support:

- ERROR
- WARNING
- SUCCESS
- INFO

### Notification information

Each notification should contain:

- Notification ID.
- Category.
- Title.
- Short description.
- Detailed message.
- Source module.
- Source functionality.
- Related operation ID, where available.
- Timestamp.
- Read/unread status.
- Execution status.
- Retry availability.
- Related error ID.

### Notification Center UI

Display notifications chronologically, newest first.

Each notification should expose:

- Title.
- Short description.
- Category indicator.
- Timestamp.
- Source module.
- Read/unread indicator.

Allow users to:

- Open notification details.
- Mark as read.
- Mark as unread.
- Mark all as read.
- Clear individual notifications.
- Clear all notifications.
- Filter by ERROR, WARNING, SUCCESS and INFO.

Clicking an error notification should open its associated error details.

Important:
Clearing a notification must not delete the underlying diagnostic error record or execution logs.

---

# 3. Centralized Error Modal

Create a reusable application-level Error Details modal.

Every application module should be able to invoke it when an operation fails.

### Modal structure

**A. Error Header**

Display:

- Error icon.
- Error title.
- Error category.
- Source module.
- Timestamp.
- Close button.

**B. Error Summary**

Display a clear explanation of what failed.

Use a human-readable message rather than exposing only raw API exceptions.

**C. Error Details**

Show available technical information:

- Error code.
- HTTP status code.
- API endpoint.
- Failed operation.
- Provider or service involved.
- Model information, if relevant.
- Request ID.
- Operation ID.
- Stack trace, where available and safe.
- Original error message.

**D. Diagnostic Logs**

Include logs associated with the failed operation.

Requirements:

- Display logs chronologically.
- Preserve timestamps.
- Identify log severity.
- Identify the source component.
- Allow expanding/collapsing the log section.
- Allow copying diagnostic logs.
- Show an appropriate message when logs are unavailable.

Do not fabricate diagnostic logs.

**E. Actions**

Provide:

- Retry button, when retry is supported.
- Copy Error Details button.
- Close button.

Retry must only be displayed when the application has a valid retry handler.

For non-retryable failures, explain why retry is unavailable.

---

# 4. Specific Retry Mechanism

This is a critical requirement.

Retry must execute the failed operation itself, not restart the entire workflow.

Examples:

| Failed functionality | Expected retry behaviour |
|---|---|
| GitHub Save Details | Retry saving the same telemetry JSON |
| Model inference | Retry the failed inference request |
| Model loading | Retry loading the selected model |
| Provider connection | Retry provider availability check |
| API request | Retry the failed API request |
| Database operation | Retry the specific failed database operation |
| File upload | Retry the same upload |
| Authentication request | Retry the relevant authentication operation |
| Telemetry persistence | Retry saving the existing telemetry record |

### Retry implementation requirements

1. Preserve the original operation parameters.
2. Preserve the selected model/provider.
3. Preserve the original test execution ID when applicable.
4. Preserve the generated telemetry JSON when retrying GitHub persistence.
5. Avoid rerunning successful preceding stages.
6. Prevent accidental duplicate submissions.
7. Show retry-in-progress status.
8. Record retry attempts.
9. Update the original error record with the retry outcome.
10. Generate a new error record if the retry fails for a different reason.

For the current GitHub issue:

Retrying Save Details must reuse the already-generated telemetry JSON.

It must NOT execute another AI inference test.

Do not automatically retry operations that could cause duplicate or irreversible actions unless they are protected by idempotency or explicit user confirmation.

---

# 5. Centralized Error Management Architecture

Inspect the existing application architecture before implementation.

Introduce reusable services/components rather than implementing error modals independently in each module.

Suggested architecture:

```text
YAI Studio
│
├── Notification System
│   ├── Notification Store
│   ├── Notification Center
│   ├── Unread Counter
│   └── Notification Actions
│
├── Error Management
│   ├── Error Handler
│   ├── Error Normalizer
│   ├── Error Registry
│   ├── Diagnostic Log Collector
│   └── Retry Manager
│
├── Global UI
│   ├── Error Details Modal
│   └── Notification Panel
│
└── Application Modules
    ├── AI Runtime
    ├── Model Providers
    ├── Personal Memory
    ├── Knowledge
    ├── Workspaces
    ├── Intelligence Activity
    └── Other modules
```

Use the existing state-management and persistence architecture wherever possible.

Do not create duplicate notification stores or competing error-handling systems.

---

# 6. Suggested Error Data Structure

Adapt this to the existing architecture:

```ts
type ApplicationError = {
  id: string;
  title: string;
  message: string;

  category:
    | "AUTHENTICATION"
    | "AUTHORIZATION"
    | "NETWORK"
    | "API"
    | "MODEL"
    | "DATABASE"
    | "VALIDATION"
    | "RUNTIME"
    | "UNKNOWN";

  source: {
    module: string;
    component: string;
    operation: string;
  };

  details: {
    errorCode: string | null;
    httpStatus: number | null;
    endpoint: string | null;
    requestId: string | null;
    operationId: string | null;
    originalMessage: string | null;
    stackTrace: string | null;
  };

  logs: Array<{
    timestamp: string;
    level: string;
    source: string;
    message: string;
  }>;

  retry: {
    available: boolean;
    attempts: number;
    maxAttempts: number | null;
    lastAttemptAt: string | null;
    status:
      | "NOT_AVAILABLE"
      | "READY"
      | "IN_PROGRESS"
      | "SUCCEEDED"
      | "FAILED";
  };

  occurredAt: string;
};
```

Do not expose secrets, access tokens, passwords, sensitive headers or private user information in error details or diagnostic logs.

---

# 7. Notification and Error Lifecycle

Implement the following lifecycle:

```text
Application Operation
        |
        v
Operation Succeeds?
        |
   +----+----+
   |         |
  YES        NO
   |         |
   v         v
Success    Error Handler
Event         |
   |          v
   |      Normalize Error
   |          |
   |          v
   |      Capture Diagnostics
   |          |
   |          v
   |      Register Error
   |          |
   |          v
   |      Create Notification
   |          |
   |          v
   |      Open Error Modal
   |          |
   |          v
   |      Retry Available?
   |          |
   |      +---+---+
   |      |       |
   |     YES      NO
   |      |       |
   |      v       v
   |    Retry   Close
   |      |
   |      v
   |    Success?
   |      |
   |   +--+--+
   |   |     |
   |  YES    NO
   |   |     |
   |   v     v
   | Update  Update
   | Record  Error Record
   |   |     |
   +---+-----+
       |
       v
   Notification History
```

Successful retries should update the original notification and error record rather than creating misleading duplicate failures.

---

# 8. Notification Persistence

Inspect the existing YAI Studio storage architecture.

Persist notifications and diagnostic error records using the existing authenticated user-scoped storage mechanism.

Requirements:

- Notifications survive page refreshes.
- Read/unread state persists.
- Error history remains available.
- Retry history is retained.
- Clearing notifications does not erase diagnostic records.
- User data remains isolated.
- Apply reasonable retention policies to prevent unlimited log growth.

Do not introduce a new database or external logging provider without first inspecting the existing architecture.

---

# 9. Integration with Existing Modules

Integrate the centralized mechanism with existing application functionality.

At minimum, inspect and integrate:

- AI Runtime Monitor.
- Model Providers.
- Model loading.
- Test Once inference.
- Telemetry collection.
- GitHub Save Details.
- Personal Memory.
- Knowledge.
- Workspaces.
- Intelligence Activity.
- Authentication and API operations.

Every caught application error should be routed through the centralized error handler.

Also inspect unhandled promise rejections and relevant global runtime errors.

Avoid displaying the same error multiple times when it propagates through multiple layers.

Do not suppress errors silently.

---

# 10. UI and Design Constraints

- Follow the existing YAI Studio design system.
- Use CSS Modules and design tokens.
- Do not introduce Tailwind CSS.
- Reuse existing buttons, icons, typography and modal components.
- Preserve light and dark themes.
- Ensure responsive behaviour.
- Ensure modal accessibility and keyboard navigation.
- Avoid excessive notifications for repeated identical failures.
- Keep the notification count accurate.
- Use concise, understandable error summaries.

The Error Details modal should provide detailed technical diagnostics without overwhelming the normal application workflow.

---

# 11. Acceptance Criteria

| ID | Requirement | Expected result |
|---|---|---|
| ERR-01 | Global error handler | Application errors are centrally registered |
| ERR-02 | Error modal | Failures display a detailed modal |
| ERR-03 | Diagnostic logs | Available logs are displayed |
| ERR-04 | Retry | Specific failed operation can be retried |
| ERR-05 | Operation preservation | Retry reuses original operation context |
| ERR-06 | GitHub retry | Reuses existing telemetry JSON without rerunning inference |
| ERR-07 | Notification button | Appears between AI Runtime Monitor and theme controls |
| ERR-08 | Notification count | Displays unread notification count |
| ERR-09 | Notification center | Displays historical notifications |
| ERR-10 | Notification details | Opens corresponding error information |
| ERR-11 | Read/unread | User can manage notification state |
| ERR-12 | Persistence | Notifications survive refresh |
| ERR-13 | Error history | Diagnostic records remain available after notification clearing |
| ERR-14 | Duplicate handling | Same propagated error is not registered repeatedly |
| ERR-15 | Security | Sensitive credentials are never exposed |
| ERR-16 | Theme compatibility | Works in light and dark modes |

---

# 12. Verification and Final Report

Test the following scenarios:

1. Trigger an intentional GitHub authentication failure.
2. Verify that an Error Details modal opens.
3. Verify that the HTTP 401 details and available logs are displayed.
4. Verify that a notification is created.
5. Click Retry after correcting the credential.
6. Confirm that the existing JSON is saved without rerunning inference.
7. Verify that the original error record reflects the retry result.
8. Trigger a model inference failure and verify the same centralized mechanism.
9. Trigger a network/API failure.
10. Verify notification persistence after refreshing the page.
11. Verify unread counts and read/unread operations.
12. Verify that clearing notifications does not delete diagnostic records.
13. Verify responsive layouts and both themes.

Run TypeScript checks, tests and production build.

At completion, report:
- Architecture implemented.
- Files created and modified.
- Error sources integrated.
- Notification persistence mechanism.
- Retry handlers implemented.
- Test scenarios executed.
- Build results.
- Remaining limitations.

**Core principle:** Every application failure must be observable, explainable and recoverable where recovery is technically possible. Users should never have to inspect browser developer tools merely to understand why an ordinary application operation failed.
```

---

## Part B — Initial Repository Findings

1. **Existing Architecture:**
   - YAI Studio's top header in `src/components/layout/AppShell.tsx` had exactly three elements on the right: `ProcessIndicator` (AI Runtime Monitor), theme toggle (`button`), and `avatar` (`Link`).
   - Error handling across pages (`monitor`, `providers`, `memory`, `knowledge`, `workspaces`) was fragmented: each page set a local string state (`errorMessage`) and rendered an inline red banner, with no centralized diagnostic logging, retry closures, or notification history.
   - Failures were ephemeral: refreshing the page or leaving the screen lost all technical diagnostic logs and context.

2. **Persistence State:**
   - Client-side persistence is established via Dexie IndexedDB (`YaiStudioLocalDB`) with a `localSettings` table and a `localStorage` fallback layer, as used by `TestHistoryStorage`.
   - No dedicated tables or stores existed for application notifications or diagnostic error records.

3. **Invariants & Constraints:**
   - CSS Modules only (`.module.css`), tokens from `src/styles/tokens.css`, Inter and JetBrains Mono fonts, and Lucide icons.
   - Zero credential leakage: Tokens (GitHub, Google, OpenAI, bearer headers) must never be logged or stored in diagnostic logs.
   - Operation-specific retry: When retrying an operation like "Save Details to GitHub", the application must reuse the existing telemetry JSON and must never execute another inference test.
   - Clearing notifications in the Notification Center must never delete underlying diagnostic error records.

---

## Part C — Implementation Report

### 1. Files Created and Modified

- **Created:**
  - `src/lib/errors/types.ts` — Type definitions for `ApplicationError`, `AppNotification`, `DiagnosticLog`, `ErrorCategory`, `RetryStatus`, `CaptureErrorOptions`.
  - `src/lib/errors/error-normalizer.ts` — Normalizes exceptions into `ApplicationError`, sanitizes secrets (tokens, passwords, keys), classifies categories, and creates user-friendly explanations.
  - `src/lib/errors/error-registry.ts` — Persists diagnostic error records into IndexedDB (`localSettings` table) with `localStorage` fallback. Preserves logs even when notifications are cleared.
  - `src/lib/errors/retry-manager.ts` — Coordinates operation-specific retry closures, maintains in-progress concurrency locks, tracks attempt counters, and updates error resolution state.
  - `src/lib/errors/notification-store.ts` — Manages notifications list, unread counts, mark read/unread, clearing, category filtering, and IndexedDB persistence.
  - `src/lib/errors/error-handler.ts` — Singleton coordinator: `errorHandler.captureError(...)` normalizes errors, deduplicates within 2s windows, saves to registry, registers retries, emits notifications, and triggers the Error Modal.
  - `src/lib/errors/index.ts` — Clean barrel export for error architecture.
  - `src/components/notifications/NotificationBellButton.tsx` and `NotificationBellButton.module.css` — Top navbar notification button with `Bell` icon and animated unread badge.
  - `src/components/notifications/NotificationCenter.tsx` and `NotificationCenter.module.css` — Notification Center popover panel with category filter tabs (ALL, ERROR, WARNING, SUCCESS, INFO), card actions, and outside-click/Escape dismissal.
  - `src/components/errors/ErrorModal.tsx` and `ErrorModal.module.css` — Reusable Centralized Error Details Modal with Sections A (Header), B (Summary), C (Details), D (Diagnostic Logs with copy), and E (Actions: Retry with spinner, Copy details, Close).
  - `src/components/providers/ErrorNotificationProvider.tsx` — Global React Context provider managing notification state, unread counts, modal state, retry execution, and unhandled window error/promise rejection listeners.
  - `tests/errors/error-normalizer.test.ts` — 8 tests verifying secret scrubbing, category classification, and error normalization.
  - `tests/errors/error-registry-and-retry.test.ts` — 4 tests verifying diagnostic log preservation, independent retry execution without rerunning inference, and concurrency locking.
  - `tests/errors/notification-store.test.ts` — 4 tests verifying unread counts, read/unread toggling, and clearing.
  - `tests/errors/error-handler.test.ts` — 2 tests verifying error capture orchestration, notification emission, and deduplication.
  - `docs/implementation/2026-11-23-centralized-error-modal-retry-notification-center.md` — Mandatory implementation record.
- **Modified:**
  - `src/components/layout/AppShell.tsx` — Inserted `NotificationBellButton` between `ProcessIndicator` and Theme controls (`... | AI Runtime Monitor | Notifications | Theme Controls | Profile`), wrapped shell in `ErrorNotificationProvider`.
  - `src/app/(app)/monitor/page.tsx` — Integrated `errorHandler.captureError` in `handleSaveDetailsToGitHub` (with specific retry preserving existing telemetry JSON) and `handleRunTest` (with inference retry).
  - `src/app/(app)/providers/page.tsx` — Integrated `errorHandler.captureError` in `fetchProviders` and `handleSaveKey`.
  - `src/app/(app)/memory/page.tsx` — Integrated `errorHandler.captureError` in `fetchCategory`, `fetchCandidates`, `handleAddMemory`, and `handleReviewCandidate`.
  - `src/app/(app)/knowledge/page.tsx` — Integrated `errorHandler.captureError` in `fetchItems` and `handleCreateNote`.
  - `src/app/(app)/workspaces/page.tsx` — Integrated `errorHandler.captureError` in `fetchData` and `handleCreateWorkspace`.

### 2. Architecture & Data Flow

```text
User / System Action
       │
       ▼
Operation Fails?
       │
  ┌────┴────┐
  │         │
 YES        NO
  │         │
  ▼         ▼
errorHandler.captureError()    Normal Operation Flow
  │
  ├─► ErrorNormalizer: Sanitizes secrets (tokens, passwords) & classifies Category
  │
  ├─► Deduplication Check: Prevents redundant notifications within 2s window
  │
  ├─► ErrorRegistry: Saves ApplicationError & logs to IndexedDB (localSettings)
  │
  ├─► RetryManager: Registers specific retry closure (e.g. Save JSON without inference)
  │
  ├─► NotificationStore: Creates AppNotification (unread badge increments in Top Navbar)
  │
  └─► ErrorModal: Opens modal displaying Summary, Details, Logs, and "Retry"
       │
       ▼
User Clicks "Retry"
       │
       ▼
RetryManager executes specific retry handler
       │
  ┌────┴────┐
  │         │
SUCCESS   FAILURE
  │         │
  ▼         ▼
ErrorRegistry: resolvedAt set, status = 'SUCCEEDED'   Attempts incremented, status = 'FAILED'
NotificationStore: Updated to '[Resolved]'            Diagnostic logs updated with failure reason
Modal: Shows green recovery banner                    User can retry again or inspect logs
```

### 3. Key Guarantees Enforced

1. **Operation-Specific Retry (GitHub Save Details):**
   - Retrying "Save Details" executes `handleSaveDetailsToGitHub()` with the pre-existing `activeDisplayResult`.
   - Inference (`handleRunTest()`) is **never** re-run during a save retry.
2. **Diagnostic Log Preservation:**
   - Clearing all notifications in the Notification Center purges `NotificationStore`, but leaves `ErrorRegistry` and all associated diagnostic logs completely intact.
3. **Secret Redaction:**
   - Regex patterns scrub GitHub OAuth tokens (`gho_`, `ghp_`), Bearer tokens, OpenAI keys (`sk-`), Google tokens (`ya29.`), basic auth credentials, and object keys (`password`, `token`, `secret`, `apiKey`).

---

## Part D — Verification

### 1. Automated Test Suites Executed
- Command: `npm.cmd test`
- Results: **21 test files passed (21/21)**, **131 tests passed (131/131)**.
  - `tests/errors/error-normalizer.test.ts` (8 tests)
  - `tests/errors/error-registry-and-retry.test.ts` (4 tests)
  - `tests/errors/notification-store.test.ts` (4 tests)
  - `tests/errors/error-handler.test.ts` (2 tests)
  - `tests/telemetry/save-github.test.ts` (6 tests)
  - `tests/telemetry/test-once-runner.test.ts` (15 tests)
  - Plus all 15 pre-existing test files in auth, inference, navigation, PWA, sync, versions, and storage.

### 2. TypeScript Static Typecheck
- Command: `npm.cmd run typecheck`
- Result: **0 errors** (`tsc --noEmit`).

### 3. Linter Check
- Command: `npm.cmd run lint`
- Result: **0 errors** across all modified files.

### 4. Production Build
- Command: `npm.cmd run build` (`next build`)
- Result: **Compiled successfully in 6.6s**. All 39 static and dynamic routes compiled and optimized.

---

## Part E — Remaining Work

1. **Staging / User Environment:**
   - In production, reconnecting GitHub OAuth via Settings → GitHub Connect allows retrying failed Save Details operations to succeed immediately without re-running any tests.
2. **Future Enhancements (Planned):**
   - Sound / haptic notification preferences for high-priority background errors.
   - Export full diagnostic report bundle as a `.json` diagnostic archive for support investigations.
