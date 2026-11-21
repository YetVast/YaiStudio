# 2026-11-21 — Device Intelligence, Model Recommendations & Local AI Runtime Monitor

## Part A — Original Implementation Prompt

```markdown
# YAI Studio — Device Intelligence, Model Recommendations & Local Runtime Monitor

## Objective

Upgrade YAI Studio's existing Local Setup experience into a comprehensive Device Intelligence and Local AI Runtime Management interface.

The goal is to allow YAI Studio to:

1. Detect and display the hardware and software capabilities of the current device.
2. Identify which local AI inference runtimes are available.
3. Recommend compatible AI models based on device capabilities.
4. Help users understand which models their device can realistically execute.
5. Monitor ongoing AI operations, model loading, inference, and memory consumption.
6. Provide a central Runtime Monitor accessible from the application's top navigation bar.

This must work within the existing YAI Studio architecture. Do not create an unrelated standalone application or replace existing functionality unnecessarily.

---

# PHASE 1 — Inspect and Diagnose Existing Implementation

Before making changes, thoroughly inspect the existing repository.

Investigate:

- Existing Local Setup page and components.
- Current device detection implementation.
- Existing Ollama integration.
- Existing LiteRT-LM integration, if any.
- Model discovery and model metadata.
- Runtime/provider abstraction.
- API routes and server-side processes.
- Existing loading, error and connection states.
- Top navigation component.
- Existing application layout and responsive behavior.
- Existing design tokens and CSS Modules.
- Existing logging and notification mechanisms.

Identify why the current Local Setup UI is not working.

Do not assume that the problem is exclusively frontend-related. Inspect the actual data flow, browser APIs, runtime availability checks, API responses and provider integrations.

Fix existing defects as part of this implementation.

Do not introduce fake device information, mock runtime status or fabricated model compatibility results.

If a capability cannot be detected, explicitly report that it is unavailable.

Prepare a concise implementation plan before editing, then implement the complete feature.

# PHASE 2 — Device Intelligence Dashboard

Transform the Local Setup page into a Device Intelligence dashboard.

## 2.1 Device Information

Display all information that can reliably be detected about the current device.

Organize the information into sections.

### A. Device and Operating System

Display:

- Device/platform name, when available.
- Operating system.
- OS version, when available.
- Browser name and version.
- Browser engine.
- Device type: Desktop, Laptop, Tablet or Mobile, where reliably identifiable.
- Screen resolution.
- Available screen dimensions.
- Device pixel ratio.
- Browser language.
- Time zone.
- Network connection type, when exposed by the browser.
- Online/offline status.

Do not infer an exact device model from unreliable browser user-agent information.

### B. Processor and Compute

Display:

- Logical CPU core count using available browser APIs.
- CPU architecture, if available.
- GPU vendor and renderer, only when accessible through supported APIs.
- WebGPU availability.
- WebGPU adapter information, where available.
- Supported compute backends.
- Hardware acceleration availability.

Do not use deprecated or restricted APIs without checking browser support.

Explain which details are estimated, unavailable or restricted by browser privacy policies.

### C. Memory

Display:

- Total system RAM, if reliably accessible.
- Approximate device memory, where supported.
- Current JavaScript heap usage, where supported.
- JavaScript heap limit, where supported.
- Model/runtime memory consumption, when telemetry is available.
- Available memory information, if the platform exposes it.

IMPORTANT:

Browser JavaScript generally cannot inspect the complete system memory usage of the device.

Do not present JavaScript heap usage as total system RAM usage.

Clearly distinguish:

1. Device memory.
2. Browser/application memory.
3. Model memory.
4. Runtime memory.

Show the source and reliability of each measurement.

For Android native implementations, investigate platform APIs such as ActivityManager.MemoryInfo for additional memory information.

### D. Capability Assessment

Calculate a device capability assessment using available hardware information.

Display:

- Overall device capability classification.
- CPU capability.
- GPU acceleration capability.
- Memory suitability.
- Local inference suitability.
- Potential runtime compatibility.

Use categories such as:

- High capability
- Moderate capability
- Limited capability
- Insufficient information

Do not claim a device is compatible with a model merely because it has sufficient RAM.

Consider runtime support, model format, quantization, context length and accelerator compatibility.

---

# PHASE 3 — AI Model Recommendation Engine

Create a model recommendation section within Local Setup.

The objective is to recommend suitable local models for the detected device.

## 3.1 Model Catalogue

Create a structured model metadata catalogue.

Initially investigate and include relevant models from:

- Google Gemma model families.
- Gemma 3n E2B/E4B.
- Gemma 4 E2B/E4B.
- Other suitable compact open-weight models supported by the selected runtime.

Do not assume every model is supported by LiteRT-LM.

Maintain runtime-specific compatibility information.

Each model entry should contain, where verifiable:

- Model name.
- Model family.
- Provider/developer.
- Parameter classification.
- Model artifact format.
- Quantization.
- Estimated model memory requirement.
- Recommended minimum device memory.
- Supported runtime.
- Supported platform.
- Supported accelerator/backend.
- Context window.
- Multimodal capabilities.
- Model download size.
- Model source/download reference.
- Compatibility status.
- Metadata source and verification date.

Do not invent unsupported specifications.

Keep the catalogue extensible so additional model families and runtimes can be added without changing the recommendation engine.

## 3.2 Model Recommendation Logic

Evaluate available models against:

- Available device memory.
- CPU capabilities.
- GPU/WebGPU support.
- Runtime compatibility.
- Platform compatibility.
- Model artifact compatibility.
- Expected context memory requirements.
- Expected inference performance.

Provide three recommendation categories:

### Recommended

Models expected to provide a reasonable balance between capability and performance on the current device.

### Possible with limitations

Models that may execute but could experience slower inference, memory pressure or reduced context capacity.

### Not recommended

Models that are incompatible or likely to exceed available resources.

Each recommendation must explain WHY the model received that classification.

Example:

Gemma 4 E4B

Status: Recommended

Reasons:
- Compatible model artifact available for the selected runtime.
- Estimated memory requirements are within the configured device budget.
- Supported acceleration backend detected.

Limitations:
- Actual inference speed has not yet been benchmarked.

Do not automatically install or download a model.

Let the user explicitly choose to download, configure or activate a model.

## 3.3 Model Comparison Interface

Provide a comparison view showing:

- Model size.
- Estimated memory requirements.
- Compatibility.
- Expected performance category.
- Context capacity.
- Multimodal support.
- Runtime requirements.

Allow users to compare multiple models.

Clearly distinguish estimated values from measured benchmark results.

---

# PHASE 4 — Runtime and Local Setup Management

The existing Local Setup UI should become the central configuration interface for local AI inference.

Support the existing architecture and investigate these runtimes:

1. LiteRT-LM.
2. Ollama.
3. Additional local runtimes only where justified.

For each runtime, display:

- Runtime name.
- Installation/availability status.
- Version, if accessible.
- Supported platform.
- Connection status.
- Supported execution backend.
- Available models.
- Currently loaded model.
- Runtime health.
- Last health check.
- Error details.

Provide appropriate actions:

- Check availability.
- Connect.
- Disconnect.
- Refresh status.
- View logs.
- Download model, where supported.
- Load model.
- Unload model.
- Run test inference.

Do not assume Ollama can be started from a browser.

If starting or controlling a runtime requires a local service, native application or desktop helper, clearly represent that dependency.

LiteRT-LM should be integrated through its actual supported SDK and platform APIs. Do not simulate LiteRT-LM using an Ollama endpoint.

Maintain a provider-independent inference interface so YAI Studio can use different runtimes without coupling its business logic to one provider.

---

# PHASE 5 — Top Navigation: Ongoing Processes Indicator

Add a dedicated icon to the existing top navigation bar.

Use an appropriate activity/CPU/process icon consistent with the application's existing icon library.

This icon represents the current AI runtime and process activity.

## 5.1 Icon Behaviour

The icon should:

- Always remain accessible in the top navigation.
- Show a neutral state when no operation is running.
- Show an active indicator when inference or model loading is in progress.
- Show an appropriate warning indicator when a process fails.
- Display the number of active operations, where relevant.
- Provide a tooltip explaining the current status.

Clicking the icon should open a dedicated Runtime Monitor screen.

Do not open a small dropdown containing only a few status values. This should lead to a full monitoring interface.

Preserve the existing navigation layout and mobile responsiveness.

---

# PHASE 6 — Runtime Monitor Screen

Create a dedicated screen for ongoing processes and resource monitoring.

This screen should give users visibility into what YAI Studio is doing internally.

## 6.1 Overview

Display summary metrics:

- Current runtime.
- Active model.
- Number of active operations.
- Number of queued operations.
- Number of completed operations in the current session.
- Number of failed operations.
- Current model-loading status.
- Current inference status.
- Runtime health.

## 6.2 Memory Monitoring

Display separate memory metrics:

### Device Memory
- Total RAM, if available.
- Available RAM, if available.
- Estimated memory pressure.

### Application Memory
- Browser/application memory usage, if exposed.
- JavaScript heap usage and limit, if exposed.

### Model Memory
- Loaded model size.
- Estimated model memory allocation.
- Measured model memory usage, if exposed.

### Runtime Memory
- Runtime process memory, if available.
- Runtime-specific memory allocation.
- Memory consumed during model loading and inference.

Use clear labels to distinguish measured, estimated and unavailable metrics.

Never substitute one measurement for another.

## 6.3 Resource Visualizations

Provide useful visual representations:

- Memory utilization.
- Model memory footprint.
- Active operation timeline.
- CPU utilization, if available.
- GPU utilization, if available.
- Inference duration.
- Tokens generated.
- Tokens per second, if available.

Use charts only when actual time-series measurements exist.

Do not fabricate CPU/GPU percentages or memory history.

## 6.4 Active Operations

Create a live list of operations.

Examples:

- Loading Gemma 4 E4B.
- Initializing LiteRT-LM.
- Running inference.
- Processing uploaded document.
- Generating embeddings.
- Executing memory retrieval.
- Synchronizing knowledge.
- Unloading model.

Each operation should display:

- Operation name.
- Operation type.
- Runtime/provider.
- Model.
- Status.
- Start time.
- Duration.
- Progress percentage, only if the operation reports reliable progress.
- Memory usage, if available.
- Current execution stage.
- Error details, if failed.

Support expandable operation details.

## 6.5 Process Details

When a user selects an operation, show:

- Execution lifecycle.
- Timestamped logs.
- Runtime initialization.
- Model loading.
- Prompt preparation.
- Inference execution.
- Token generation.
- Completion.
- Errors and warnings.
- Resource measurements.

Use real execution events and timestamps.

## 6.6 Process Controls

Where technically supported, provide:

- Cancel operation.
- Retry failed operation.
- Unload model.
- Clear completed process history.
- Refresh monitoring data.

Never show controls that do not perform their advertised actions.

Do not allow cancelling operations that cannot actually be cancelled by the underlying runtime.

---

# PHASE 7 — Unified Process Telemetry Architecture

Do not implement monitoring as a collection of unrelated frontend timers.

Introduce a shared process tracking and telemetry architecture.

Create or adapt a common process contract that can represent operations from:

- LiteRT-LM.
- Ollama.
- Cloud inference providers.
- Document processing.
- Embedding generation.
- Memory retrieval.
- Other YAI Studio background tasks.

Suggested conceptual structure:

RuntimeProcess:
- id
- operationType
- operationName
- provider
- runtime
- model
- status
- startedAt
- updatedAt
- completedAt
- progress
- currentStage
- resourceMetrics
- logs
- error

Process status should support:

- QUEUED
- INITIALIZING
- RUNNING
- COMPLETED
- FAILED
- CANCELLING
- CANCELLED

Resource metrics must support unavailable values.

Build the process tracking system so the top navigation indicator and Runtime Monitor screen consume the same source of truth.

Use the existing application architecture and state-management conventions.

For long-running operations, use appropriate event streaming or polling depending on the runtime and existing infrastructure.

Do not create excessive polling or unnecessary browser resource consumption.

Make monitoring resilient to navigation changes and component unmounting.

Where runtime telemetry is not exposed, report that limitation instead of inventing measurements.

---

# PHASE 8 — UI/UX Requirements

Follow the existing YAI Studio visual language.

Requirements:

- Use existing YVS design tokens.
- Use CSS Modules.
- Do not introduce Tailwind CSS.
- Preserve existing navigation and layouts.
- Support light and dark themes.
- Fully responsive desktop and mobile layouts.
- Use consistent spacing, typography, borders and status indicators.
- Provide clear loading, empty, unavailable and error states.
- Avoid excessive decorative cards.
- Use expandable sections for technical details.
- Keep the main information easy to understand while allowing technical users to inspect deeper details.

The interface should feel like a professional AI infrastructure monitoring dashboard, not a generic device-settings page.

---

# PHASE 9 — Security and Privacy

Device information and runtime telemetry should be treated as sensitive technical information.

- Do not expose device telemetry to other users.
- Do not store device details in Firestore unless there is a clear product requirement.
- Do not collect unnecessary device fingerprints.
- Do not expose environment variables, API keys or runtime credentials in logs.
- Do not send local device telemetry to cloud providers without an explicit product requirement and appropriate user consent.
- Keep local model operations local when the selected inference mode is local.
- Clearly identify when a task is routed to cloud inference.

---

# PHASE 10 — Testing and Acceptance Criteria

Verify the complete feature.

### Device Detection
- Test supported browser APIs.
- Test unavailable APIs.
- Test mobile and desktop.
- Ensure unsupported properties are displayed as unavailable.
- Verify that memory metrics are correctly labelled.

### Model Recommendations
- Test multiple hardware capability profiles.
- Verify model/runtime compatibility.
- Verify memory-budget calculations.
- Ensure incompatible models are not recommended.
- Ensure recommendation reasons are visible.

### Runtime Setup
- Verify actual runtime availability.
- Verify model discovery.
- Verify model loading and unloading.
- Verify test inference.
- Verify error handling.

### Runtime Monitor
- Verify that real operations appear in the monitor.
- Verify status transitions.
- Verify logs and timestamps.
- Verify memory metrics.
- Verify that unavailable metrics are handled correctly.
- Verify navigation does not reset active process tracking.
- Verify cancellation and retry where supported.

### Application Quality
- Run TypeScript type checking.
- Run relevant automated tests.
- Run production build.
- Fix regressions introduced by the implementation.
- Verify existing authentication and application navigation remain intact.

---

# Expected Deliverables

1. Fixed and upgraded Local Setup page.
2. Device Intelligence dashboard.
3. Model recommendation engine.
4. Structured model catalogue.
5. Runtime configuration and health information.
6. Top navigation ongoing-process indicator.
7. Dedicated Runtime Monitor screen.
8. Shared process tracking and telemetry system.
9. Documentation explaining available device capabilities and platform limitations.
10. Tests and implementation summary.
```

---

## Part B — Initial Repository Findings

### 1. Existing Local Setup Implementation & Root Causes of Failure
- The previous Local Setup page (`src/app/(app)/settings/yai-local/page.tsx`) suffered from several architectural defects:
  1. **All-or-Nothing Support Lockout**: In `device-capabilities.ts`, missing WebGPU or free storage under 2.5 GB immediately pushed to `unsupportedReasons` and set `isSupported = false`. This forced the entire Local AI state in `local-ai-config.ts` into `'device_unsupported'`, locking the user out even when WebAssembly SIMD or native Ollama runtimes were available.
  2. **Deprecated & Fragile WebGPU Probing**: Probing only accessed `adapter.info`, which is undefined in some browsers without calling `adapter.requestAdapterInfo()`, causing missing GPU adapter metadata.
  3. **Broken Model Download Actions**: In `LOCAL_MODEL_CATALOG`, legacy models (`gemma-2-2b-it-int4`, `gemma-2b-it-int4`) had empty `downloadUrl` and empty `sha256` strings. The UI nonetheless presented active "Download" buttons that immediately threw unhandled rejections on click.
  4. **Permanently Blocked Test Inference**: The default active model was set to `gemma-2-2b-it-int4`, which could not be downloaded. As a result, the inference test was permanently blocked with the message *"No local model is downloaded and ready"*.
  5. **Fabricated Telemetry**: `litert-engine.ts` hardcoded mock telemetry (`memoryUsageMb: 850`) instead of reporting real or unavailable values.
  6. **Zero Ollama Support**: Ollama was completely absent from the codebase, leaving LiteRT-LM as the sole provider without runtime selection or status discovery.
  7. **No Central Process Monitoring**: There was no persistent telemetry system, no Ongoing Processes indicator in the global navigation bar, and no dedicated Runtime Monitor screen.

---

## Part C — Implementation Report

### 1. Unified Process Telemetry Architecture (`src/lib/telemetry/`)
- **`src/lib/telemetry/types.ts`**: Standardized contract for `RuntimeProcess`, statuses (`QUEUED`, `INITIALIZING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLING`, `CANCELLED`), process types (`model-download`, `model-load`, `model-unload`, `inference`, `health-check`), timestamped logs, and resource metrics (`jsHeapUsedMb`, `durationMs`, `tokensPerSec`, `tokensGenerated`).
- **`src/lib/telemetry/process-telemetry.ts`**: Singleton `ProcessTelemetryManager` providing thread-safe lifecycle tracking, cancellation and retry handlers, and accurate JavaScript heap sampling via `performance.memory` without fabricating device RAM.
- **`src/lib/telemetry/telemetry-context.tsx`**: React Context provider exposing active operations, summary metrics, and process controls.

### 2. Comprehensive Device Intelligence Dashboard (`src/lib/inference/device-capabilities.ts`)
- **Device & Operating System**: Reliably probes Platform (Windows, macOS, Linux, Android, iOS), Browser Engine (Blink, Gecko, WebKit), Device Type (Desktop, Laptop, Tablet, Mobile), Screen Resolution, Available Dimensions, Device Pixel Ratio, Language, Time Zone, Network Connection (effective type, downlink, RTT), and Online Status.
- **Processor & Compute**: Probes Logical CPU Cores (`hardwareConcurrency`), WebGPU adapter info and limits (`maxBufferSize`, `maxStorageBufferBindingSize`), WebGL unmasked renderer fallback, supported compute backends (`WebGPU`, `WebAssembly SIMD`, `WebGL`, `CPU`), and hardware acceleration tier.
- **Memory Telemetry**: Strictly distinguishes:
  1. *Device Memory*: `navigator.deviceMemory` (approximate host RAM, quantized to prevent fingerprinting).
  2. *Application Memory*: `performance.memory` (JS heap used and heap limit in Chromium).
  3. *Model & Runtime Memory*: VRAM consumed by loaded models (via Ollama `/api/ps` or LiteRT-LM).
  4. *Platform Limitation Notes*: Explicitly notes that browser JavaScript cannot inspect complete host OS memory and references native Android `ActivityManager.MemoryInfo`.
- **Capability Assessment**: Classifies overall device capability (`High capability`, `Moderate capability`, `Limited capability`, `Insufficient information`), CPU capability, GPU capability, memory suitability, and local inference suitability with explicit reasons and limitations.

### 3. Structured Model Catalogue & Recommendation Engine (`src/lib/inference/model-catalogue.ts`)
- Implemented `EXTENDED_MODEL_CATALOGUE` covering:
  - Google Gemma 4 E2B Instruct (LiteRT-LM WebGPU / Ollama, 2.0 GB) with authoritative SHA-256.
  - Google Gemma 4 E4B Instruct (LiteRT-LM WebGPU / Ollama, 3.9 GB).
  - Google Gemma 3n E2B (Edge / Mobile optimized, 1.8 GB).
  - Google Gemma 3n E4B (Edge / Mobile balanced, 3.4 GB).
  - IBM Granite 4.0 350M (LiteRT-LM WebGPU, 468 MB) with authoritative SHA-256.
  - Meta Llama 3.2 1B & 3B (Ollama GGUF).
  - Alibaba Qwen 2.5 1.5B (Ollama GGUF, 32K context).
  - Google Gemma 2 9B (Ollama high-capacity).
- **Recommendation Logic**: Evaluates detected device capabilities (RAM, CPU cores, WebGPU, disk space, active runtime) to classify models into `recommended`, `possible_with_limitations`, or `not_recommended` with detailed reasons and limitations.
- **Model Comparison**: Implemented side-by-side comparison across artifact formats, download sizes, RAM budgets, context windows, and expected throughput.

### 4. Multi-Runtime Abstraction & Management
- **LiteRT-LM**: Integrated in-browser runtime using WebGPU and sandboxed OPFS streaming download with incremental SHA-256 validation.
- **Ollama**:
  - `src/app/api/local-runtime/ollama/[action]/route.ts`: Secure server-side proxy route to `http://127.0.0.1:11434` for `/health`, `/tags`, `/ps`, `/generate`, and `/unload` with zero browser CORS barriers.
  - `src/lib/inference/runtimes/ollama-client.ts`: Client library providing health probing, model listing, running model inspection, model unloading (`keep_alive: 0`), and inference generation with live telemetry.

### 5. Top Navigation: Ongoing Processes Indicator (`src/components/telemetry/ProcessIndicator.tsx`)
- Integrated in `AppShell.tsx` header right.
- Shows neutral idle icon, pulsating active indicator with numerical badge when operations are running, and warning indicator on failures.
- Dynamic accessible tooltip showing real-time operation names.
- One-click navigation to `/monitor`.

### 6. Dedicated Runtime Monitor Screen (`src/app/(app)/monitor/page.tsx`)
- Overview metrics: Active runtime, active model, active ops, queued ops, completed ops, failed ops, runtime health.
- Memory Telemetry: Device RAM, JS Heap used/limit, Model VRAM, and Storage free space with `[Measured]`, `[Estimated]`, and `[Restricted]` pills.
- Live Operations List: Real-time progress bars, expandable execution lifecycle, timestamped logs, and process controls (cancel, retry, unload model, clear completed, refresh).

### 7. Upgraded Local Setup Page (`src/app/(app)/settings/yai-local/page.tsx`)
- Strictly preserved all 6 required collapsible section titles and order:
  1. `1. PWA Information & Installation Status`
  2. `2. Device Compatibility & Hardware Runtime` (Upgraded to full Device Intelligence Dashboard)
  3. `3. Local AI Onboarding Process`
  4. `4. Local Model Management` (Upgraded with Model Catalogue, Recommendations, Comparison & Multi-Runtime manager)
  5. `5. Local Inference Testing`
  6. `6. Privacy & Inference Configuration`

---

## Part D — Verification

### 1. Automated Test Suites Executed
- Executed full Vitest suite:
  - `tests/navigation/ui-consistency-navigation.test.ts` (5 tests passed)
  - `tests/telemetry/process-telemetry.test.ts` (6 tests passed)
  - `tests/inference/model-recommendations.test.ts` (6 tests passed)
  - `tests/inference/ollama-client.test.ts` (4 tests passed)
  - `tests/inference/sha256-stream.test.ts` (9 tests passed)
  - `tests/pwa/manifest.test.ts` (2 tests passed)
  - `tests/pwa/service-worker-security.test.ts` (8 tests passed)
  - `tests/inference/inference-router.test.ts` (3 tests passed)
  - `tests/inference/local-ai-provider.test.ts` (11 tests passed)
  - `tests/sync/sync-orchestrator.test.ts` (4 tests passed)
  - `tests/storage/indexeddb-storage.test.ts` (6 tests passed)
  - `tests/versions/version-routes.test.ts` (6 tests passed)
  - `tests/auth/yetvast-auth-integration.test.ts` (9 tests passed)
  - `tests/inference/model-manager.test.ts` (3 tests passed)
  - `tests/versions/version-generator.test.ts` (10 tests passed)
- Total: **15 test files, 92 tests, 0 failures**.

### 2. TypeScript Static Typecheck
- Executed `npm run typecheck` (`tsc --noEmit`):
  - Result: **0 errors, clean exit**.

### 3. Linter Results
- Executed `npm run lint` (`next lint`):
  - Result: **0 errors, 3 pre-existing exhaustive-deps warnings in unrelated pages**.

### 4. Production Build Results
- Executed `npm run build` (`next build`):
  - Version history manifest generated deterministically: `16 versions tracked, Current: v0.16, Baseline: v0.1 (d4cabeb)`.
  - Compiled and built all routes including `/monitor`, `/settings/yai-local`, and `/api/local-runtime/ollama/[action]`.

---

## Part E — Remaining Work

### 1. Known Platform Constraints
- Web Crypto API requires full ArrayBuffer in RAM for SHA-256 verification (no streaming SubtleCrypto update/finalize API exists in the browser specification).
- Total system RAM inspection is intentionally restricted by web browser security policies (`navigator.deviceMemory` is quantized to protect against fingerprinting).
- Ollama requires the user to run the native Ollama service locally at `127.0.0.1:11434`.

### 2. Recommended Next Steps
- Implement WebGPU compute performance micro-benchmarking to dynamically measure raw FLOPS/memory bandwidth before model download.
- Add support for Web Worker offloading for LiteRT-LM tensor computation to prevent UI thread stuttering during large prompt prefill.
