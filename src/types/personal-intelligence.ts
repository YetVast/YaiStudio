/**
 * YAI Studio — Personal Intelligence Domain Types
 *
 * This file is imported from server-only modules. Do not import from client
 * components. Types here reflect the exact on-disk JSON schema stored in the
 * user's private `YVSApps_Data_YaiStudio` GitHub repository.
 *
 * @module types/personal-intelligence
 */

// ---------------------------------------------------------------------------
// Repository-level manifest
// ---------------------------------------------------------------------------

export interface YaiManifest {
  /** Semver string, currently "1.0.0" */
  version: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  /** Integer schema version for migration tracking */
  schemaVersion: number;
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export interface WorkspaceData {
  /** Stable UUID — survives directory renames */
  id: string;
  /** Must match the directory name in the repository */
  name: string;
  description?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  /** Optional branding colour (CSS colour string) */
  color?: string;
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

export interface ConversationMeta {
  /** Stable UUID — survives moves */
  id: string;
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  /**
   * Repository-relative path to the workspace directory, or null if
   * unfiled (lives in unfiledConversations/).
   */
  workspacePath: string | null;
  status: 'active' | 'archived';
  /** Identifier of the AI model used in this conversation */
  model?: string;
  /** Name of the AI provider */
  provider?: string;
}

export interface Message {
  /** Stable UUID */
  id: string;
  /** 1-based monotonic sequence number within the conversation */
  sequence: number;
  role: 'user' | 'assistant' | 'system';
  /** Raw text content (Markdown allowed) */
  content: string;
  createdAt: string; // ISO 8601
  model?: string;
  provider?: string;
  tokenCount?: number;
}

/**
 * Canonical structured message file (messages.json).
 * This is the source of truth; conversation.md is generated from it.
 */
export interface MessagesFile {
  conversationId: string;
  messages: Message[];
}

// ---------------------------------------------------------------------------
// Global conversations index
// ---------------------------------------------------------------------------

export interface ConversationIndexEntry {
  /** Stable conversation UUID */
  id: string;
  title: string;
  /** Immediate workspace name, or null for unfiled conversations */
  workspaceName: string | null;
  /** Repository-relative path to the conversation directory */
  path: string;
  updatedAt: string; // ISO 8601
}

export interface ConversationsIndex {
  schemaVersion: number;
  updatedAt: string; // ISO 8601
  conversations: ConversationIndexEntry[];
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export type MemoryStatus = 'active' | 'archived' | 'rejected';
export type MemoryType =
  | 'fact'
  | 'preference'
  | 'interest'
  | 'goal'
  | 'relationship'
  | 'decision';

export interface MemoryRecord {
  /** Stable UUID */
  id: string;
  type: MemoryType;
  /** Human-readable memory value */
  content: string;
  /** Source identifier: conversation ID or activity event ID */
  source?: string;
  /** Human-readable provenance description */
  provenance?: string;
  status: MemoryStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  /**
   * Confidence score 0–1. Only present when explicitly set by the
   * extraction workflow; do not default to any value.
   */
  confidence?: number;
}

/** On-disk memory file (e.g. memory/facts.json) */
export interface MemoryFile {
  schemaVersion: number;
  updatedAt: string; // ISO 8601
  records: MemoryRecord[];
}

// ---------------------------------------------------------------------------
// Memory candidates (pending user approval)
// ---------------------------------------------------------------------------

export interface MemoryCandidate {
  /** Stable UUID */
  id: string;
  proposedType: MemoryType;
  proposedContent: string;
  sourceActivityId?: string;
  sourceConversationId?: string;
  proposedAt: string; // ISO 8601
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Activity ledger
// ---------------------------------------------------------------------------

export interface ActivityEvent {
  /** Stable UUID */
  id: string;
  timestamp: string; // ISO 8601
  /** Product identifier, e.g. 'yai-studio' */
  sourceProduct: string;
  /** User query summary (null when activity retention is off) */
  querySummary?: string;
  responseSummary?: string;
  retrievedMemoryIds?: string[];
  model?: string;
  provider?: string;
  executionMode: 'cloud' | 'local';
  memoryCandidateIds?: string[];
  resultingMemoryIds?: string[];
}

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

export interface KnowledgeItem {
  /** Stable UUID */
  id: string;
  title: string;
  /** Full body text in Markdown */
  content: string;
  source?: string;
  sourceUrl?: string;
  tags?: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Storage context
// ---------------------------------------------------------------------------

/** Passed to every storage operation. Never log or expose the token. */
export interface StorageContext {
  githubToken: string;
  /** Authenticated GitHub username (login) */
  githubLogin: string;
  /** Exact name of the user's data repository — constant */
  repoName: 'YVSApps_Data_YaiStudio';
}
