/**
 * YAI Studio V1 — Client-Side IndexedDB Storage Types
 *
 * Local working replica of user's personal intelligence data.
 * Secrets, tokens, and BYOK credentials MUST NEVER BE STORED HERE.
 */

import type {
  MemoryType,
  MemoryStatus,
} from '@/types/personal-intelligence';

export type SyncStatus =
  | 'local_only'
  | 'pending_push'
  | 'pending_update'
  | 'pending_delete'
  | 'synced'
  | 'conflict'
  | 'sync_failed';

export interface StoredWorkspace {
  id: string; // Stable UUID
  name: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  syncStatus: SyncStatus;
  remoteSha?: string;
}

export interface StoredConversation {
  id: string; // Stable UUID
  workspaceId: string | null;
  title: string;
  status: 'active' | 'archived';
  model?: string;
  provider?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  messageCount: number;
  syncStatus: SyncStatus;
  remoteSha?: string;
}

export interface StoredMessage {
  id: string; // Stable UUID
  conversationId: string;
  sequence: number; // 1-based monotonic sequence
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  model?: string;
  provider?: string;
  tokenCount?: number;
  syncStatus: SyncStatus;
}

export interface StoredMemoryRecord {
  id: string; // Stable UUID
  type: MemoryType;
  content: string;
  source?: string;
  provenance?: string;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
  confidence?: number;
  syncStatus: SyncStatus;
  remoteSha?: string;
}

export interface StoredMemoryCandidate {
  id: string; // Stable UUID
  proposedType: MemoryType;
  proposedContent: string;
  sourceConversationId?: string;
  proposedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  syncStatus: SyncStatus;
}

export interface StoredKnowledgeItem {
  id: string; // Stable UUID
  title: string;
  content: string;
  source?: string;
  sourceUrl?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  remoteSha?: string;
}

export interface StoredActivityEvent {
  id: string; // Stable UUID
  timestamp: string;
  sourceProduct: string;
  querySummary?: string;
  responseSummary?: string;
  executionMode: 'cloud' | 'local';
  model?: string;
  provider?: string;
  retrievedMemoryIds?: string[];
  resultingMemoryIds?: string[];
  syncStatus: SyncStatus;
}

export interface PendingMutation {
  id: string; // Stable UUID
  entityType:
    | 'workspace'
    | 'conversation'
    | 'message'
    | 'memory'
    | 'candidate'
    | 'knowledge'
    | 'activity';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  createdAt: string;
  updatedAt: string;
  status: 'pending' | 'processing' | 'failed' | 'conflict';
  retryCount: number;
  lastError?: string;
}

export interface StoredSyncMetadata {
  key: string; // e.g. 'github_repo_state'
  lastSyncedCommitSha?: string;
  lastSyncTimestamp: string;
  status: 'idle' | 'syncing' | 'error' | 'diverged';
  errorMessage?: string;
  pendingCount: number;
}

export interface StoredLocalSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  usagePercent: number;
  isAvailable: boolean;
}
