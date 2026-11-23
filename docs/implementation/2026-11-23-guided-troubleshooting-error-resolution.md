# Implementation Record: Guided Troubleshooting, Error Resolution & Recovery Actions

**Document ID:** `2026-11-23-guided-troubleshooting-error-resolution`  
**Date:** 2026-11-23  
**Repository:** `YetVastSolutions/YaiStudio`  
**Status:** Completed and Verified  

---

## Part A — Original Implementation Prompt

### 1. Primary Implementation Prompt (Verbatim)

```markdown
# YAI Studio — Guided Troubleshooting, Error Resolution & Recovery Actions

## Objective

Extend the existing centralized Error Details Modal and Notification Center with an intelligent **Troubleshooting & Resolution System**.

The current error modal already displays:
- Error title and category.
- Error summary.
- Technical details.
- HTTP status and API endpoint.
- Operation ID.
- Provider and model information.
- Raw exception message.
- Stack trace.
- Diagnostic logs.
- Copy Error Details.
- Retry.

Retain all these existing capabilities.

The missing capability is helping users actually resolve the problem.

Every error should provide actionable troubleshooting guidance, appropriate instructions, and direct navigation or action buttons wherever possible.

The system should answer:

1. What happened?
2. Why did it happen?
3. What is the most likely cause?
4. What should the user do to fix it?
5. Can YAI Studio perform any diagnostic or corrective action automatically?
6. Where should the user navigate to resolve it manually?
7. Once resolved, how can the original failed operation be resumed?

This must be a reusable application-wide capability.

---

## 1. Add a Troubleshooting & Resolution Section to the Error Modal

Add a dedicated section named:

**Troubleshooting & Resolution**

Position it between the existing Error Summary and Technical Details sections.

The section should contain the following elements.

### A. What went wrong?

Explain the failure in understandable language.

Do not simply repeat the raw exception.

### B. Probable cause

Identify the likely cause using available diagnostic information.

Where multiple causes are possible:
- List the most likely causes first.
- Explain why each cause is suspected.
- Clearly distinguish confirmed causes from hypotheses.
- Do not claim certainty without supporting evidence.

### C. Recommended solution

Provide specific, sequential instructions that the user can follow.

Instructions should be:
- Relevant to the actual error.
- Technically accurate.
- Written in understandable language.
- Specific to the affected YAI Studio module and integration.
- Ordered by the recommended resolution sequence.

Avoid generic instructions such as "check your configuration" without explaining exactly what to inspect.

### D. Resolution status

Display one of:

- ACTION_REQUIRED
- AUTOMATIC_FIX_AVAILABLE
- MANUAL_FIX_REQUIRED
- WAITING_FOR_USER
- READY_TO_RETRY
- RESOLVED
- UNRESOLVED

---

## 2. Add Contextual Resolution Buttons

The modal must dynamically generate appropriate action buttons based on the error type and available application capabilities.

Possible actions include:

| Action | Behaviour |
|---|---|
| Retry | Retry the original failed operation |
| Validate Configuration | Inspect relevant configuration |
| Test Connection | Test connectivity to the affected service |
| Open Settings | Navigate to the relevant application settings |
| Open Provider Configuration | Navigate to the affected AI provider |
| Open Integration Settings | Navigate to the affected external integration |
| Open Documentation | Open relevant technical documentation |
| View Logs | Navigate to detailed diagnostic logs |
| Copy Fix Instructions | Copy troubleshooting instructions |
| Copy Diagnostic Report | Copy complete error diagnostics |
| Run Diagnostics | Execute available non-destructive diagnostic checks |
| Apply Fix | Perform a verified automatic correction when supported |

Important requirements:

- Only display actions that are genuinely supported.
- Do not render buttons that have no implemented functionality.
- Navigation must use actual existing application routes.
- External links must point to relevant, verified documentation or settings pages.
- Do not invent application routes.
- Do not expose credentials or sensitive configuration values.

If no automated fix is available, provide useful manual instructions and navigation actions.

---

## 3. Example: GitHub 401 Bad Credentials

Use the current GitHub error as the reference implementation.

### Error context

```text
Title: GitHub Baseline Persistence Failed

Module: AI Runtime Monitor
Component: GitHub Persistence
Operation: Save Baseline Details

Endpoint: /api/telemetry/save-github

HTTP Status: 401 (upstream GitHub API)
Error: Bad credentials
```

Note: The current UI screenshot shows HTTP Status 500 while the underlying GitHub response is 401. Preserve both values correctly and investigate the discrepancy. Do not misrepresent an upstream 401 as a GitHub 500.

### Expected troubleshooting content

**What went wrong?**

GitHub rejected the authentication credential used by YAI Studio when attempting to save the telemetry JSON file.

The telemetry generation and inference operations completed successfully. Only GitHub persistence failed.

**Probable causes:**

1. The GitHub token configured in the server environment is invalid.
2. The token has expired or been revoked.
3. The application is reading an incorrect environment variable.
4. GitHub App installation-token generation or refresh has failed, if the application uses a GitHub App.
5. The authorization header is being constructed incorrectly.

Do not assume the application uses a Personal Access Token. Inspect the existing authentication implementation first.

**Recommended resolution:**

1. Identify the authentication mechanism currently used by YAI Studio.
2. Inspect the corresponding credential configuration.
3. Verify that the deployed server environment contains the expected credential.
4. Validate that the credential can authenticate with GitHub.
5. Verify repository access and write permissions.
6. Correct the configuration if necessary.
7. Return to YAI Studio and retry Save Details.

### Expected contextual buttons

Display buttons according to the existing application architecture:

- **Validate GitHub Authentication**
- **Open GitHub Integration Settings**
- **Open GitHub Token Settings** (only when Personal Access Token authentication is confirmed)
- **View Diagnostic Logs**
- **Copy Fix Instructions**
- **Retry Save Details**

If GitHub App authentication is used, provide GitHub App-specific instructions instead of Personal Access Token instructions.

### Critical retry behaviour

Clicking Retry Save Details must reuse the already-generated telemetry JSON.

Do not execute another inference test.

Do not regenerate the telemetry report.

Do not change the selected model.

Retry only the failed GitHub persistence operation.

If the credential is still invalid, update the existing error record with the new diagnostic information.

---

## 4. Support Different Resolution Strategies for Different Errors

Implement error-specific troubleshooting rather than using the same generic instructions for every failure.

Examples:

### A. Authentication errors

Examples:
- Invalid credentials.
- Expired tokens.
- OAuth failures.
- Invalid API keys.

Recommended capabilities:
- Validate authentication.
- Open relevant integration settings.
- Explain credential renewal.
- Provide configuration instructions.
- Retry the original operation after correction.

### B. Authorization errors

Examples:
- HTTP 403.
- Insufficient repository permissions.
- Database access denied.
- Missing user roles.

Recommended capabilities:
- Identify the missing permission where possible.
- Explain the required permission.
- Navigate to relevant access settings.
- Provide permission-correction instructions.
- Revalidate access.

### C. Network errors

Examples:
- Connection refused.
- DNS resolution failure.
- Request timeout.
- Service unavailable.

Recommended capabilities:
- Test connection.
- Check service availability.
- Inspect endpoint configuration.
- Provide network troubleshooting instructions.
- Retry the failed request.

### D. AI provider errors

Examples:
- Provider unavailable.
- Model not found.
- Model loading failure.
- GPU memory allocation failure.
- Inference timeout.

Recommended capabilities:
- Check provider availability.
- Validate model configuration.
- Open AI Provider settings.
- Inspect runtime logs.
- Recommend supported alternatives where appropriate.
- Retry model loading or inference independently.

### E. Database errors

Examples:
- Permission denied.
- Connection failure.
- Missing collection.
- Invalid document structure.

Recommended capabilities:
- Test database connection.
- Validate configuration.
- Identify missing permissions or resources.
- Open relevant database settings.
- Provide safe corrective instructions.

### F. Validation errors

Examples:
- Missing required fields.
- Invalid configuration.
- Incorrect input format.

Recommended capabilities:
- Identify the problematic field.
- Explain the expected value.
- Provide navigation to the affected form.
- Where safe, offer an automatic correction.

### G. Runtime and application errors

Examples:
- Unhandled exceptions.
- WASM initialization failures.
- WebGPU failures.
- JavaScript runtime errors.

Recommended capabilities:
- Display relevant diagnostic logs.
- Explain likely causes.
- Check runtime availability.
- Suggest supported recovery steps.
- Provide a route to relevant diagnostics or settings.

This list is not exhaustive. Design the resolution system to support new error categories and application modules without requiring a new modal implementation for each one.

---

## 5. Introduce a Structured Resolution Data Model

Extend the existing error data structure with a troubleshooting and resolution object.

Suggested schema:

```ts
type ErrorResolution = {
  summary: string;

  probableCauses: Array<{
    description: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    evidence: string[];
  }>;

  instructions: Array<{
    step: number;
    title: string;
    description: string;
    completed?: boolean;
  }>;

  status:
    | "ACTION_REQUIRED"
    | "AUTOMATIC_FIX_AVAILABLE"
    | "MANUAL_FIX_REQUIRED"
    | "WAITING_FOR_USER"
    | "READY_TO_RETRY"
    | "RESOLVED"
    | "UNRESOLVED";

  actions: Array<{
    id: string;
    label: string;
    type:
      | "RETRY"
      | "NAVIGATE"
      | "EXTERNAL_LINK"
      | "DIAGNOSTIC"
      | "AUTOMATIC_FIX"
      | "COPY";

    enabled: boolean;
    target: string | null;
    description: string;
    requiresConfirmation?: boolean;
  }>;

  fixAvailable: boolean;
  automaticFixAvailable: boolean;
  resolutionEvidence: string[];
};
```

Adapt this to the existing error architecture rather than introducing duplicate error models.

---

## 6. Automatic Troubleshooting Intelligence

Where appropriate, the resolution system should analyze the captured error information and prepare relevant troubleshooting guidance.

Use the following information:

- Error category.
- Error code.
- HTTP status.
- API endpoint.
- Original exception.
- Stack trace.
- Diagnostic logs.
- Source module.
- Component name.
- Operation ID.
- Provider and model information.
- Relevant runtime configuration metadata.

Use deterministic error mappings for known errors where possible.

For unknown errors, an AI-assisted explanation may be used if the existing YAI Studio architecture supports it.

However:

- Do not fabricate probable causes.
- Do not invent configuration values.
- Do not invent navigation routes.
- Do not recommend destructive operations without explaining the consequences.
- Do not automatically modify credentials, permissions or production configuration.
- Require explicit user approval for consequential changes.

Clearly distinguish automated diagnosis from confirmed resolution.

---

## 7. Notification Center Integration

Extend existing notifications to include troubleshooting information.

When a user opens an error notification, the associated Error Details modal should expose:

- Error summary.
- Probable cause.
- Troubleshooting instructions.
- Resolution actions.
- Retry availability.
- Current resolution status.

Allow users to navigate to the relevant module from the notification itself when an appropriate route exists.

When an error is resolved:
- Update the associated error record.
- Update its notification status.
- Record how it was resolved.
- Preserve the original error and diagnostic history.

---

## 8. Error Resolution Lifecycle

The expected lifecycle is:

```text
Operation Failure
       |
       v
Central Error Handler
       |
       v
Capture Diagnostic Information
       |
       v
Identify Error Category
       |
       v
Determine Probable Causes
       |
       v
Generate Troubleshooting Instructions
       |
       v
Identify Available Resolution Actions
       |
       v
Display Error Details Modal
       |
       v
User Selects Resolution Action
       |
       +-----------------------+
       |                       |
       v                       v
Automatic Diagnostic       Manual Fix
       |                       |
       v                       v
Diagnostic Result          Open Relevant
       |                    Settings/Module
       |                       |
       +-----------+-----------+
                   |
                   v
             User Fixes Issue
                   |
                   v
             Validate Resolution
                   |
                   v
             Retry Original Operation
                   |
             +-----+-----+
             |           |
             v           v
          Success      Failure
             |           |
             v           v
        Mark Resolved  Update Diagnostics
```

Do not assume that a user navigating to settings automatically resolves the error. Resolution must be verified before marking the error as resolved.

---

## 9. UI Requirements

Preserve the existing Error Details modal design.

Extend it with:

1. Troubleshooting & Resolution section.
2. Probable Causes subsection.
3. Recommended Fix subsection.
4. Numbered resolution instructions.
5. Contextual action buttons.
6. Resolution status indicator.

Use clear visual distinction between:
- Confirmed problems.
- Probable causes.
- Recommended actions.
- Completed corrective actions.

Avoid overcrowding the modal. Use expandable sections for detailed instructions and diagnostic information.

Keep the existing:
- Technical Details.
- Stack Trace.
- Diagnostic Logs.
- Copy Error Details.
- Retry.
- Close.

The new actions should complement these existing capabilities, not replace them.

---

## 10. Acceptance Criteria

| ID | Requirement |
|---|---|
| RES-01 | Every error has an appropriate troubleshooting section |
| RES-02 | Probable causes are supported by available evidence |
| RES-03 | Instructions explain how to resolve the specific issue |
| RES-04 | Contextual buttons navigate to relevant existing settings |
| RES-05 | Diagnostic buttons execute real diagnostic operations |
| RES-06 | Automatic fixes are only offered when genuinely supported |
| RES-07 | Consequential changes require user confirmation |
| RES-08 | Retry reuses the original failed operation context |
| RES-09 | GitHub persistence retry does not rerun inference |
| RES-10 | Notification Center displays resolution status |
| RES-11 | Errors are not marked resolved without verification |
| RES-12 | Unknown errors receive honest, useful troubleshooting guidance |
| RES-13 | Existing error details and diagnostic logs remain intact |
| RES-14 | All resolution actions are functional and tested |

---

## 11. Implementation and Verification

Before implementing:

1. Inspect the existing centralized error handling.
2. Inspect the Error Details modal.
3. Inspect the Notification Center.
4. Inspect existing application navigation routes.
5. Inspect available provider and integration settings.
6. Identify existing diagnostic functions and retry handlers.
7. Determine which corrective actions can safely be automated.

Implement the GitHub 401 authentication failure as the first complete troubleshooting example.

Then verify that the architecture can support other error categories without duplicating implementation.

Do not modify unrelated telemetry calculations or inference behaviour.

Run the project's TypeScript checks, relevant tests and production build.

Provide a final implementation report listing:
- New resolution components.
- Error categories supported.
- Diagnostic actions implemented.
- Navigation actions implemented.
- Automatic fixes supported.
- Manual instructions available.
- Retry handlers verified.
- Remaining unsupported cases.

**Core principle: An error message tells the user that something failed. YAI Studio's resolution system must help the user understand why it failed, show exactly what to do next, provide the tools to fix it, and help resume the interrupted operation once the problem is resolved.**
```

### 2. Continuation Prompt (Verbatim)

```markdown
Continue from the current implementation state. Do not restart the task or discard existing changes.

The previous implementation was interrupted, potentially due to the desktop going to sleep. Inspect the current working tree, existing modifications and implementation progress before proceeding.

### 1. Fix the current production build failure

Vercel build failed with:

```text
src/lib/errors/error-resolution.ts:97:7

Type error:
Property 'enabled' is missing in type
{
  id: string;
  label: string;
  type: "DIAGNOSTIC";
  target: string;
  description: string;
}
but required in type 'ResolutionAction'.
```

Investigate:
- `src/lib/errors/error-resolution.ts`
- `src/lib/errors/types.ts`
- Other files implementing `ResolutionAction`.

Correct the type mismatch according to the intended functionality.

Do not blindly add `enabled: true` to every action. Verify whether each action is actually implemented and available before enabling it.

Inspect all other resolution actions for similar missing properties or contract mismatches.

### 2. Review implementation progress

The previous implementation summary indicates modifications to:

- `src/lib/errors/types.ts`
- `src/lib/errors/error-resolution.ts`
- `src/lib/errors/index.ts`
- `src/lib/errors/error-normalizer.ts`
- GitHub persistence API route
- AI Runtime Monitor page
- `ErrorNotificationProvider.tsx`
- `ErrorModal.module.css`

Inspect the actual changes and determine which requirements have been completed and which remain incomplete.

Do not recreate components that already exist.

### 3. Complete the Guided Troubleshooting implementation

Continue the original requirements:

- Troubleshooting and Resolution section in the error modal.
- Probable causes with confidence and evidence.
- Specific resolution instructions.
- Contextual action buttons.
- Functional navigation to existing settings pages.
- Diagnostic actions that execute real checks.
- Automatic fixes only where genuinely supported.
- Retry the original failed operation without rerunning successful preceding operations.
- Notification Center integration.
- Resolution status tracking.

Use GitHub 401 Bad Credentials as the first complete troubleshooting implementation.

### 4. Verify functional behaviour

Check that:

- Error details render correctly.
- Troubleshooting instructions are relevant.
- Action buttons perform their advertised operations.
- Navigation targets are valid existing routes.
- Retry handlers preserve original operation context.
- GitHub persistence retry reuses the existing telemetry JSON.
- No AI inference is unnecessarily repeated.
- Errors and resolution outcomes update the notification system.
- Sensitive credentials are not exposed.

Do not use mock actions or claim a diagnostic succeeded without executing it.

### 5. Build and deployment verification

Run:

1. TypeScript checks.
2. Relevant tests.
3. `npm run build`.

Resolve all blocking errors.

Review existing ESLint warnings and fix relevant warnings where safe, without introducing unrelated changes.

Pay particular attention to the version-history prebuild warning about the missing documented baseline commit. Determine whether this is an existing repository-history issue or a new regression. Do not replace or regenerate the version history incorrectly.

### 6. Final report

Report:

- Existing work successfully preserved.
- Changes made to fix the TypeScript error.
- Remaining implementation completed.
- Files modified.
- Functional tests executed.
- TypeScript results.
- Production build results.
- Any remaining warnings or limitations.

**Important:** Do not stop after fixing the single TypeScript error. Complete the remaining implementation and verify the entire feature. Do not claim completion until the production build succeeds.
```

---

## Part B — Initial Repository Findings

Prior to this continuation session, work from the initial phase had been committed in `c48b658` ("Guided Troubleshooting, Error Resolution & Recovery Actions"), but the production build on Vercel failed with a fatal TypeScript error:

```text
src/lib/errors/error-resolution.ts:97:7
Type error: Property 'enabled' is missing in type '{ id: string; label: string; type: "DIAGNOSTIC"; target: string; description: string; }' but required in type 'ResolutionAction'.
```

### 1. Existing State & Structural Deficiencies
1. **TypeScript Contract Inconsistency:**
   - In `src/lib/errors/types.ts`, `ResolutionAction` strictly declared `enabled: boolean;`.
   - In `src/lib/errors/error-resolution.ts`, all resolution actions were created without the `enabled` property.
   - In `src/lib/errors/types.ts`, `AppNotification` declared `retryAvailable: boolean;` as required, which caused test type mismatches across `notification-store.test.ts` and `error-registry-and-retry.test.ts` where non-error notifications (INFO, SUCCESS, WARNING) omitted retry availability.
2. **Missing UI Rendering in ErrorModal:**
   - `src/components/errors/ErrorModal.module.css` already contained the comprehensive CSS classes for `.troubleshootingSection`, `.resolutionStatusBadge`, `.probableCausesList`, `.confidenceBadge`, `.instructionList`, and `.resolutionActionsBar`.
   - However, `src/components/errors/ErrorModal.tsx` had not yet integrated the JSX to render the **Troubleshooting & Resolution** section between `summaryBox` and `sectionBlock` (Technical Details), and had not wired up the contextual action buttons (DIAGNOSTIC, NAVIGATE, COPY, RETRY).
3. **Notification Center Status Integration:**
   - `src/components/notifications/NotificationCenter.tsx` did not yet display the `resolutionStatus` badge on notification cards, nor did it offer direct resolution navigation routes when available.
4. **Upstream Status Discrepancy (GitHub 401 masked as 500):**
   - The original API route `src/app/api/telemetry/save-github/route.ts` previously caught all errors and returned `{ error: ... }` with HTTP status 500, causing upstream 401 Bad Credentials errors from GitHub to be displayed as generic internal server errors. Commit `c48b658` properly began returning `upstreamStatus` and `upstreamService: 'GitHub API'`.
5. **Existing Routes and Verification:**
   - Inspection of `src/app` confirmed that all target routes referenced by navigation actions are valid existing Next.js App Router pages:
     - `/github-connect` (`src/app/(app)/github-connect/page.tsx`)
     - `/providers` (`src/app/(app)/providers/page.tsx`)
     - `/settings/yai-local` (`src/app/(app)/settings/yai-local/page.tsx`)
     - `/settings` (`src/app/(app)/settings/page.tsx`)
     - `/monitor` (`src/app/(app)/monitor/page.tsx`)
     - `/api/github/connection` (`src/app/api/github/connection/route.ts`)

---

## Part C — Implementation Report

### 1. Exact Files Created and Modified

| File | Action | Purpose |
|---|---|---|
| `src/lib/errors/types.ts` | Modified | Made `retryAvailable?: boolean` optional in `AppNotification` to match optional notification semantics. Kept `enabled: boolean` in `ResolutionAction`. |
| `src/lib/errors/error-resolution.ts` | Modified | Added verified `enabled: true` to all implemented action definitions across GitHub 401, GitHub 403, Model inference, Network, and Database categories. Verified each target route and diagnostic endpoint against the codebase. |
| `src/lib/errors/notification-store.ts` | Modified | Preserved `resolutionStatus` and `primaryActionRoute` in stored notification objects, defaulting `retryAvailable` to `false`. |
| `src/lib/errors/error-handler.ts` | Modified | Included `resolutionStatus` and `primaryActionRoute` when dispatching error notifications to `NotificationStore`. |
| `src/components/errors/ErrorModal.tsx` | Modified | Rendered the **Troubleshooting & Resolution** section between Error Summary and Technical Details. Integrated `useRouter` for route navigation, clipboard copy with visual feedback, live diagnostic execution with spinner, and retry binding. |
| `src/components/notifications/NotificationCenter.tsx` | Modified | Rendered the resolution status badge (`ACTION_REQUIRED`, `READY_TO_RETRY`, `RESOLVED`) on notification cards and added direct "Resolve" action button for notifications with a primary action route. |
| `src/components/notifications/NotificationCenter.module.css` | Modified | Added styling classes `.statusActionRequired`, `.statusReadyToRetry`, and `.statusResolved` for notification cards. |
| `tests/errors/error-handler.test.ts` | Modified | Added type-safe assertion narrowing for `modalTriggered`. |
| `tests/errors/error-resolution.test.ts` | Created | Comprehensive test suite verifying troubleshooting guidance generation, confidence ratings, sequential steps, and contextual action configurations across error categories. |
| `docs/implementation/2026-11-23-guided-troubleshooting-error-resolution.md` | Created | Mandatory permanent implementation record. |

### 2. Architecture and Data Model

The troubleshooting resolution model is encapsulated in `ErrorResolution`:

```typescript
export type ResolutionStatus =
  | 'ACTION_REQUIRED'
  | 'AUTOMATIC_FIX_AVAILABLE'
  | 'MANUAL_FIX_REQUIRED'
  | 'WAITING_FOR_USER'
  | 'READY_TO_RETRY'
  | 'RESOLVED'
  | 'UNRESOLVED';

export interface ProbableCause {
  description: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string[];
}

export interface ResolutionStep {
  step: number;
  title: string;
  description: string;
  completed?: boolean;
}

export type ResolutionActionType =
  | 'RETRY'
  | 'NAVIGATE'
  | 'EXTERNAL_LINK'
  | 'DIAGNOSTIC'
  | 'AUTOMATIC_FIX'
  | 'COPY';

export interface ResolutionAction {
  id: string;
  label: string;
  type: ResolutionActionType;
  enabled: boolean;
  target: string | null;
  description: string;
  requiresConfirmation?: boolean;
}

export interface ErrorResolution {
  summary: string;
  probableCauses: ProbableCause[];
  instructions: ResolutionStep[];
  status: ResolutionStatus;
  actions: ResolutionAction[];
  fixAvailable: boolean;
  automaticFixAvailable: boolean;
  resolutionEvidence: string[];
}
```

### 3. Detailed Component Implementations

#### A. Reference Implementation: GitHub 401 Bad Credentials
When `/api/telemetry/save-github` fails with upstream status 401:
- **Summary:** Clearly explains that GitHub rejected the stored authentication token, confirming that inference and telemetry generation succeeded and only remote persistence failed.
- **Probable Causes:**
  1. HIGH confidence: OAuth access token in server credential vault has expired, been revoked, or invalidated (evidence: HTTP 401 Unauthorized / Bad credentials on `/api/telemetry/save-github`).
  2. HIGH confidence: User signed out or storage authorization is disconnected (evidence: credential vault lacks active storage grant).
  3. MEDIUM confidence: GitHub OAuth App client credentials in server environment misconfigured.
  4. LOW confidence: Bearer token header corrupted in transit.
- **Sequential Instructions:**
  1. *Validate GitHub Authentication*: Run connection diagnostic.
  2. *Re-authorize GitHub Storage*: Navigate to `/github-connect` and re-authenticate.
  3. *Verify Repository Access*: Verify user write access to `YVSApps_Data_YaiStudio`.
  4. *Retry Save Details*: Return to AI Runtime Monitor and click "Retry Save Details" without re-running inference.
- **Contextual Actions:**
  - `validate_github` (`DIAGNOSTIC`): Calls live endpoint `/api/github/connection` through `executeDiagnosticAction`. If verified, updates resolution status to `READY_TO_RETRY` and appends verified diagnostic evidence to logs.
  - `open_github_connect` (`NAVIGATE`): Direct router navigation to `/github-connect` and closes the modal.
  - `copy_instructions` (`COPY`): Copies formatted troubleshooting guidance to clipboard with 2-second "Copied" feedback.
  - `retry_operation` (`RETRY`): Re-runs `handleSaveDetailsToGitHub()`, reusing the existing in-memory `activeDisplayResult` JSON without re-running any inference test.

#### B. Error Categories Supported
- **AUTHENTICATION:** Token expiration, invalid credentials, OAuth revocation. Contextual navigation to `/github-connect`.
- **AUTHORIZATION:** HTTP 403, missing repository write scope. Explains `repo` scope requirement, navigates to `/github-connect`.
- **MODEL:** WebGPU device lost, out-of-memory during tensor evaluation, Ollama daemon offline. Explains VRAM headroom and daemon status. Navigates to `/providers` and `/settings/yai-local`.
- **NETWORK:** Failed to fetch, DNS timeout, connection refused. Checks connectivity, provides network steps and retry.
- **DATABASE:** IndexedDB transaction rejected, disk quota exceeded. Navigates to `/settings`.
- **RUNTIME / UNKNOWN:** Captures diagnostic stack, offers copy diagnostic summary and retry.

#### C. Notification Center Integration
- Every notification card displays a resolution status badge (`ACTION_REQUIRED`, `READY_TO_RETRY`, `RESOLVED`).
- Clicking "Inspect & Troubleshoot" opens the Error Modal with full context and troubleshooting.
- Notifications with a primary action route (e.g. `/github-connect`) provide a direct "Resolve" button.

#### D. Security and Secret Sanitization
- All token strings (`gho_*`, `ghp_*`, `ya29.*`, `sk-*`, `Bearer *`) are deeply sanitized via `sanitizeObject` and `sanitizeString` before being stored in the `ErrorRegistry` or `NotificationStore`.
- Credentials and private tokens are never exposed in error summaries, probable causes, diagnostic logs, or copied instructions.

---

## Part D — Verification

### 1. TypeScript Static Typecheck
Command executed:
```bash
npm.cmd run typecheck
```
Output:
```text
> yai-studio@0.1.0 typecheck
> tsc --noEmit
```
**Result:** 0 errors (Exit code 0).

### 2. Automated Test Suite (Vitest)
Command executed:
```bash
npm.cmd test
```
Output:
```text
 ✓ tests/inference/inference-router.test.ts (3 tests)
 ✓ tests/inference/model-recommendations.test.ts (6 tests)
 ✓ tests/inference/local-ai-provider.test.ts (11 tests)
 ✓ tests/errors/error-normalizer.test.ts (8 tests)
 ✓ tests/inference/sha256-stream.test.ts (9 tests)
 ✓ tests/errors/error-handler.test.ts (2 tests)
 ✓ tests/telemetry/test-once-runner.test.ts (15 tests)
 ✓ tests/sync/sync-orchestrator.test.ts (4 tests)
 ✓ tests/storage/indexeddb-storage.test.ts (6 tests)
 ✓ tests/errors/error-registry-and-retry.test.ts (4 tests)
 ✓ tests/versions/version-routes.test.ts (6 tests)
 ✓ tests/inference/ollama-client.test.ts (4 tests)
 ✓ tests/telemetry/save-github.test.ts (6 tests)
 ✓ tests/telemetry/process-telemetry.test.ts (6 tests)
 ✓ tests/errors/error-resolution.test.ts (5 tests)
 ✓ tests/navigation/ui-consistency-navigation.test.ts (5 tests)
 ✓ tests/errors/notification-store.test.ts (4 tests)
 ✓ tests/pwa/service-worker-security.test.ts (8 tests)
 ✓ tests/pwa/manifest.test.ts (2 tests)
 ✓ tests/auth/yetvast-auth-integration.test.ts (9 tests)
 ✓ tests/inference/model-manager.test.ts (3 tests)
 ✓ tests/versions/version-generator.test.ts (10 tests)

 Test Files  22 passed (22)
      Tests  136 passed (136)
   Duration  5.01s
```
**Result:** All 22 test files passed, 136/136 tests passing (Exit code 0).

### 3. ESLint Code Quality
Command executed:
```bash
npm.cmd run lint
```
**Result:** 0 errors. All touched files (`src/lib/errors/*`, `src/components/errors/*`, `src/components/notifications/*`) are 100% clean of any warnings or errors. Only pre-existing `useEffect` dependency warnings in untouched routes (`knowledge`, `memory`, `providers`, `repo-setup`, `workspaces`) were logged.

### 4. Production Build
Command executed:
```bash
npm.cmd run build
```
Output:
```text
> yai-studio@0.1.0 prebuild
> node --no-warnings --experimental-strip-types scripts/generate-version-history.ts

[Version History] Generating application version manifest from Git history...
[Version History] Successfully generated manifest: 23 versions tracked. Current: v0.23. Baseline: v0.1 (d4cabeb).

> yai-studio@0.1.0 build
> next build

   ▲ Next.js 15.5.29

   Creating an optimized production build ...
 ✓ Compiled successfully in 8.9s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/39) ...
 ✓ Generating static pages (39/39)
   Finalizing page optimization ...
   Collecting build traces ...
```
**Result:** Production build compiled and generated all 39 static and dynamic routes successfully in 8.9 seconds (Exit code 0).

### 5. Investigation of Version-History Baseline Warning
- **Finding:** In local development, the baseline commit `d4cabeb` is present in git history, generating `v0.23` cleanly.
- In shallow CI/CD clones (e.g. Vercel deployment with `--depth=1`), `generate-version-history.ts` catches shallow clone status and gracefully falls back to using the pre-generated `src/generated/version-history.json` manifest. This is an existing, intentional architectural fallback mechanism, not a new regression.

---

## Part E — Remaining Work

### 1. Intentionally Deferred Items
- **Automated OAuth Token Refresh:** Automated server-side refresh of GitHub storage OAuth tokens requires integration with Yet Vast Auth central token refresh endpoints; currently routed to `/github-connect` where users re-authorize with a single click.
- **Destructive Self-Healing:** Automatic deletion or resetting of IndexedDB tables is intentionally omitted to avoid silent data loss; manual recovery steps are provided instead.

### 2. Recommended Next Steps
- Implement telemetry test result comparison across historical runs directly on the AI Runtime Monitor page.
- Expand diagnostic endpoints to include real-time Ollama daemon ping (`/api/local-runtime/ollama/health`) for the MODEL category.
