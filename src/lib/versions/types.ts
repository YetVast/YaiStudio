/**
 * Yet Vast Solutions — Application Version History System Types
 * Reference: YVS_APPLICATION_VERSION_HISTORY_STANDARD.md
 */

export type ChangeType =
  | 'feature'
  | 'fix'
  | 'refactor'
  | 'performance'
  | 'documentation'
  | 'ui'
  | 'security'
  | 'test'
  | 'chore'
  | 'deployment'
  | 'maintenance';

export interface ChangedFileStat {
  path: string;
  insertions: number;
  deletions: number;
}

export interface ApplicationVersionEntry {
  /** Two-part version string, e.g. "v0.1", "v0.2", "v1.1" */
  version: string;
  /** Major version component X */
  major: number;
  /** Sequence component Y within the major (1-based) */
  sequence: number;
  /** Full 40-character Git commit hash */
  commitHash: string;
  /** 7-character abbreviated commit hash */
  shortCommitHash: string;
  /** Commit subject (first line) */
  subject: string;
  /** Commit body / extended description (or fallback text) */
  description: string;
  /** Indicates whether an extended commit body was authored */
  hasExtendedDescription: boolean;
  /** Commit author display name (emails omitted for privacy) */
  authorName: string;
  /** Author date in ISO-8601 */
  authoredAt: string;
  /** Commit date in ISO-8601 */
  committedAt: string;
  /** Branch name if known */
  branch?: string;
  /** Classified change categories */
  changeType: ChangeType[];
  /** List of changed file paths */
  changedFiles: string[];
  /** Detailed file stats with insertions/deletions per file */
  fileStats?: ChangedFileStat[];
  /** Total count of files modified, added, or deleted */
  filesChanged: number;
  /** Total lines inserted */
  insertions: number;
  /** Total lines deleted */
  deletions: number;
  /** True for the documented baseline commit v0.1 */
  isBaseline: boolean;
  /** True for the first commit in a major version (vX.1) */
  isMajorVersionStart: boolean;
  /** Optional tags associated with this commit */
  tags?: string[];
}

export interface VersionMilestone {
  major: number;
  name: string;
  startCommit?: string;
  authorizedBy: string;
  authorizedDate: string;
  description: string;
}

export interface MajorVersionConfig {
  $schema?: string;
  baselineCommit: string;
  baselineVersion: string;
  currentMajor: number;
  milestones: VersionMilestone[];
}

export interface VersionHistoryManifest {
  /** Application display name */
  applicationName: string;
  /** Repository identifier */
  repository: string;
  /** Manifest generation timestamp (ISO-8601) */
  generatedAt: string;
  /** Current / latest version string */
  currentVersion: string;
  /** Current major version integer */
  currentMajor: number;
  /** Total count of tracked versions */
  totalVersions: number;
  /** Documented baseline metadata */
  baseline: {
    version: string;
    commitHash: string;
    shortCommitHash: string;
    subject: string;
    committedAt: string;
  };
  /** Explicit major version milestones */
  milestones: VersionMilestone[];
  /** Complete version history, ordered latest-to-oldest */
  versions: ApplicationVersionEntry[];
}
