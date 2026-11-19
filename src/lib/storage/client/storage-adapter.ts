/**
 * YAI Studio V1 — Client Persistent Storage Adapter
 *
 * Implements local-first persistent operations over IndexedDB.
 * Manages atomic offline writes, immediate local persistence,
 * and queues mutations for remote GitHub synchronization.
 */

import { YaiDatabase, getYaiDatabase } from './db';
import type {
  StoredWorkspace,
  StoredConversation,
  StoredMessage,
  StoredMemoryRecord,
  StoredMemoryCandidate,
  StoredKnowledgeItem,
  StoredActivityEvent,
  PendingMutation,
  StoredSyncMetadata,
  StorageQuotaInfo,
  SyncStatus,
} from './types';
import type { MemoryType } from '@/types/personal-intelligence';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class ClientStorageAdapter {
  private db: YaiDatabase;

  constructor(database?: YaiDatabase) {
    this.db = database || getYaiDatabase();
  }

  // ─── Workspaces ─────────────────────────────────────────────────

  async listWorkspaces(): Promise<StoredWorkspace[]> {
    return this.db.workspaces.orderBy('updatedAt').reverse().toArray();
  }

  async getWorkspace(id: string): Promise<StoredWorkspace | undefined> {
    return this.db.workspaces.get(id);
  }

  async createWorkspace(
    data: { name: string; description?: string; color?: string; isDefault?: boolean },
    options: { offline?: boolean } = {}
  ): Promise<StoredWorkspace> {
    const now = new Date().toISOString();
    const id = generateId();
    const syncStatus: SyncStatus = options.offline ? 'pending_push' : 'local_only';

    const workspace: StoredWorkspace = {
      id,
      name: data.name,
      description: data.description,
      color: data.color,
      isDefault: data.isDefault,
      createdAt: now,
      updatedAt: now,
      syncStatus,
    };

    await this.db.transaction('rw', [this.db.workspaces, this.db.pendingMutations], async () => {
      await this.db.workspaces.add(workspace);
      if (options.offline) {
        await this.enqueueMutation('workspace', id, 'create', workspace);
      }
    });

    return workspace;
  }

  async updateWorkspace(
    id: string,
    updates: Partial<Pick<StoredWorkspace, 'name' | 'description' | 'color' | 'isDefault'>>
  ): Promise<StoredWorkspace> {
    const existing = await this.db.workspaces.get(id);
    if (!existing) {
      throw new Error(`Workspace with id ${id} not found.`);
    }

    const now = new Date().toISOString();
    const updated: StoredWorkspace = {
      ...existing,
      ...updates,
      updatedAt: now,
      syncStatus: 'pending_update',
    };

    await this.db.transaction('rw', [this.db.workspaces, this.db.pendingMutations], async () => {
      await this.db.workspaces.put(updated);
      await this.enqueueMutation('workspace', id, 'update', updated);
    });

    return updated;
  }

  // ─── Conversations ──────────────────────────────────────────────

  async listConversations(options?: {
    workspaceId?: string | null;
    status?: 'active' | 'archived';
    limit?: number;
    offset?: number;
  }): Promise<{ items: StoredConversation[]; total: number }> {
    let collection = this.db.conversations.toCollection();

    if (options?.workspaceId !== undefined) {
      if (options.workspaceId === null) {
        collection = collection.filter((c) => c.workspaceId === null);
      } else {
        collection = this.db.conversations.where('workspaceId').equals(options.workspaceId);
      }
    }

    if (options?.status) {
      collection = collection.filter((c) => c.status === options.status);
    }

    const total = await collection.count();
    let query = collection.reverse().sortBy('updatedAt');
    const items = await query;

    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    const paged = items.slice(offset, offset + limit);

    return { items: paged, total };
  }

  async getConversation(id: string): Promise<StoredConversation | undefined> {
    return this.db.conversations.get(id);
  }

  async createConversation(
    data: {
      title: string;
      workspaceId?: string | null;
      model?: string;
      provider?: string;
    },
    options: { offline?: boolean } = {}
  ): Promise<StoredConversation> {
    const now = new Date().toISOString();
    const id = generateId();
    const syncStatus: SyncStatus = options.offline ? 'pending_push' : 'local_only';

    const conversation: StoredConversation = {
      id,
      workspaceId: data.workspaceId || null,
      title: data.title,
      status: 'active',
      model: data.model,
      provider: data.provider,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messageCount: 0,
      syncStatus,
    };

    await this.db.transaction('rw', [this.db.conversations, this.db.pendingMutations], async () => {
      await this.db.conversations.add(conversation);
      if (options.offline) {
        await this.enqueueMutation('conversation', id, 'create', conversation);
      }
    });

    return conversation;
  }

  async updateConversation(
    id: string,
    updates: Partial<Pick<StoredConversation, 'title' | 'status' | 'workspaceId' | 'model' | 'provider'>>
  ): Promise<StoredConversation> {
    const existing = await this.db.conversations.get(id);
    if (!existing) {
      throw new Error(`Conversation with id ${id} not found.`);
    }

    const now = new Date().toISOString();
    const updated: StoredConversation = {
      ...existing,
      ...updates,
      updatedAt: now,
      syncStatus: 'pending_update',
    };

    await this.db.transaction('rw', [this.db.conversations, this.db.pendingMutations], async () => {
      await this.db.conversations.put(updated);
      await this.enqueueMutation('conversation', id, 'update', updated);
    });

    return updated;
  }

  // ─── Messages ───────────────────────────────────────────────────

  async listMessages(conversationId: string): Promise<StoredMessage[]> {
    return this.db.messages
      .where('conversationId')
      .equals(conversationId)
      .sortBy('sequence');
  }

  async appendMessage(
    conversationId: string,
    data: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      model?: string;
      provider?: string;
    },
    options: { offline?: boolean } = {}
  ): Promise<StoredMessage> {
    const conversation = await this.db.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation with id ${conversationId} not found.`);
    }

    const existingMessages = await this.listMessages(conversationId);
    const nextSequence = existingMessages.length + 1;
    const now = new Date().toISOString();
    const id = generateId();
    const syncStatus: SyncStatus = options.offline ? 'pending_push' : 'local_only';

    const message: StoredMessage = {
      id,
      conversationId,
      sequence: nextSequence,
      role: data.role,
      content: data.content,
      createdAt: now,
      model: data.model || conversation.model,
      provider: data.provider || conversation.provider,
      syncStatus,
    };

    const updatedConversation: StoredConversation = {
      ...conversation,
      messageCount: nextSequence,
      lastMessageAt: now,
      updatedAt: now,
      syncStatus: options.offline ? 'pending_update' : conversation.syncStatus,
    };

    await this.db.transaction('rw', [this.db.messages, this.db.conversations, this.db.pendingMutations], async () => {
      await this.db.messages.add(message);
      await this.db.conversations.put(updatedConversation);
      if (options.offline) {
        await this.enqueueMutation('message', id, 'create', message);
      }
    });

    return message;
  }

  // ─── Memory Records ─────────────────────────────────────────────

  async listMemories(type?: MemoryType): Promise<StoredMemoryRecord[]> {
    if (type) {
      return this.db.memoryRecords.where('type').equals(type).toArray();
    }
    return this.db.memoryRecords.toArray();
  }

  async saveMemory(
    record: Omit<StoredMemoryRecord, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'> & { id?: string },
    options: { offline?: boolean } = {}
  ): Promise<StoredMemoryRecord> {
    const now = new Date().toISOString();
    const id = record.id || generateId();
    const syncStatus: SyncStatus = options.offline ? 'pending_push' : 'local_only';

    const memory: StoredMemoryRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus,
    };

    await this.db.transaction('rw', [this.db.memoryRecords, this.db.pendingMutations], async () => {
      await this.db.memoryRecords.put(memory);
      if (options.offline) {
        await this.enqueueMutation('memory', id, 'create', memory);
      }
    });

    return memory;
  }

  // ─── Memory Candidates ──────────────────────────────────────────

  async listCandidates(status?: 'pending' | 'approved' | 'rejected'): Promise<StoredMemoryCandidate[]> {
    if (status) {
      return this.db.memoryCandidates.where('status').equals(status).toArray();
    }
    return this.db.memoryCandidates.toArray();
  }

  async saveCandidate(
    candidate: Omit<StoredMemoryCandidate, 'id' | 'proposedAt' | 'status' | 'syncStatus'>
  ): Promise<StoredMemoryCandidate> {
    const now = new Date().toISOString();
    const id = generateId();

    const stored: StoredMemoryCandidate = {
      ...candidate,
      id,
      proposedAt: now,
      status: 'pending',
      syncStatus: 'local_only',
    };

    await this.db.memoryCandidates.add(stored);
    return stored;
  }

  async reviewCandidate(
    id: string,
    decision: 'approved' | 'rejected'
  ): Promise<StoredMemoryCandidate> {
    const candidate = await this.db.memoryCandidates.get(id);
    if (!candidate) {
      throw new Error(`Candidate with id ${id} not found.`);
    }

    const now = new Date().toISOString();
    const updated: StoredMemoryCandidate = {
      ...candidate,
      status: decision,
      reviewedAt: now,
      syncStatus: 'pending_update',
    };

    await this.db.transaction('rw', [this.db.memoryCandidates, this.db.pendingMutations], async () => {
      await this.db.memoryCandidates.put(updated);
      await this.enqueueMutation('candidate', id, 'update', updated);
    });

    return updated;
  }

  // ─── Knowledge Items ────────────────────────────────────────────

  async listKnowledge(): Promise<StoredKnowledgeItem[]> {
    return this.db.knowledgeReferences.orderBy('updatedAt').reverse().toArray();
  }

  async saveKnowledge(
    item: Omit<StoredKnowledgeItem, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'> & { id?: string },
    options: { offline?: boolean } = {}
  ): Promise<StoredKnowledgeItem> {
    const now = new Date().toISOString();
    const id = item.id || generateId();
    const syncStatus: SyncStatus = options.offline ? 'pending_push' : 'local_only';

    const knowledge: StoredKnowledgeItem = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus,
    };

    await this.db.transaction('rw', [this.db.knowledgeReferences, this.db.pendingMutations], async () => {
      await this.db.knowledgeReferences.put(knowledge);
      if (options.offline) {
        await this.enqueueMutation('knowledge', id, 'create', knowledge);
      }
    });

    return knowledge;
  }

  // ─── Activity Ledger ────────────────────────────────────────────

  async listActivity(limit = 100): Promise<StoredActivityEvent[]> {
    return this.db.activityRecords.orderBy('timestamp').reverse().limit(limit).toArray();
  }

  async recordActivity(
    event: Omit<StoredActivityEvent, 'id' | 'timestamp' | 'syncStatus'>
  ): Promise<StoredActivityEvent> {
    const now = new Date().toISOString();
    const id = generateId();

    const activity: StoredActivityEvent = {
      ...event,
      id,
      timestamp: now,
      syncStatus: 'local_only',
    };

    await this.db.activityRecords.add(activity);
    return activity;
  }

  // ─── Mutation Queue Operations ──────────────────────────────────

  async enqueueMutation(
    entityType: PendingMutation['entityType'],
    entityId: string,
    operation: PendingMutation['operation'],
    payload: unknown
  ): Promise<PendingMutation> {
    const now = new Date().toISOString();
    const mutation: PendingMutation = {
      id: generateId(),
      entityType,
      entityId,
      operation,
      payload,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      retryCount: 0,
    };

    await this.db.pendingMutations.add(mutation);
    return mutation;
  }

  async getPendingMutations(limit = 100): Promise<PendingMutation[]> {
    return this.db.pendingMutations
      .where('status')
      .equals('pending')
      .sortBy('createdAt')
      .then((mutations) => mutations.slice(0, limit));
  }

  async countPendingMutations(): Promise<number> {
    return this.db.pendingMutations
      .where('status')
      .anyOf(['pending', 'processing', 'failed'])
      .count();
  }

  async markMutationStatus(
    id: string,
    status: PendingMutation['status'],
    lastError?: string
  ): Promise<void> {
    const mutation = await this.db.pendingMutations.get(id);
    if (!mutation) return;

    const now = new Date().toISOString();
    const updated: PendingMutation = {
      ...mutation,
      status,
      updatedAt: now,
      retryCount: status === 'failed' ? mutation.retryCount + 1 : mutation.retryCount,
      lastError,
    };

    await this.db.pendingMutations.put(updated);
  }

  async dequeueMutation(id: string): Promise<void> {
    await this.db.pendingMutations.delete(id);
  }

  // ─── Storage Quota & Diagnostics ────────────────────────────────

  async getStorageQuota(): Promise<StorageQuotaInfo> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usageBytes = estimate.usage || 0;
        const quotaBytes = estimate.quota || 0;
        const usagePercent = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;
        return {
          usageBytes,
          quotaBytes,
          usagePercent: Math.round(usagePercent * 100) / 100,
          isAvailable: true,
        };
      } catch (err) {
        console.warn('[Storage] Quota estimation error:', err);
      }
    }

    return {
      usageBytes: 0,
      quotaBytes: 0,
      usagePercent: 0,
      isAvailable: false,
    };
  }

  // ─── Remote Bootstrap / Import ──────────────────────────────────

  async importRemoteData(data: {
    workspaces?: Array<{ id: string; name: string; description?: string; color?: string; createdAt?: string; updatedAt?: string }>;
    conversations?: Array<{ id: string; workspaceName?: string | null; title: string; createdAt?: string; updatedAt?: string; model?: string; provider?: string }>;
    messages?: Record<string, Array<{ id: string; sequence: number; role: 'user' | 'assistant' | 'system'; content: string; createdAt?: string }>>;
    memories?: Array<{ id: string; type: MemoryType; content: string; status?: string; createdAt?: string; updatedAt?: string; confidence?: number }>;
    knowledge?: Array<{ id: string; title: string; content: string; tags?: string[]; createdAt?: string; updatedAt?: string }>;
  }): Promise<{ importedWorkspaces: number; importedConversations: number; importedMessages: number }> {
    const now = new Date().toISOString();
    let importedWorkspaces = 0;
    let importedConversations = 0;
    let importedMessages = 0;

    await this.db.transaction(
      'rw',
      [this.db.workspaces, this.db.conversations, this.db.messages, this.db.memoryRecords, this.db.knowledgeReferences],
      async () => {
        // Workspaces
        if (data.workspaces) {
          for (const w of data.workspaces) {
            const existing = await this.db.workspaces.get(w.id);
            if (!existing || existing.syncStatus === 'synced') {
              await this.db.workspaces.put({
                id: w.id,
                name: w.name,
                description: w.description,
                color: w.color,
                createdAt: w.createdAt || now,
                updatedAt: w.updatedAt || now,
                syncStatus: 'synced',
              });
              importedWorkspaces++;
            }
          }
        }

        // Conversations
        if (data.conversations) {
          for (const c of data.conversations) {
            const existing = await this.db.conversations.get(c.id);
            if (!existing || existing.syncStatus === 'synced') {
              const msgs = data.messages?.[c.id] || [];
              await this.db.conversations.put({
                id: c.id,
                workspaceId: null,
                title: c.title,
                status: 'active',
                model: c.model,
                provider: c.provider,
                createdAt: c.createdAt || now,
                updatedAt: c.updatedAt || now,
                messageCount: msgs.length,
                lastMessageAt: msgs[msgs.length - 1]?.createdAt || c.updatedAt || now,
                syncStatus: 'synced',
              });
              importedConversations++;
            }
          }
        }

        // Messages
        if (data.messages) {
          for (const [convId, msgs] of Object.entries(data.messages)) {
            for (const m of msgs) {
              const existing = await this.db.messages.get(m.id);
              if (!existing) {
                await this.db.messages.put({
                  id: m.id,
                  conversationId: convId,
                  sequence: m.sequence,
                  role: m.role,
                  content: m.content,
                  createdAt: m.createdAt || now,
                  syncStatus: 'synced',
                });
                importedMessages++;
              }
            }
          }
        }

        // Memories
        if (data.memories) {
          for (const mem of data.memories) {
            const existing = await this.db.memoryRecords.get(mem.id);
            if (!existing || existing.syncStatus === 'synced') {
              await this.db.memoryRecords.put({
                id: mem.id,
                type: mem.type,
                content: mem.content,
                status: (mem.status as StoredMemoryRecord['status']) || 'active',
                createdAt: mem.createdAt || now,
                updatedAt: mem.updatedAt || now,
                confidence: mem.confidence,
                syncStatus: 'synced',
              });
            }
          }
        }

        // Knowledge
        if (data.knowledge) {
          for (const k of data.knowledge) {
            const existing = await this.db.knowledgeReferences.get(k.id);
            if (!existing || existing.syncStatus === 'synced') {
              await this.db.knowledgeReferences.put({
                id: k.id,
                title: k.title,
                content: k.content,
                tags: k.tags,
                createdAt: k.createdAt || now,
                updatedAt: k.updatedAt || now,
                syncStatus: 'synced',
              });
            }
          }
        }
      }
    );

    return { importedWorkspaces, importedConversations, importedMessages };
  }
}
