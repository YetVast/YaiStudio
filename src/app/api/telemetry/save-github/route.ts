import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import * as gh from '@/lib/github/api-client';
import { DATA_REPO_NAME, verifyRepository } from '@/lib/storage/personal-intelligence-storage';
import type { TestOnceResult } from '@/lib/telemetry/test-runner/types';

/**
 * Format timestamp into YYYYMMDD-HHmmss format.
 */
function formatTimestamp(isoStr?: string): string {
  const d = isoStr ? new Date(isoStr) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = validDate.getFullYear();
  const mm = pad(validDate.getMonth() + 1);
  const dd = pad(validDate.getDate());
  const hh = pad(validDate.getHours());
  const min = pad(validDate.getMinutes());
  const ss = pad(validDate.getSeconds());

  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

/**
 * Sanitize strings for valid filesystem and GitHub path characters.
 */
function sanitizeIdentifier(val: string): string {
  return val
    .toLowerCase()
    .trim()
    .replace(/[/\\:._\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getStoredGitHubToken(session.yvUserId);
  if (!token || !session.githubLogin) {
    return NextResponse.json(
      {
        error:
          'GitHub storage is not connected. Please connect your GitHub data repository in Settings > GitHub Connect to enable saving telemetry.',
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const testExecution = (body?.testExecution || body) as TestOnceResult;

    if (!testExecution || !testExecution.testId || !testExecution.model) {
      return NextResponse.json(
        { error: 'Invalid payload: testExecution object is required.' },
        { status: 400 }
      );
    }

    // 1. Verify user's private data repository
    const ctx = {
      githubToken: token,
      githubLogin: session.githubLogin,
    };

    const repoVerification = await verifyRepository(ctx);
    if (!repoVerification.exists) {
      return NextResponse.json(
        {
          error: `Personal Intelligence repository '${DATA_REPO_NAME}' was not found under @${session.githubLogin}. Please initialize repository in Settings > GitHub Connect.`,
        },
        { status: 404 }
      );
    }

    // 2. Generate descriptive filename and path
    const sanitizedProvider = sanitizeIdentifier(testExecution.model.provider || 'unknown-provider');
    const sanitizedModel = sanitizeIdentifier(testExecution.model.name || 'unknown-model');
    const timestampStr = formatTimestamp(testExecution.execution?.startedAt);

    const filename = `runtime-telemetry-${sanitizedProvider}-${sanitizedModel}-${timestampStr}.json`;
    const directory = 'telemetry-tests';
    const filePath = `${directory}/${filename}`;

    // 3. Prevent accidental overwriting of an existing test record
    const existingFile = await gh.getFile(session.githubLogin, DATA_REPO_NAME, filePath, token);
    if (existingFile !== null) {
      return NextResponse.json(
        {
          error: `A telemetry record with filename '${filename}' already exists in '${DATA_REPO_NAME}/${directory}'. Overwrite is prevented.`,
          filename,
          path: filePath,
        },
        { status: 409 }
      );
    }

    // 4. Serialize complete telemetry record including all metadata
    const recordPayload = {
      testExecutionId: testExecution.testId,
      executionTimestamp: testExecution.execution?.startedAt || new Date().toISOString(),
      activeProvider: testExecution.model.provider,
      selectedModel: testExecution.model.name,
      modelVersion: testExecution.model.version ?? null,
      modelQuantization: testExecution.model.quantization ?? null,
      inferenceBackend: testExecution.model.backend,
      diagnosticQueryPrompt: testExecution.query,
      elapsedDurationMs: testExecution.execution?.durationMs ?? 0,
      execution: testExecution.execution,
      queryResources: testExecution.queryResources,
      measurementCoverage: testExecution.measurementCoverage,
      modelOutputResponse: testExecution.response,
      tokens: testExecution.tokens,
      systemResources: testExecution.systemResources,
      steps: testExecution.steps,
      components: testExecution.components,
      errors: testExecution.errors,
      savedAt: new Date().toISOString(),
      savedBy: {
        userId: session.yvUserId,
        githubLogin: session.githubLogin,
      },
    };

    const jsonContent = JSON.stringify(recordPayload, null, 2);
    const commitMessage = `test(telemetry): record baseline for ${testExecution.model.name} (${filename})`;

    // 5. Commit file directly to user's GitHub repository
    const result = await gh.createFile(
      session.githubLogin,
      DATA_REPO_NAME,
      filePath,
      jsonContent,
      commitMessage,
      token
    );

    const fileUrl = `https://github.com/${encodeURIComponent(session.githubLogin)}/${encodeURIComponent(
      DATA_REPO_NAME
    )}/blob/main/${filePath}`;

    return NextResponse.json({
      success: true,
      filename,
      path: filePath,
      repository: `${session.githubLogin}/${DATA_REPO_NAME}`,
      url: fileUrl,
      sha: result.sha,
    });
  } catch (error: any) {
    console.error('[Telemetry GitHub Save] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save telemetry record to GitHub',
      },
      { status: 500 }
    );
  }
}
