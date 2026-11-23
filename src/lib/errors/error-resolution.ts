/**
 * YAI Studio — Intelligent Error Troubleshooting & Resolution Engine
 *
 * Synthesizes captured diagnostics, HTTP status, upstream service details,
 * and operation context to generate structured troubleshooting guidance,
 * probable causes, sequential resolution steps, and contextual action buttons.
 */

import type {
  ApplicationError,
  ErrorResolution,
  ProbableCause,
  ResolutionStep,
  ResolutionAction,
  ResolutionStatus,
} from './types';

/**
 * Generate structured troubleshooting and resolution guidance for an ApplicationError.
 */
export function generateErrorResolution(
  error: ApplicationError,
  custom?: Partial<ErrorResolution>
): ErrorResolution {
  const { category, details, source, logs, retry } = error;
  const httpStatus = details.httpStatus;
  const upstreamStatus = details.upstreamStatus ?? httpStatus;
  const upstreamService = details.upstreamService || '';
  const endpoint = details.endpoint || '';
  const rawMsg = (details.originalMessage || error.message || '').toLowerCase();
  const moduleName = source.module.toLowerCase();
  const operationName = source.operation.toLowerCase();

  // ─── 1. Reference Implementation: GitHub 401 / Persistence Failure ───
  const isGitHubAuthError =
    (endpoint.includes('save-github') || upstreamService.includes('GitHub') || moduleName.includes('github') || rawMsg.includes('bad credentials')) &&
    (upstreamStatus === 401 || httpStatus === 401 || category === 'AUTHENTICATION');

  if (isGitHubAuthError) {
    const probableCauses: ProbableCause[] = [
      {
        description: 'The GitHub OAuth access token stored in the server credential vault has expired, been revoked, or invalidated.',
        confidence: 'HIGH',
        evidence: [
          `HTTP 401 Unauthorized / Bad credentials returned by upstream GitHub API`,
          `Endpoint: ${endpoint || '/api/telemetry/save-github'}`,
        ],
      },
      {
        description: 'The application’s GitHub storage OAuth authorization is missing, disconnected, or user signed out of GitHub.',
        confidence: 'HIGH',
        evidence: [
          `Encrypted credential vault lacks valid active storage grant for repository CRUD`,
          `User session requires re-authentication in GitHub Connect`,
        ],
      },
      {
        description: 'GitHub OAuth App credentials (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET) in the server environment are misconfigured.',
        confidence: 'MEDIUM',
        evidence: [
          `Upstream GitHub authorization handshake rejected token authorization grant`,
        ],
      },
      {
        description: 'Authorization header Bearer token was constructed incorrectly or corrupted in transit.',
        confidence: 'LOW',
        evidence: [
          `GitHub API responded with 401 Bad credentials rather than 400 Bad Request`,
        ],
      },
    ];

    const instructions: ResolutionStep[] = [
      {
        step: 1,
        title: 'Validate GitHub Authentication',
        description: 'Click "Validate GitHub Authentication" below to run a non-destructive diagnostic check against /api/github/connection and test current token health.',
      },
      {
        step: 2,
        title: 'Re-authorize GitHub Storage',
        description: 'Click "Open GitHub Integration Settings" to navigate to /github-connect and re-authenticate your GitHub account. This issues a fresh encrypted access token with the required "repo" scope.',
      },
      {
        step: 3,
        title: 'Verify Repository Access',
        description: 'Ensure your GitHub account has write access to your private data repository named "YVSApps_Data_YaiStudio".',
      },
      {
        step: 4,
        title: 'Retry Save Details',
        description: 'Return to AI Runtime Monitor and click "Retry Save Details". The system will immediately reuse your already-generated telemetry JSON without re-running any inference test.',
      },
    ];

    const actions: ResolutionAction[] = [
      {
        id: 'validate_github',
        label: 'Validate GitHub Authentication',
        type: 'DIAGNOSTIC',
        enabled: true,
        target: '/api/github/connection',
        description: 'Run connection diagnostic against /api/github/connection to test token health.',
      },
      {
        id: 'open_github_connect',
        label: 'Open GitHub Integration Settings',
        type: 'NAVIGATE',
        enabled: true,
        target: '/github-connect',
        description: 'Navigate to GitHub Connect to re-authenticate and refresh storage authorization.',
      },
      {
        id: 'copy_instructions',
        label: 'Copy Fix Instructions',
        type: 'COPY',
        enabled: true,
        target: null,
        description: 'Copy sequential troubleshooting steps to clipboard.',
      },
    ];

    if (retry.available) {
      actions.push({
        id: 'retry_operation',
        label: 'Retry Save Details',
        type: 'RETRY',
        enabled: true,
        target: null,
        description: 'Re-save the existing telemetry JSON to GitHub without re-running model inference.',
      });
    }

    return {
      summary:
        'GitHub rejected the authentication credential used by YAI Studio when attempting to save the telemetry JSON file. The telemetry generation and inference operations completed successfully. Only GitHub persistence failed.',
      probableCauses,
      instructions,
      status: 'ACTION_REQUIRED',
      actions,
      fixAvailable: true,
      automaticFixAvailable: false,
      resolutionEvidence: [
        `Upstream Service: GitHub REST Contents API`,
        `HTTP Status: 401 Unauthorized (Bad credentials)`,
        `Target Directory: telemetry-tests/ in YVSApps_Data_YaiStudio`,
      ],
      ...custom,
    };
  }

  // ─── 2. GitHub 403 / Authorization (Permission Denied) ────────
  const isGitHubForbidden =
    (endpoint.includes('save-github') || upstreamService.includes('GitHub') || rawMsg.includes('forbidden')) &&
    (upstreamStatus === 403 || httpStatus === 403 || category === 'AUTHORIZATION');

  if (isGitHubForbidden) {
    const probableCauses: ProbableCause[] = [
      {
        description: 'The authenticated GitHub token lacks the "repo" scope required to create or modify files in private repositories.',
        confidence: 'HIGH',
        evidence: [`GitHub API returned HTTP 403 Forbidden for repository contents endpoint`],
      },
      {
        description: 'Organization OAuth App restrictions or SAML SSO enforcement blocking third-party API writes.',
        confidence: 'MEDIUM',
        evidence: [`Repository belongs to an organization with third-party application restrictions`],
      },
    ];

    const instructions: ResolutionStep[] = [
      {
        step: 1,
        title: 'Run Diagnostic Check',
        description: 'Run connection diagnostic to check if repository YVSApps_Data_YaiStudio exists and is write-accessible.',
      },
      {
        step: 2,
        title: 'Re-connect with Repo Scope',
        description: 'Navigate to GitHub Connect and re-authorize storage, ensuring the "repo" permission is granted.',
      },
      {
        step: 3,
        title: 'Retry Save Details',
        description: 'Click "Retry Save Details" to persist the pre-computed telemetry JSON.',
      },
    ];

    const actions: ResolutionAction[] = [
      {
        id: 'validate_github',
        label: 'Validate GitHub Authentication',
        type: 'DIAGNOSTIC',
        enabled: true,
        target: '/api/github/connection',
        description: 'Test repository write access and token scope.',
      },
      {
        id: 'open_github_connect',
        label: 'Open GitHub Integration Settings',
        type: 'NAVIGATE',
        enabled: true,
        target: '/github-connect',
        description: 'Navigate to GitHub Connect to re-grant repo permissions.',
      },
      {
        id: 'copy_instructions',
        label: 'Copy Fix Instructions',
        type: 'COPY',
        enabled: true,
        target: null,
        description: 'Copy sequential troubleshooting steps to clipboard.',
      },
    ];

    if (retry.available) {
      actions.push({
        id: 'retry_operation',
        label: 'Retry Save Details',
        type: 'RETRY',
        enabled: true,
        target: null,
        description: 'Re-save the existing telemetry JSON without re-running inference.',
      });
    }

    return {
      summary:
        'GitHub rejected write access to repository "YVSApps_Data_YaiStudio". The authenticated account lacks sufficient write permissions or the OAuth token lacks the "repo" scope.',
      probableCauses,
      instructions,
      status: 'ACTION_REQUIRED',
      actions,
      fixAvailable: true,
      automaticFixAvailable: false,
      resolutionEvidence: [`HTTP 403 Forbidden on GitHub Contents API`],
      ...custom,
    };
  }

  // ─── 3. AI Model Inference Failures (Category: MODEL) ─────────
  if (category === 'MODEL' || rawMsg.includes('inference') || rawMsg.includes('litert') || rawMsg.includes('ollama')) {
    const probableCauses: ProbableCause[] = [
      {
        description: 'Insufficient WebGPU / GPU VRAM or host memory headroom during tensor evaluation and KV-cache allocation.',
        confidence: 'HIGH',
        evidence: [`Model runtime terminated during token generation or prompt processing`],
      },
      {
        description: 'Model weights file is missing, incomplete, or failed SHA-256 integrity verification.',
        confidence: 'MEDIUM',
        evidence: [`Local model descriptor load failed or model storage binary corrupted`],
      },
      {
        description: 'If using Ollama, the local Ollama daemon service on localhost:11434 is stopped or unreachable.',
        confidence: 'MEDIUM',
        evidence: [`Socket connection to http://localhost:11434 refused`],
      },
    ];

    const instructions: ResolutionStep[] = [
      {
        step: 1,
        title: 'Check Device Capabilities & Memory',
        description: 'Open AI Runtime Monitor and Device Intelligence to check whether your GPU and system RAM meet the model requirements.',
      },
      {
        step: 2,
        title: 'Verify Model Download & Integrity',
        description: 'Navigate to AI Providers > Local Models to verify that model weights are fully installed and verified.',
      },
      {
        step: 3,
        title: 'Ensure Local Daemon is Running',
        description: 'If running via Ollama, open terminal and run "ollama serve" to ensure the local daemon is active.',
      },
      {
        step: 4,
        title: 'Retry Inference Test',
        description: 'Click "Retry" to re-execute prompt evaluation with the active runtime.',
      },
    ];

    const actions: ResolutionAction[] = [
      {
        id: 'open_providers',
        label: 'Open AI Provider Settings',
        type: 'NAVIGATE',
        enabled: true,
        target: '/providers',
        description: 'Inspect configured AI providers, model catalogs, and Ollama status.',
      },
      {
        id: 'open_device_intel',
        label: 'Device Intelligence & Setup',
        type: 'NAVIGATE',
        enabled: true,
        target: '/settings/yai-local',
        description: 'Inspect device WebGPU suitability, quantization, and memory headroom.',
      },
      {
        id: 'copy_instructions',
        label: 'Copy Fix Instructions',
        type: 'COPY',
        enabled: true,
        target: null,
        description: 'Copy sequential troubleshooting steps to clipboard.',
      },
    ];

    if (retry.available) {
      actions.push({
        id: 'retry_operation',
        label: 'Retry Inference Test',
        type: 'RETRY',
        enabled: true,
        target: null,
        description: 'Retry prompt evaluation on the selected model.',
      });
    }

    return {
      summary:
        'The configured AI model runtime encountered an error during inference. Token generation could not complete on the current hardware configuration.',
      probableCauses,
      instructions,
      status: 'ACTION_REQUIRED',
      actions,
      fixAvailable: true,
      automaticFixAvailable: false,
      resolutionEvidence: [`Model Runtime: ${details.model || 'Local Runtime'}`],
      ...custom,
    };
  }

  // ─── 4. Network Failures (Category: NETWORK) ──────────────────
  if (category === 'NETWORK' || rawMsg.includes('failed to fetch') || rawMsg.includes('timeout')) {
    const probableCauses: ProbableCause[] = [
      {
        description: 'Client device is offline, experiencing intermittent packet loss, or DNS resolution failed.',
        confidence: 'HIGH',
        evidence: [`TypeError: Failed to fetch or socket timeout during network request`],
      },
      {
        description: 'Target service or local daemon is stopped or not listening on configured port.',
        confidence: 'MEDIUM',
        evidence: [`Connection refused on destination host/port`],
      },
    ];

    const instructions: ResolutionStep[] = [
      {
        step: 1,
        title: 'Verify Internet & Network Connection',
        description: 'Ensure your device has an active network connection and can reach external domains.',
      },
      {
        step: 2,
        title: 'Check Local Daemon Ports',
        description: 'If communicating with a local server, ensure the service is listening on the expected port.',
      },
      {
        step: 3,
        title: 'Retry Request',
        description: 'Click "Retry" once network connectivity is restored.',
      },
    ];

    const actions: ResolutionAction[] = [
      {
        id: 'copy_instructions',
        label: 'Copy Fix Instructions',
        type: 'COPY',
        enabled: true,
        target: null,
        description: 'Copy sequential troubleshooting steps to clipboard.',
      },
    ];

    if (retry.available) {
      actions.push({
        id: 'retry_operation',
        label: 'Retry Request',
        type: 'RETRY',
        enabled: true,
        target: null,
        description: 'Re-send the network request.',
      });
    }

    return {
      summary:
        'Unable to establish a connection to the remote endpoint. The network request failed or timed out before receiving a response.',
      probableCauses,
      instructions,
      status: 'ACTION_REQUIRED',
      actions,
      fixAvailable: true,
      automaticFixAvailable: false,
      resolutionEvidence: [`Endpoint: ${endpoint || 'Remote Server'}`],
      ...custom,
    };
  }

  // ─── 5. Database & Local Storage Errors (Category: DATABASE) ──
  if (category === 'DATABASE' || rawMsg.includes('indexeddb') || rawMsg.includes('dexie') || rawMsg.includes('quota')) {
    const probableCauses: ProbableCause[] = [
      {
        description: 'Browser disk space quota exceeded or storage permission restricted.',
        confidence: 'HIGH',
        evidence: [`IndexedDB transaction rejected or disk quota constrained`],
      },
      {
        description: 'Private browsing mode or privacy extension restricting persistent storage access.',
        confidence: 'MEDIUM',
        evidence: [`Database connection dropped or storage blocked in private window`],
      },
    ];

    const instructions: ResolutionStep[] = [
      {
        step: 1,
        title: 'Check Disk Space',
        description: 'Ensure sufficient disk space is free on your device for client-side storage.',
      },
      {
        step: 2,
        title: 'Inspect Storage Diagnostics',
        description: 'Navigate to Settings to view storage quota, database health, and sync status.',
      },
      {
        step: 3,
        title: 'Reload YAI Studio',
        description: 'Reload the application to allow IndexedDB connections to cleanly re-establish.',
      },
    ];

    const actions: ResolutionAction[] = [
      {
        id: 'open_settings',
        label: 'Open Settings & Storage',
        type: 'NAVIGATE',
        enabled: true,
        target: '/settings',
        description: 'Inspect storage usage and database status in Settings.',
      },
      {
        id: 'copy_instructions',
        label: 'Copy Fix Instructions',
        type: 'COPY',
        enabled: true,
        target: null,
        description: 'Copy sequential troubleshooting steps to clipboard.',
      },
    ];

    if (retry.available) {
      actions.push({
        id: 'retry_operation',
        label: 'Retry Database Operation',
        type: 'RETRY',
        enabled: true,
        target: null,
        description: 'Re-attempt the failed database operation.',
      });
    }

    return {
      summary:
        'Client-side IndexedDB storage encountered an error accessing user intelligence tables. Data could not be read or persisted.',
      probableCauses,
      instructions,
      status: 'ACTION_REQUIRED',
      actions,
      fixAvailable: true,
      automaticFixAvailable: false,
      resolutionEvidence: [`Storage System: IndexedDB / Dexie`],
      ...custom,
    };
  }

  // ─── 6. Fallback / General Runtime Resolution ─────────────────
  const probableCauses: ProbableCause[] = [
    {
      description: 'An unexpected runtime condition or unhandled exception interrupted execution.',
      confidence: 'MEDIUM',
      evidence: [
        `Module: ${source.module}`,
        `Operation: ${source.operation}`,
        `Original Message: ${details.originalMessage || error.message}`,
      ],
    },
  ];

  const instructions: ResolutionStep[] = [
    {
      step: 1,
      title: 'Inspect Diagnostic Logs',
      description: 'Review the technical diagnostic logs below to pinpoint the failure origin.',
    },
    {
      step: 2,
      title: 'Copy Diagnostic Summary',
      description: 'Copy error diagnostics to your clipboard for inspection or sharing with support.',
    },
    {
      step: 3,
      title: 'Retry Operation',
      description: 'Click "Retry" if this failure may be transient or network-related.',
    },
  ];

  const actions: ResolutionAction[] = [
    {
      id: 'copy_instructions',
      label: 'Copy Fix Instructions',
      type: 'COPY',
      enabled: true,
      target: null,
      description: 'Copy sequential troubleshooting steps to clipboard.',
    },
  ];

  if (retry.available) {
    actions.push({
      id: 'retry_operation',
      label: 'Retry Operation',
      type: 'RETRY',
      enabled: true,
      target: null,
      description: 'Retry the failed operation with original parameters.',
    });
  }

  return {
    summary:
      error.message || 'An unexpected failure occurred while executing this application operation.',
    probableCauses,
    instructions,
    status: 'MANUAL_FIX_REQUIRED',
    actions,
    fixAvailable: retry.available,
    automaticFixAvailable: false,
    resolutionEvidence: [`Captured Error ID: ${error.id}`],
    ...custom,
  };
}
