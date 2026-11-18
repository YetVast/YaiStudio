/**
 * YAI Studio — Path utilities (server-only)
 *
 * Provides safe, deterministic path manipulation for all storage operations.
 * Every function in this module prevents path traversal attacks before any
 * GitHub API call is made.
 *
 * @module lib/storage/path-utils
 */
import 'server-only';

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class PathTraversalError extends Error {
  constructor(path: string) {
    super(`Path traversal detected in: "${path}"`);
    this.name = 'PathTraversalError';
  }
}

// ---------------------------------------------------------------------------
// UUID generation
// ---------------------------------------------------------------------------

/** Generate a cryptographically random UUID (v4). */
export function generateId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Returns true if the string is a valid UUID v4 (or any UUID).
 * Used to validate conversation IDs before constructing repo paths.
 */
export function validateConversationId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Throws PathTraversalError if the path contains parent-directory traversals
 * (`..`) or starts with a forward slash (absolute path injection).
 *
 * Call this for any path component that may contain user input before
 * constructing a full repo path.
 */
export function preventPathTraversal(path: string): void {
  if (path.startsWith('/') || path.includes('..')) {
    throw new PathTraversalError(path);
  }
  // Reject any form of Windows/UNC path escape
  if (/^[a-zA-Z]:/.test(path) || path.startsWith('\\\\')) {
    throw new PathTraversalError(path);
  }
}

// ---------------------------------------------------------------------------
// Workspace name sanitisation
// ---------------------------------------------------------------------------

/**
 * Maximum byte length for a workspace directory name.
 * No YAI-specific limit has been decided, so we use a reasonable default
 * of 100 characters (see docs: Cogmit's 57-char limit is not adopted).
 */
const MAX_WORKSPACE_NAME_LENGTH = 100;

/** Characters that are unsafe in GitHub file/directory names. */
const UNSAFE_NAME_CHARS = /[/\\:*?"<>|#%&{}$!@+`=]/g;

/**
 * Sanitise a user-supplied workspace name so it is safe for use as a
 * repository directory name:
 * - strips path separators and other unsafe characters
 * - collapses runs of whitespace to a single space and trims
 * - enforces maximum length
 * - never returns empty string (throws if result would be empty)
 */
export function sanitizeWorkspaceName(name: string): string {
  const sanitized = name
    .replace(UNSAFE_NAME_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_WORKSPACE_NAME_LENGTH);

  if (sanitized.length === 0) {
    throw new Error('Workspace name is empty after sanitisation');
  }

  // Reject reserved names (case-insensitive)
  const reserved = new Set(['con', 'prn', 'aux', 'nul', 'com1', 'lpt1']);
  if (reserved.has(sanitized.toLowerCase())) {
    throw new Error(`Workspace name "${sanitized}" is a reserved name`);
  }

  return sanitized;
}

// ---------------------------------------------------------------------------
// Conversation path construction
// ---------------------------------------------------------------------------

/**
 * Compute the repository-relative directory path for a conversation.
 *
 * @param workspacePath - Repository-relative path to the workspace directory,
 *   or null for unfiled conversations.
 * @param conversationId - Validated UUID for the conversation.
 */
export function getConversationPath(
  workspacePath: string | null,
  conversationId: string,
): string {
  if (!validateConversationId(conversationId)) {
    throw new Error(`Invalid conversation ID: "${conversationId}"`);
  }

  if (workspacePath === null) {
    return `unfiledConversations/${conversationId}`;
  }

  preventPathTraversal(workspacePath);
  return `${workspacePath}/${conversationId}`;
}

// ---------------------------------------------------------------------------
// Memory type → filename mapping
// ---------------------------------------------------------------------------

/** Map a MemoryType to its on-disk filename inside memory/. */
export function memoryTypeToFilename(type: string): string {
  const map: Record<string, string> = {
    fact: 'facts.json',
    preference: 'preferences.json',
    interest: 'interests.json',
    goal: 'goals.json',
    relationship: 'relationships.json',
    decision: 'decisions.json',
  };
  const filename = map[type];
  if (!filename) throw new Error(`Unknown memory type: "${type}"`);
  return filename;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Format a Date as YYYY/MM for activity partitioning. */
export function dateToActivityPartition(date: Date): { year: string; month: string } {
  const year = date.getUTCFullYear().toString();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  return { year, month };
}
