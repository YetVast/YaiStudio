# YAI Studio V1 — Data Synchronization & Storage Specification

---

## 1. Persistence Philosophy: Local Replica vs. Remote Authority

In YAI Studio V1, personal data persistence follows a strict **user-owned, local-first model**:

1. **Remote Authority**: The user's private GitHub repository (`YVSApps_Data_YaiStudio`) is the authoritative source of truth.
2. **Local Replica**: The browser's IndexedDB is an offline-capable working replica.
3. **No Central Database**: Zero user personal intelligence or context is persisted in YAI-managed central databases.
4. **Asynchronous Reconciliation**: Local operations persist immediately to IndexedDB and queue a pending mutation; remote synchronization pushes to GitHub asynchronously.

---

## 2. IndexedDB Schema Design

```typescript
// Proposed Dexie / IDB Stores Schema

interface StoredWorkspace {
  id: string; // UUID v4
  slug: string;
  name: string;
  description: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'synced' | 'pending_push' | 'pending_update' | 'pending_delete' | 'conflict';
}

interface StoredConversation {
  id: string; // UUID v4
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    messageCount: number;
    lastMessageAt: string;
    model?: string;
    provider?: string;
  };
  syncStatus: 'synced' | 'pending_push' | 'pending_update' | 'pending_delete' | 'conflict';
}

interface StoredMessage {
  id: string; // UUID v4
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  syncStatus: 'synced' | 'pending_push';
}

interface PendingMutation {
  id: string;
  entityType: 'workspace' | 'conversation' | 'message' | 'memory' | 'knowledge';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  createdAt: string;
  updatedAt: string;
  status: 'pending' | 'processing' | 'failed' | 'conflict';
  retryCount: number;
  lastError?: string;
}

interface SyncMetadata {
  key: string;
  lastSyncedCommitSha?: string;
  lastSyncTimestamp: string;
  status: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
}
```

---

## 3. Conflict Resolution & Merge Strategy

### A. Messages (Append-Only)
- Messages are append-only.
- Local and remote message lists are merged by stable message ID.
- Missing remote messages are pulled; local pending messages are pushed.
- Deduplication prevents duplicate entries on reconnect.

### B. Metadata & Entities
- SHA-based optimistic locking: Each remote entity file tracks its GitHub Blob SHA.
- If a remote SHA differs from the base SHA when pushing:
  - If field changes do not overlap (e.g. title changed locally, remote updated message counter): automatic three-way merge.
  - If concurrent conflict cannot be resolved automatically: flag entity as `conflict` and prompt user with interactive comparison.

### C. Tree/Commit Batching
- Use the GitHub Git Data API (`trees` and `commits`) to batch multiple mutations into a single atomic commit, avoiding GitHub API rate limits.
