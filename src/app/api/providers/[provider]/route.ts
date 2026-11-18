import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import {
  storeProviderKey,
  deleteProviderKey,
  getProviderKeyStatus,
} from '@/lib/providers/key-store';
import { listOpenRouterModels } from '@/lib/providers/openrouter';
import { listGoogleAIModels } from '@/lib/providers/google-ai';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { provider } = await params;
  if (provider !== 'openrouter' && provider !== 'google-ai') {
    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
  }

  try {
    const body = await request.json();
    const rawKey = body?.key;

    if (!rawKey || typeof rawKey !== 'string') {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // Verify key with provider test call
    try {
      if (provider === 'openrouter') {
        await listOpenRouterModels(rawKey.trim());
      } else if (provider === 'google-ai') {
        await listGoogleAIModels(rawKey.trim());
      }
    } catch (testError) {
      return NextResponse.json(
        {
          error: `Key validation failed with ${provider}: ${testError instanceof Error ? testError.message : 'Invalid key'}`,
        },
        { status: 400 },
      );
    }

    const response = NextResponse.json({
      success: true,
      provider: {
        provider,
        configured: true,
        maskedKey: rawKey.trim().length <= 10 ? '********' : `${rawKey.trim().slice(0, 6)}...${rawKey.trim().slice(-4)}`,
        storedAt: new Date().toISOString(),
      },
    });

    // Store encrypted in server-only persistent vault & attach to response cookie
    await storeProviderKey(session.yvUserId, provider, rawKey.trim(), response);

    return response;
  } catch (error) {
    console.error(`[Provider Key Store ${provider}] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to configure provider key' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { provider } = await params;
  if (provider !== 'openrouter' && provider !== 'google-ai') {
    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
  }

  try {
    const response = NextResponse.json({ success: true, provider, configured: false });
    await deleteProviderKey(session.yvUserId, provider, response);
    return response;
  } catch (error) {
    console.error(`[Provider Key Delete ${provider}] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete provider key' },
      { status: 500 },
    );
  }
}
