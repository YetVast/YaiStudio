/**
 * YAI Studio — GitHub REST API client (server-only)
 *
 * Thin wrapper over the GitHub Contents API (api.github.com). All content is
 * Base64-encoded/decoded here; callers work with plain UTF-8 strings. Never
 * log or expose the token passed to any function.
 *
 * Error hierarchy:
 *   GitHubApiError       — base, carries status + message
 *   ├── NotFoundError    — HTTP 404
 *   ├── ConflictError    — HTTP 409 (SHA mismatch)
 *   ├── ValidationError  — HTTP 422
 *   └── RateLimitError   — HTTP 403 / 429 (rate-limited)
 *
 * @module lib/github/api-client
 */
import 'server-only';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export class NotFoundError extends GitHubApiError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends GitHubApiError {
  constructor(message = 'SHA conflict — file was modified since last read') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends GitHubApiError {
  constructor(message = 'GitHub API validation error') {
    super(message, 422);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends GitHubApiError {
  constructor(
    message = 'GitHub API rate limit exceeded',
    public readonly retryAfter?: number,
  ) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

// ---------------------------------------------------------------------------
// Response shapes (internal)
// ---------------------------------------------------------------------------

export interface GitHubFile {
  /** Repository-relative path */
  path: string;
  /** Decoded UTF-8 content (not Base64) */
  content: string;
  /** Current file SHA — required for updates and deletes */
  sha: string;
  size: number;
}

export interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.github.com';

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

/** Decode GitHub's Base64-encoded content (may include newlines). */
function decodeContent(encoded: string): string {
  // GitHub wraps Base64 at 60 chars with \n — strip before decoding
  const stripped = encoded.replace(/\n/g, '');
  return Buffer.from(stripped, 'base64').toString('utf-8');
}

/** Encode plain text to Base64 for GitHub API payloads. */
function encodeContent(content: string): string {
  return Buffer.from(content, 'utf-8').toString('base64');
}

/** Parse and throw typed errors from a GitHub API response. */
async function throwIfError(response: Response): Promise<void> {
  if (response.ok) return;

  const status = response.status;
  let body: { message?: string } = {};
  try {
    body = (await response.json()) as { message?: string };
  } catch {
    // ignore JSON parse failure
  }

  const msg = body.message ?? response.statusText;

  if (status === 404) throw new NotFoundError(msg);
  if (status === 409) throw new ConflictError(msg);
  if (status === 422) throw new ValidationError(msg);
  if (status === 403 || status === 429) {
    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
    throw new RateLimitError(msg, retryAfter);
  }

  throw new GitHubApiError(`GitHub API error ${status}: ${msg}`, status);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a single file's contents. Returns null when the file does not exist
 * (404) rather than throwing. All other errors are rethrown.
 */
export async function getFile(
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<GitHubFile | null> {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;
  const response = await fetch(url, {
    headers: authHeaders(token),
    // Ensure fresh data for SHA-dependent operations
    cache: 'no-store',
  });

  if (response.status === 404) return null;
  await throwIfError(response);

  const data = (await response.json()) as {
    path: string;
    content: string;
    sha: string;
    size: number;
    type: string;
  };

  if (data.type !== 'file') {
    throw new GitHubApiError(`Expected a file at '${path}', got '${data.type}'`, 400);
  }

  return {
    path: data.path,
    content: decodeContent(data.content),
    sha: data.sha,
    size: data.size,
  };
}

/**
 * Create a new file in the repository. Throws ConflictError if a file already
 * exists at the path (GitHub returns 422 for this case — mapped accordingly).
 */
export async function createFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  token: string,
): Promise<{ sha: string }> {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({
      message,
      content: encodeContent(content),
    }),
  });

  await throwIfError(response);
  const data = (await response.json()) as { content: { sha: string } };
  return { sha: data.content.sha };
}

/**
 * Update an existing file. The sha must match the current HEAD sha of the
 * file; mismatches throw ConflictError.
 */
export async function updateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  sha: string,
  message: string,
  token: string,
): Promise<{ sha: string }> {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({
      message,
      content: encodeContent(content),
      sha,
    }),
  });

  await throwIfError(response);
  const data = (await response.json()) as { content: { sha: string } };
  return { sha: data.content.sha };
}

/**
 * Delete a file. The sha must match the current HEAD sha.
 */
export async function deleteFile(
  owner: string,
  repo: string,
  path: string,
  sha: string,
  message: string,
  token: string,
): Promise<void> {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ message, sha }),
  });

  await throwIfError(response);
}

/**
 * List the immediate contents of a directory. Returns an empty array when the
 * directory does not exist (404). Blobs (files) and trees (directories) are
 * both included.
 */
export async function listDirectory(
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<GitHubTreeItem[]> {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;
  const response = await fetch(url, {
    headers: authHeaders(token),
    cache: 'no-store',
  });

  if (response.status === 404) return [];
  await throwIfError(response);

  const data = (await response.json()) as Array<{
    path: string;
    type: string;
    sha: string;
    size?: number;
  }>;

  if (!Array.isArray(data)) {
    // Single file returned — path was a file, not a directory
    throw new GitHubApiError(`Path '${path}' is a file, not a directory`, 400);
  }

  return data.map((item) => ({
    path: item.path,
    type: item.type === 'dir' ? 'tree' : 'blob',
    sha: item.sha,
    size: item.size,
  }));
}

/**
 * Fetch repository metadata. Returns null when not found (404).
 */
export async function getRepository(
  owner: string,
  repo: string,
  token: string,
): Promise<{ private: boolean; full_name: string; owner: { login: string } } | null> {
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const response = await fetch(url, {
    headers: authHeaders(token),
    cache: 'no-store',
  });

  if (response.status === 404) return null;
  await throwIfError(response);

  const data = (await response.json()) as {
    private: boolean;
    full_name: string;
    owner: { login: string };
  };

  return {
    private: data.private,
    full_name: data.full_name,
    owner: { login: data.owner.login },
  };
}

/**
 * Create a new repository under the authenticated user's account.
 */
export async function createRepository(
  name: string,
  isPrivate: boolean,
  token: string,
  description?: string,
): Promise<{ full_name: string; html_url: string }> {
  const url = `${API_BASE}/user/repos`;
  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: false,
      description:
        description ??
        'YAI Studio — Personal Intelligence data repository (YVS private storage)',
    }),
  });

  await throwIfError(response);
  const data = (await response.json()) as { full_name: string; html_url: string };
  return { full_name: data.full_name, html_url: data.html_url };
}
