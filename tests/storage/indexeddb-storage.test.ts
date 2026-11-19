import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YaiDatabase, resetYaiDatabase } from '@/lib/storage/client/db';
import { ClientStorageAdapter } from '@/lib/storage/client/storage-adapter';

describe('Milestone 2 — IndexedDB Persistent Storage Foundation', () => {
  let db: YaiDatabase;
  let adapter: ClientStorageAdapter;
  const testDbName = 'test-yai-local-db';

  beforeEach(() => {
    db = new YaiDatabase(testDbName);
    adapter = new ClientStorageAdapter(db);
  });

  afterEach(async () => {
    await resetYaiDatabase(db);
  });

  it('initializes IndexedDB schema with all required stores', () => {
    expect(db.workspaces).toBeDefined();
    expect(db.conversations).toBeDefined();
    expect(db.messages).toBeDefined();
    expect(db.memoryRecords).toBeDefined();
    expect(db.memoryCandidates).toBeDefined();
    expect(db.knowledgeReferences).toBeDefined();
    expect(db.activityRecords).toBeDefined();
    expect(db.pendingMutations).toBeDefined();
    expect(db.syncMetadata).toBeDefined();
    expect(db.localSettings).toBeDefined();
  });

  it('creates and reads workspaces with stable UUIDs and offline mutation', async () => {
    const ws = await adapter.createWorkspace(
      { name: 'Research Lab', description: 'AI Experiments', color: '#4B0084' },
      { offline: true }
    );

    expect(ws.id).toBeDefined();
    expect(ws.name).toBe('Research Lab');
    expect(ws.syncStatus).toBe('pending_push');

    const retrieved = await adapter.getWorkspace(ws.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(ws.id);
    expect(retrieved?.description).toBe('AI Experiments');

    // Verify mutation was queued
    const mutations = await adapter.getPendingMutations();
    expect(mutations.length).toBe(1);
    expect(mutations[0].entityType).toBe('workspace');
    expect(mutations[0].entityId).toBe(ws.id);
    expect(mutations[0].operation).toBe('create');
  });

  it('creates conversations and appends messages offline with monotonic sequence', async () => {
    const conv = await adapter.createConversation(
      { title: 'Local-First Architecture', model: 'gemma-2-2b', provider: 'litert' },
      { offline: true }
    );

    expect(conv.id).toBeDefined();
    expect(conv.syncStatus).toBe('pending_push');
    expect(conv.messageCount).toBe(0);

    const msg1 = await adapter.appendMessage(
      conv.id,
      { role: 'user', content: 'What is local-first software?' },
      { offline: true }
    );

    expect(msg1.sequence).toBe(1);
    expect(msg1.conversationId).toBe(conv.id);
    expect(msg1.syncStatus).toBe('pending_push');

    const msg2 = await adapter.appendMessage(
      conv.id,
      { role: 'assistant', content: 'Local-first software prioritizes local storage over network requests.' },
      { offline: true }
    );

    expect(msg2.sequence).toBe(2);
    expect(msg2.conversationId).toBe(conv.id);

    // Verify messages read in order
    const messages = await adapter.listMessages(conv.id);
    expect(messages.length).toBe(2);
    expect(messages[0].sequence).toBe(1);
    expect(messages[1].sequence).toBe(2);

    // Verify conversation message count was updated
    const updatedConv = await adapter.getConversation(conv.id);
    expect(updatedConv?.messageCount).toBe(2);
  });

  it('manages pending mutations lifecycle (enqueue, status update, dequeue)', async () => {
    const mutation = await adapter.enqueueMutation(
      'conversation',
      'test-conv-id',
      'create',
      { title: 'Offline Note' }
    );

    expect(mutation.id).toBeDefined();
    expect(mutation.status).toBe('pending');
    expect(mutation.retryCount).toBe(0);

    let pendingList = await adapter.getPendingMutations();
    expect(pendingList.length).toBe(1);

    // Mark as failed with retry increment
    await adapter.markMutationStatus(mutation.id, 'failed', 'Network timeout');
    const failed = await db.pendingMutations.get(mutation.id);
    expect(failed?.status).toBe('failed');
    expect(failed?.retryCount).toBe(1);
    expect(failed?.lastError).toBe('Network timeout');

    // Dequeue upon successful resolution
    await adapter.dequeueMutation(mutation.id);
    pendingList = await adapter.getPendingMutations();
    expect(pendingList.length).toBe(0);
  });

  it('imports remote data into local replica without duplicating existing records', async () => {
    const importPayload = {
      workspaces: [
        { id: 'ws-remote-1', name: 'Work', description: 'Remote workspace' },
      ],
      conversations: [
        { id: 'conv-remote-1', title: 'Remote Thread', model: 'gpt-4o' },
      ],
      messages: {
        'conv-remote-1': [
          { id: 'msg-remote-1', sequence: 1, role: 'user' as const, content: 'Hello remote' },
        ],
      },
      memories: [
        { id: 'mem-remote-1', type: 'preference' as const, content: 'Prefers concise answers' },
      ],
    };

    const result = await adapter.importRemoteData(importPayload);
    expect(result.importedWorkspaces).toBe(1);
    expect(result.importedConversations).toBe(1);
    expect(result.importedMessages).toBe(1);

    const ws = await adapter.getWorkspace('ws-remote-1');
    expect(ws).toBeDefined();
    expect(ws?.syncStatus).toBe('synced');

    const msgs = await adapter.listMessages('conv-remote-1');
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toBe('Hello remote');
    expect(msgs[0].syncStatus).toBe('synced');

    // Second import should not duplicate or overwrite
    const secondResult = await adapter.importRemoteData(importPayload);
    expect(secondResult.importedMessages).toBe(0);
  });

  it('handles memory records and candidate approval workflow', async () => {
    const candidate = await adapter.saveCandidate({
      proposedType: 'goal',
      proposedContent: 'Launch YAI Studio V1',
      sourceConversationId: 'conv-123',
    });

    expect(candidate.id).toBeDefined();
    expect(candidate.status).toBe('pending');

    const approved = await adapter.reviewCandidate(candidate.id, 'approved');
    expect(approved.status).toBe('approved');
    expect(approved.reviewedAt).toBeDefined();

    // Verify candidate review mutation was queued
    const mutations = await adapter.getPendingMutations();
    const candidateMutation = mutations.find((m) => m.entityId === candidate.id);
    expect(candidateMutation).toBeDefined();
    expect(candidateMutation?.operation).toBe('update');
  });
});
