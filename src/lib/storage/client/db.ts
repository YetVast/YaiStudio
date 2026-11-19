import Dexie, { type EntityTable, type DexieOptions } from 'dexie';
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
  StoredLocalSetting,
} from './types';

export class YaiDatabase extends Dexie {
  workspaces!: EntityTable<StoredWorkspace, 'id'>;
  conversations!: EntityTable<StoredConversation, 'id'>;
  messages!: EntityTable<StoredMessage, 'id'>;
  memoryRecords!: EntityTable<StoredMemoryRecord, 'id'>;
  memoryCandidates!: EntityTable<StoredMemoryCandidate, 'id'>;
  knowledgeReferences!: EntityTable<StoredKnowledgeItem, 'id'>;
  activityRecords!: EntityTable<StoredActivityEvent, 'id'>;
  pendingMutations!: EntityTable<PendingMutation, 'id'>;
  syncMetadata!: EntityTable<StoredSyncMetadata, 'key'>;
  localSettings!: EntityTable<StoredLocalSetting, 'key'>;

  constructor(dbName = 'YaiStudioLocalDB', options?: DexieOptions) {
    super(dbName, options);

    // ─── Version 1 Schema Definition ──────────────────────────────
    this.version(1).stores({
      workspaces: '&id, name, syncStatus, updatedAt',
      conversations: '&id, workspaceId, status, syncStatus, updatedAt, [workspaceId+updatedAt]',
      messages: '&id, conversationId, sequence, syncStatus, createdAt, [conversationId+sequence]',
      memoryRecords: '&id, type, status, syncStatus, updatedAt',
      memoryCandidates: '&id, status, syncStatus, proposedAt',
      knowledgeReferences: '&id, syncStatus, updatedAt',
      activityRecords: '&id, timestamp, executionMode, syncStatus',
      pendingMutations: '&id, entityType, status, createdAt, [status+createdAt]',
      syncMetadata: '&key, status',
      localSettings: '&key, updatedAt',
    });
  }
}

let dbInstance: YaiDatabase | null = null;

/**
 * Access singleton instance of YaiDatabase in browser environments.
 */
export function getYaiDatabase(customName?: string): YaiDatabase {
  if (typeof window === 'undefined' && !customName && !globalThis.indexedDB) {
    throw new Error('IndexedDB is unavailable in non-browser environment without a polyfill.');
  }

  if (!dbInstance || customName) {
    const db = new YaiDatabase(customName || 'YaiStudioLocalDB');
    if (!customName) {
      dbInstance = db;
    }
    return db;
  }

  return dbInstance;
}

/**
 * For testing and cleanup purposes.
 */
export async function resetYaiDatabase(db?: YaiDatabase): Promise<void> {
  const target = db || dbInstance;
  if (target) {
    await target.delete();
    if (target === dbInstance) {
      dbInstance = null;
    }
  }
}
