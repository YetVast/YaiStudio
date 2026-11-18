/**
 * YAI Studio — Personal Intelligence Storage Adapter (server-only)
 *
 * Implements the user-owned GitHub repository persistence adapter for the
 * exact repository name `YVSApps_Data_YaiStudio`.
 *
 * All operations:
 * - Validate paths and enforce path traversal prevention
 * - Preserve SHA for updates and deletes to detect concurrent modifications
 * - Ensure read operations NEVER mutate repository data
 * - Enforce canonical messages.json as the source of truth, projecting to conversation.md
 *
 * @module lib/storage/personal-intelligence-storage
 */
import 'server-only';

import * as gh from '@/lib/github/api-client';
import {
  preventPathTraversal,
  validateConversationId,
  sanitizeWorkspaceName,
  getConversationPath,
  generateId,
} from '@/lib/storage/path-utils';
import { generateConversationMarkdown } from '@/lib/storage/conversation-markdown';
import type {
  YaiManifest,
  WorkspaceData,
  ConversationMeta,
  Message,
  MessagesFile,
  ConversationsIndex,
  ConversationIndexEntry,
  MemoryType,
  MemoryRecord,
  MemoryFile,
  MemoryCandidate,
  ActivityEvent,
  KnowledgeItem,
} from '@/types/personal-intelligence';

export const DATA_REPO_NAME = 'YVSApps_Data_YaiStudio' as const;

export interface StorageContext {
  githubToken: string;
  githubLogin: string;
}

// ---------------------------------------------------------------------------
// 1. Repository Discovery, Verification and Initialization
// ---------------------------------------------------------------------------

export async function verifyRepository(ctx: StorageContext): Promise<{
  exists: boolean;
  isPrivate: boolean;
  ownerMatch: boolean;
  fullName?: string;
}> {
  try {
    const repo = await gh.getRepository(ctx.githubLogin, DATA_REPO_NAME, ctx.githubToken);
    if (!repo) {
      return { exists: false, isPrivate: false, ownerMatch: false };
    }
    const ownerMatch = repo.owner.login.toLowerCase() === ctx.githubLogin.toLowerCase();
    return {
      exists: true,
      isPrivate: repo.private,
      ownerMatch,
      fullName: repo.full_name,
    };
  } catch (error) {
    if (error instanceof gh.NotFoundError) {
      return { exists: false, isPrivate: false, ownerMatch: false };
    }
    throw error;
  }
}

export async function isInitialized(ctx: StorageContext): Promise<boolean> {
  const manifest = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, 'yaiManifest.json', ctx.githubToken);
  return manifest !== null;
}

export async function getManifest(ctx: StorageContext): Promise<YaiManifest | null> {
  const file = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, 'yaiManifest.json', ctx.githubToken);
  if (!file) return null;
  return JSON.parse(file.content) as YaiManifest;
}

export async function initializeRepository(ctx: StorageContext): Promise<{ createdFiles: string[] }> {
  const createdFiles: string[] = [];
  const now = new Date().toISOString();

  // 1. README.md
  const readmeContent = `# Personal Intelligence Storage — YAI Studio

This is your private Personal Intelligence repository managed by **YAI Studio** under Yet Vast Solutions.

- **Owner:** @${ctx.githubLogin}
- **Initialized:** ${now}
- **Authority:** User-owned GitHub storage

## Repository Layout
- \`yaiManifest.json\`: Schema and manifest metadata
- \`conversationsIndex.json\`: Navigation index for conversations
- \`workspaces/\`: Hierarchical workspaces containing conversations
- \`unfiledConversations/\`: Conversations without an assigned workspace
- \`memory/\`: Structured persistent memory (facts, preferences, interests, goals, relationships, decisions)
- \`knowledge/\`: Notes and references
- \`activity/\`: Partitioned ledger of cross-product interactions
`;

  const existingReadme = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, 'README.md', ctx.githubToken);
  if (!existingReadme) {
    await gh.createFile(ctx.githubLogin, DATA_REPO_NAME, 'README.md', readmeContent, 'YAI Studio: Initialize README.md', ctx.githubToken);
    createdFiles.push('README.md');
  }

  // 2. yaiManifest.json
  const manifest: YaiManifest = {
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
  const existingManifest = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, 'yaiManifest.json', ctx.githubToken);
  if (!existingManifest) {
    await gh.createFile(
      ctx.githubLogin,
      DATA_REPO_NAME,
      'yaiManifest.json',
      JSON.stringify(manifest, null, 2),
      'YAI Studio: Initialize manifest',
      ctx.githubToken,
    );
    createdFiles.push('yaiManifest.json');
  }

  // 3. conversationsIndex.json
  const initialIndex: ConversationsIndex = {
    schemaVersion: 1,
    updatedAt: now,
    conversations: [],
  };
  const existingIndex = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, 'conversationsIndex.json', ctx.githubToken);
  if (!existingIndex) {
    await gh.createFile(
      ctx.githubLogin,
      DATA_REPO_NAME,
      'conversationsIndex.json',
      JSON.stringify(initialIndex, null, 2),
      'YAI Studio: Initialize conversations index',
      ctx.githubToken,
    );
    createdFiles.push('conversationsIndex.json');
  }

  // 4. Memory category files
  const memoryCategories: MemoryType[] = ['fact', 'preference', 'interest', 'goal', 'relationship', 'decision'];
  for (const cat of memoryCategories) {
    const memoryPath = `memory/${cat}s.json`;
    const existing = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, memoryPath, ctx.githubToken);
    if (!existing) {
      const initialMemory: MemoryFile = {
        schemaVersion: 1,
        updatedAt: now,
        records: [],
      };
      await gh.createFile(
        ctx.githubLogin,
        DATA_REPO_NAME,
        memoryPath,
        JSON.stringify(initialMemory, null, 2),
        `YAI Studio: Initialize ${cat}s memory`,
        ctx.githubToken,
      );
      createdFiles.push(memoryPath);
    }
  }

  return { createdFiles };
}

// ---------------------------------------------------------------------------
// 2. Conversations
// ---------------------------------------------------------------------------

export async function getConversationsIndex(ctx: StorageContext): Promise<ConversationsIndex> {
  const file = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, 'conversationsIndex.json', ctx.githubToken);
  if (!file) {
    return { schemaVersion: 1, updatedAt: new Date().toISOString(), conversations: [] };
  }
  return JSON.parse(file.content) as ConversationsIndex;
}

export async function getConversation(
  ctx: StorageContext,
  conversationId: string,
): Promise<{
  meta: ConversationMeta;
  messages: Message[];
  metaSha: string;
  messagesSha: string;
  markdown?: string;
} | null> {
  validateConversationId(conversationId);
  const index = await getConversationsIndex(ctx);
  const entry = index.conversations.find((c) => c.id === conversationId);

  // If in index, use its path; otherwise check unfiled
  const dirPath = entry ? entry.path : `unfiledConversations/${conversationId}`;
  preventPathTraversal(dirPath);

  const metaFile = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, `${dirPath}/conversation.json`, ctx.githubToken);
  if (!metaFile) return null;

  const messagesFile = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, `${dirPath}/messages.json`, ctx.githubToken);
  const mdFile = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, `${dirPath}/conversation.md`, ctx.githubToken);

  const meta = JSON.parse(metaFile.content) as ConversationMeta;
  const messagesData = messagesFile ? (JSON.parse(messagesFile.content) as MessagesFile) : { conversationId, messages: [] };

  return {
    meta,
    messages: messagesData.messages,
    metaSha: metaFile.sha,
    messagesSha: messagesFile?.sha ?? '',
    markdown: mdFile?.content,
  };
}

export async function createConversation(
  ctx: StorageContext,
  title: string,
  workspacePath: string | null = null,
  model?: string,
  provider?: string,
): Promise<ConversationMeta> {
  if (workspacePath) preventPathTraversal(workspacePath);
  const id = generateId();
  const now = new Date().toISOString();
  const dirPath = getConversationPath(workspacePath, id);

  const meta: ConversationMeta = {
    id,
    title: title.trim() || 'Untitled Conversation',
    createdAt: now,
    updatedAt: now,
    workspacePath,
    status: 'active',
    model,
    provider,
  };

  const messagesData: MessagesFile = {
    conversationId: id,
    messages: [],
  };

  const mdContent = generateConversationMarkdown(meta, []);

  // 1. Create conversation.json
  await gh.createFile(
    ctx.githubLogin,
    DATA_REPO_NAME,
    `${dirPath}/conversation.json`,
    JSON.stringify(meta, null, 2),
    `YAI Studio: Create conversation ${meta.title}`,
    ctx.githubToken,
  );

  // 2. Create messages.json
  await gh.createFile(
    ctx.githubLogin,
    DATA_REPO_NAME,
    `${dirPath}/messages.json`,
    JSON.stringify(messagesData, null, 2),
    `YAI Studio: Create messages for ${id}`,
    ctx.githubToken,
  );

  // 3. Create conversation.md projection
  await gh.createFile(
    ctx.githubLogin,
    DATA_REPO_NAME,
    `${dirPath}/conversation.md`,
    mdContent,
    `YAI Studio: Export markdown for ${id}`,
    ctx.githubToken,
  );

  // 4. Update conversationsIndex.json
  try {
    const indexFile = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, 'conversationsIndex.json', ctx.githubToken);
    const index: ConversationsIndex = indexFile
      ? (JSON.parse(indexFile.content) as ConversationsIndex)
      : { schemaVersion: 1, updatedAt: now, conversations: [] };

    const workspaceName = workspacePath ? workspacePath.split('/').pop() ?? null : null;
    const newEntry: ConversationIndexEntry = {
      id,
      title: meta.title,
      workspaceName,
      path: dirPath,
      updatedAt: now,
    };

    index.conversations = [newEntry, ...index.conversations.filter((c) => c.id !== id)];
    index.updatedAt = now;

    if (indexFile) {
      await gh.updateFile(
        ctx.githubLogin,
        DATA_REPO_NAME,
        'conversationsIndex.json',
        JSON.stringify(index, null, 2),
        indexFile.sha,
        `YAI Studio: Index conversation ${id}`,
        ctx.githubToken,
      );
    } else {
      await gh.createFile(
        ctx.githubLogin,
        DATA_REPO_NAME,
        'conversationsIndex.json',
        JSON.stringify(index, null, 2),
        `YAI Studio: Initialize conversations index with ${id}`,
        ctx.githubToken,
      );
    }
  } catch (err) {
    console.error('[YAI Storage] Failed to update conversations index, index can be rebuilt:', err);
  }

  return meta;
}

export async function updateConversationMeta(
  ctx: StorageContext,
  conversationId: string,
  updates: Partial<Pick<ConversationMeta, 'title' | 'status'>>,
  metaSha: string,
): Promise<ConversationMeta> {
  validateConversationId(conversationId);
  const conv = await getConversation(ctx, conversationId);
  if (!conv) throw new gh.NotFoundError(`Conversation ${conversationId} not found`);

  const now = new Date().toISOString();
  const updatedMeta: ConversationMeta = {
    ...conv.meta,
    ...updates,
    updatedAt: now,
  };

  const dirPath = conv.meta.workspacePath
    ? getConversationPath(conv.meta.workspacePath, conversationId)
    : `unfiledConversations/${conversationId}`;

  await gh.updateFile(
    ctx.githubLogin,
    DATA_REPO_NAME,
    `${dirPath}/conversation.json`,
    JSON.stringify(updatedMeta, null, 2),
    metaSha,
    `YAI Studio: Update conversation ${conversationId}`,
    ctx.githubToken,
  );

  // Update index title if changed
  if (updates.title) {
    try {
      const indexFile = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, 'conversationsIndex.json', ctx.githubToken);
      if (indexFile) {
        const index = JSON.parse(indexFile.content) as ConversationsIndex;
        const entry = index.conversations.find((c) => c.id === conversationId);
        if (entry) {
          entry.title = updates.title;
          entry.updatedAt = now;
          await gh.updateFile(
            ctx.githubLogin,
            DATA_REPO_NAME,
            'conversationsIndex.json',
            JSON.stringify(index, null, 2),
            indexFile.sha,
            `YAI Studio: Update title for ${conversationId} in index`,
            ctx.githubToken,
          );
        }
      }
    } catch (e) {
      console.error('[YAI Storage] Failed to update index on title update:', e);
    }
  }

  return updatedMeta;
}

export async function appendMessage(
  ctx: StorageContext,
  conversationId: string,
  newMsg: Omit<Message, 'id' | 'sequence' | 'createdAt'>,
): Promise<Message> {
  validateConversationId(conversationId);
  const conv = await getConversation(ctx, conversationId);
  if (!conv) throw new gh.NotFoundError(`Conversation ${conversationId} not found`);

  const now = new Date().toISOString();
  const nextSeq = conv.messages.length > 0 ? Math.max(...conv.messages.map((m) => m.sequence)) + 1 : 1;

  const message: Message = {
    id: generateId(),
    sequence: nextSeq,
    role: newMsg.role,
    content: newMsg.content,
    createdAt: now,
    model: newMsg.model,
    provider: newMsg.provider,
    tokenCount: newMsg.tokenCount,
  };

  const updatedMessages = [...conv.messages, message];
  const messagesData: MessagesFile = {
    conversationId,
    messages: updatedMessages,
  };

  const dirPath = conv.meta.workspacePath
    ? getConversationPath(conv.meta.workspacePath, conversationId)
    : `unfiledConversations/${conversationId}`;

  // 1. Update messages.json
  await gh.updateFile(
    ctx.githubLogin,
    DATA_REPO_NAME,
    `${dirPath}/messages.json`,
    JSON.stringify(messagesData, null, 2),
    conv.messagesSha,
    `YAI Studio: Add message ${message.id} to ${conversationId}`,
    ctx.githubToken,
  );

  // 2. Update conversation.json updatedAt
  const updatedMeta: ConversationMeta = {
    ...conv.meta,
    updatedAt: now,
    model: message.model || conv.meta.model,
    provider: message.provider || conv.meta.provider,
  };

  try {
    await gh.updateFile(
      ctx.githubLogin,
      DATA_REPO_NAME,
      `${dirPath}/conversation.json`,
      JSON.stringify(updatedMeta, null, 2),
      conv.metaSha,
      `YAI Studio: Update conversation timestamp ${conversationId}`,
      ctx.githubToken,
    );
  } catch (e) {
    console.warn('[YAI Storage] Could not update meta timestamp:', e);
  }

  // 3. Update conversation.md projection
  try {
    const mdContent = generateConversationMarkdown(updatedMeta, updatedMessages);
    const existingMd = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, `${dirPath}/conversation.md`, ctx.githubToken);
    if (existingMd) {
      await gh.updateFile(
        ctx.githubLogin,
        DATA_REPO_NAME,
        `${dirPath}/conversation.md`,
        mdContent,
        existingMd.sha,
        `YAI Studio: Regenerate transcript for ${conversationId}`,
        ctx.githubToken,
      );
    } else {
      await gh.createFile(
        ctx.githubLogin,
        DATA_REPO_NAME,
        `${dirPath}/conversation.md`,
        mdContent,
        `YAI Studio: Create transcript for ${conversationId}`,
        ctx.githubToken,
      );
    }
  } catch (e) {
    console.warn('[YAI Storage] Failed to update markdown projection:', e);
  }

  // 4. Update index updatedAt
  try {
    const indexFile = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, 'conversationsIndex.json', ctx.githubToken);
    if (indexFile) {
      const index = JSON.parse(indexFile.content) as ConversationsIndex;
      const entry = index.conversations.find((c) => c.id === conversationId);
      if (entry) {
        entry.updatedAt = now;
        await gh.updateFile(
          ctx.githubLogin,
          DATA_REPO_NAME,
          'conversationsIndex.json',
          JSON.stringify(index, null, 2),
          indexFile.sha,
          `YAI Studio: Touch ${conversationId} in index`,
          ctx.githubToken,
        );
      }
    }
  } catch (e) {
    console.warn('[YAI Storage] Failed to update index timestamp:', e);
  }

  return message;
}

// ---------------------------------------------------------------------------
// 3. Workspaces
// ---------------------------------------------------------------------------

export async function listWorkspaces(ctx: StorageContext, parentPath = 'workspaces'): Promise<WorkspaceData[]> {
  preventPathTraversal(parentPath);
  try {
    const items = await gh.listDirectory(ctx.githubLogin, DATA_REPO_NAME, parentPath, ctx.githubToken);
    const workspaces: WorkspaceData[] = [];

    for (const item of items) {
      if (item.type === 'dir') {
        const dataFile = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, `${item.path}/workspaceData.json`, ctx.githubToken);
        if (dataFile) {
          try {
            workspaces.push(JSON.parse(dataFile.content) as WorkspaceData);
          } catch {
            // Non-fatal if parsing single workspace corrupted
          }
        }
      }
    }
    return workspaces;
  } catch (error) {
    if (error instanceof gh.NotFoundError) {
      return [];
    }
    throw error;
  }
}

export async function createWorkspace(
  ctx: StorageContext,
  name: string,
  parentPath: string | null = null,
  description?: string,
): Promise<WorkspaceData> {
  const safeName = sanitizeWorkspaceName(name);
  const targetDir = parentPath ? `${parentPath}/${safeName}` : `workspaces/${safeName}`;
  preventPathTraversal(targetDir);

  const now = new Date().toISOString();
  const workspace: WorkspaceData = {
    id: generateId(),
    name: safeName,
    description,
    createdAt: now,
    updatedAt: now,
  };

  const dataPath = `${targetDir}/workspaceData.json`;
  await gh.createFile(
    ctx.githubLogin,
    DATA_REPO_NAME,
    dataPath,
    JSON.stringify(workspace, null, 2),
    `YAI Studio: Create workspace ${safeName}`,
    ctx.githubToken,
  );

  return workspace;
}

// ---------------------------------------------------------------------------
// 4. Personal Memory
// ---------------------------------------------------------------------------

export async function getMemory(ctx: StorageContext, type: MemoryType): Promise<MemoryFile> {
  const filePath = `memory/${type}s.json`;
  const file = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, filePath, ctx.githubToken);
  if (!file) {
    return { schemaVersion: 1, updatedAt: new Date().toISOString(), records: [] };
  }
  return JSON.parse(file.content) as MemoryFile;
}

export async function addMemoryRecord(
  ctx: StorageContext,
  type: MemoryType,
  record: Omit<MemoryRecord, 'id' | 'type' | 'createdAt' | 'updatedAt'>,
): Promise<MemoryRecord> {
  const filePath = `memory/${type}s.json`;
  const file = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, filePath, ctx.githubToken);
  const memoryFile: MemoryFile = file
    ? (JSON.parse(file.content) as MemoryFile)
    : { schemaVersion: 1, updatedAt: new Date().toISOString(), records: [] };

  const now = new Date().toISOString();
  const newRecord: MemoryRecord = {
    id: generateId(),
    type,
    content: record.content,
    source: record.source,
    provenance: record.provenance,
    status: record.status || 'active',
    createdAt: now,
    updatedAt: now,
    confidence: record.confidence,
  };

  memoryFile.records = [newRecord, ...memoryFile.records];
  memoryFile.updatedAt = now;

  if (file) {
    await gh.updateFile(
      ctx.githubLogin,
      DATA_REPO_NAME,
      filePath,
      JSON.stringify(memoryFile, null, 2),
      file.sha,
      `YAI Studio: Add ${type} record ${newRecord.id}`,
      ctx.githubToken,
    );
  } else {
    await gh.createFile(
      ctx.githubLogin,
      DATA_REPO_NAME,
      filePath,
      JSON.stringify(memoryFile, null, 2),
      `YAI Studio: Initialize and add ${type} record`,
      ctx.githubToken,
    );
  }

  return newRecord;
}

export async function listCandidates(ctx: StorageContext): Promise<MemoryCandidate[]> {
  try {
    const items = await gh.listDirectory(ctx.githubLogin, DATA_REPO_NAME, 'memory/candidates', ctx.githubToken);
    const candidates: MemoryCandidate[] = [];

    for (const item of items) {
      if (item.type === 'file' && item.path.endsWith('.json')) {
        const file = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, item.path, ctx.githubToken);
        if (file) {
          try {
            candidates.push(JSON.parse(file.content) as MemoryCandidate);
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
    return candidates.sort((a, b) => new Date(b.proposedAt).getTime() - new Date(a.proposedAt).getTime());
  } catch (error) {
    if (error instanceof gh.NotFoundError) {
      return [];
    }
    throw error;
  }
}

export async function addCandidate(
  ctx: StorageContext,
  candidate: Omit<MemoryCandidate, 'id' | 'proposedAt' | 'status'>,
): Promise<MemoryCandidate> {
  const id = generateId();
  const now = new Date().toISOString();
  const newCandidate: MemoryCandidate = {
    id,
    proposedType: candidate.proposedType,
    proposedContent: candidate.proposedContent,
    sourceActivityId: candidate.sourceActivityId,
    sourceConversationId: candidate.sourceConversationId,
    proposedAt: now,
    status: 'pending',
  };

  const path = `memory/candidates/${id}.json`;
  await gh.createFile(
    ctx.githubLogin,
    DATA_REPO_NAME,
    path,
    JSON.stringify(newCandidate, null, 2),
    `YAI Studio: Proposed candidate ${id}`,
    ctx.githubToken,
  );

  return newCandidate;
}

export async function reviewCandidate(
  ctx: StorageContext,
  candidateId: string,
  decision: 'approved' | 'rejected',
): Promise<void> {
  const path = `memory/candidates/${candidateId}.json`;
  const file = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, path, ctx.githubToken);
  if (!file) throw new gh.NotFoundError(`Candidate ${candidateId} not found`);

  const candidate = JSON.parse(file.content) as MemoryCandidate;
  const now = new Date().toISOString();
  candidate.status = decision;
  candidate.reviewedAt = now;

  // 1. Update candidate file
  await gh.updateFile(
    ctx.githubLogin,
    DATA_REPO_NAME,
    path,
    JSON.stringify(candidate, null, 2),
    file.sha,
    `YAI Studio: Candidate ${candidateId} ${decision}`,
    ctx.githubToken,
  );

  // 2. If approved, add to actual persistent memory
  if (decision === 'approved') {
    await addMemoryRecord(ctx, candidate.proposedType, {
      content: candidate.proposedContent,
      source: candidate.sourceConversationId || candidate.sourceActivityId,
      provenance: `Approved candidate from ${candidate.proposedAt}`,
      status: 'active',
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Activity Ledger
// ---------------------------------------------------------------------------

export async function recordActivity(
  ctx: StorageContext,
  event: Omit<ActivityEvent, 'id' | 'timestamp'>,
): Promise<ActivityEvent> {
  const id = generateId();
  const now = new Date();
  const isoTime = now.toISOString();

  const fullEvent: ActivityEvent = {
    id,
    timestamp: isoTime,
    ...event,
  };

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const path = `activity/${year}/${month}/${event.sourceProduct}/${id}.json`;
  preventPathTraversal(path);

  await gh.createFile(
    ctx.githubLogin,
    DATA_REPO_NAME,
    path,
    JSON.stringify(fullEvent, null, 2),
    `YAI Studio: Record activity ${id} from ${event.sourceProduct}`,
    ctx.githubToken,
  );

  return fullEvent;
}

export async function listActivity(
  ctx: StorageContext,
  options?: { year?: number; month?: number; limit?: number },
): Promise<ActivityEvent[]> {
  const year = options?.year || new Date().getUTCFullYear();
  const month = options?.month ? String(options.month).padStart(2, '0') : String(new Date().getUTCMonth() + 1).padStart(2, '0');
  const dirPath = `activity/${year}/${month}`;
  preventPathTraversal(dirPath);

  const events: ActivityEvent[] = [];

  try {
    const products = await gh.listDirectory(ctx.githubLogin, DATA_REPO_NAME, dirPath, ctx.githubToken);
    for (const prod of products) {
      if (prod.type === 'dir') {
        const files = await gh.listDirectory(ctx.githubLogin, DATA_REPO_NAME, prod.path, ctx.githubToken);
        for (const f of files) {
          if (f.type === 'file' && f.path.endsWith('.json')) {
            const file = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, f.path, ctx.githubToken);
            if (file) {
              try {
                events.push(JSON.parse(file.content) as ActivityEvent);
              } catch {
                // skip corrupt
              }
            }
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof gh.NotFoundError) {
      return [];
    }
    throw error;
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return options?.limit ? events.slice(0, options.limit) : events;
}

// ---------------------------------------------------------------------------
// 6. Knowledge
// ---------------------------------------------------------------------------

export async function listKnowledge(ctx: StorageContext): Promise<KnowledgeItem[]> {
  const dirPath = 'knowledge/references';
  try {
    const files = await gh.listDirectory(ctx.githubLogin, DATA_REPO_NAME, dirPath, ctx.githubToken);
    const items: KnowledgeItem[] = [];

    for (const f of files) {
      if (f.type === 'file' && f.path.endsWith('.json')) {
        const file = await gh.getFile(ctx.githubLogin, DATA_REPO_NAME, f.path, ctx.githubToken);
        if (file) {
          try {
            items.push(JSON.parse(file.content) as KnowledgeItem);
          } catch {
            // skip corrupt
          }
        }
      }
    }
    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    if (error instanceof gh.NotFoundError) {
      return [];
    }
    throw error;
  }
}

export async function createKnowledgeItem(
  ctx: StorageContext,
  item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<KnowledgeItem> {
  const id = generateId();
  const now = new Date().toISOString();
  const fullItem: KnowledgeItem = {
    id,
    title: item.title.trim() || 'Untitled Reference',
    content: item.content,
    source: item.source,
    sourceUrl: item.sourceUrl,
    tags: item.tags || [],
    createdAt: now,
    updatedAt: now,
  };

  const path = `knowledge/references/${id}.json`;
  await gh.createFile(
    ctx.githubLogin,
    DATA_REPO_NAME,
    path,
    JSON.stringify(fullItem, null, 2),
    `YAI Studio: Create knowledge item ${fullItem.title}`,
    ctx.githubToken,
  );

  return fullItem;
}
