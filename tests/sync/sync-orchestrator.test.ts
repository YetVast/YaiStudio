import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YaiDatabase, resetYaiDatabase } from '@/lib/storage/client/db';
import { ClientStorageAdapter } from '@/lib/storage/client/storage-adapter';
import { SyncOrchestrator } from '@/lib/sync/sync-orchestrator';

describe('Milestone 4 — Mutation Queue and Sync Orchestrator', () => {
  let db: YaiDatabase;
  let adapter: ClientStorageAdapter;
  let orchestrator: SyncOrchestrator;
  const testDbName = 'test-yai-sync-db';

  beforeEach(() => {
    db = new YaiDatabase(testDbName);
    adapter = new ClientStorageAdapter(db);
    orchestrator = new SyncOrchestrator(adapter);
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(async () => {
    orchestrator.stopAutoSync();
    await resetYaiDatabase(db);
    vi.restoreAllMocks();
  });

  it('successfully synchronizes pending conversation creation mutation', async () => {
    // 1. Enqueue offline mutation
    const mutation = await adapter.enqueueMutation(
      'conversation',
      'c-123',
      'create',
      { title: 'Offline sync test' }
    );

    expect(mutation.status).toBe('pending');

    // 2. Mock successful remote API call
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'c-123', title: 'Offline sync test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // 3. Execute sync
    const result = await orchestrator.syncNow();
    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);

    // Verify remote API was invoked with correct payload
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/conversations',
      expect.objectContaining({
        method: 'POST',
      })
    );

    // Verify mutation was dequeued upon success
    const remaining = await adapter.getPendingMutations();
    expect(remaining.length).toBe(0);
  });

  it('marks mutation as conflict when remote returns 409 Conflict', async () => {
    const mutation = await adapter.enqueueMutation(
      'conversation',
      'c-diverged',
      'update',
      { title: 'Local title edit', metaSha: 'old-sha' }
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Conflict: Remote state has diverged' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await orchestrator.syncNow();
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.conflicts).toBe(1);

    // Verify mutation status was updated to conflict
    const stored = await db.pendingMutations.get(mutation.id);
    expect(stored?.status).toBe('conflict');
    expect(stored?.lastError).toContain('409 Conflict');
  });

  it('marks mutation as failed with incremented retry count on network error', async () => {
    const mutation = await adapter.enqueueMutation(
      'message',
      'm-123',
      'create',
      { conversationId: 'c-1', role: 'user', content: 'Hello' }
    );

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline or DNS error'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await orchestrator.syncNow();
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);

    const stored = await db.pendingMutations.get(mutation.id);
    expect(stored?.status).toBe('failed');
    expect(stored?.retryCount).toBe(1);
    expect(stored?.lastError).toContain('Network offline');
  });

  it('prevents concurrent sync execution through mutex locking', async () => {
    await adapter.enqueueMutation('workspace', 'w-1', 'create', { name: 'WS' });

    let resolveFetch!: (value: unknown) => void;
    const slowFetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', slowFetch);

    // Launch first sync
    const firstSyncPromise = orchestrator.syncNow();

    // Allow microtasks to execute so first sync acquires mutex and begins awaiting fetch
    await new Promise((r) => setTimeout(r, 10));

    // Attempt second concurrent sync while first is in flight
    const secondSyncResult = await orchestrator.syncNow();
    expect(secondSyncResult.errors).toContain('Sync already in progress');

    // Resolve first fetch
    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ id: 'w-1' }),
    });

    const firstResult = await firstSyncPromise;
    expect(firstResult.succeeded).toBe(1);
  });
});
