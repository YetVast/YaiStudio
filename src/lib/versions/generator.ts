import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type {
  ApplicationVersionEntry,
  ChangeType,
  ChangedFileStat,
  MajorVersionConfig,
  VersionHistoryManifest,
} from './types';

export const FALLBACK_COMMIT_DESCRIPTION = 'No extended description was recorded for this commit.';

export interface GitExecutor {
  (args: string[]): string;
}

/**
 * Default Git executor using node:child_process.execFileSync.
 */
export const defaultGitExecutor: GitExecutor = (args: string[]): string => {
  try {
    return execFileSync('git', args, {
      encoding: 'utf-8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error: any) {
    const stderr = error.stderr ? error.stderr.toString().trim() : '';
    const message = error.message || 'Unknown git error';
    throw new Error(`Git command failed [git ${args.join(' ')}]: ${stderr || message}`);
  }
};

/**
 * Classifies commit changes into categorical types based on subject conventions and file paths.
 */
export function classifyChangeTypes(subject: string, changedFiles: string[] = []): ChangeType[] {
  const types = new Set<ChangeType>();
  const lowerSubject = subject.toLowerCase();

  // Conventional prefix detection
  if (/^feat(\(.*\))?:/.test(lowerSubject) || /\b(feature|implement)\b/.test(lowerSubject)) {
    types.add('feature');
  }
  if (/^fix(\(.*\))?:/.test(lowerSubject) || /\b(fix|bug|patch|resolve)\b/.test(lowerSubject)) {
    types.add('fix');
  }
  if (/^refactor(\(.*\))?:/.test(lowerSubject) || /\b(refactor|cleanup|restructure)\b/.test(lowerSubject)) {
    types.add('refactor');
  }
  if (/^perf(\(.*\))?:/.test(lowerSubject) || /\b(performance|optimize|speed)\b/.test(lowerSubject)) {
    types.add('performance');
  }
  if (/^docs(\(.*\))?:/.test(lowerSubject) || /\b(documentation|readme|guide)\b/.test(lowerSubject)) {
    types.add('documentation');
  }
  if (/^test(\(.*\))?:/.test(lowerSubject) || /\b(test|spec|coverage)\b/.test(lowerSubject)) {
    types.add('test');
  }
  if (/^(style|ui|ux)(\(.*\))?:/.test(lowerSubject) || /\b(ui|ux|css|theme|styling)\b/.test(lowerSubject)) {
    types.add('ui');
  }
  if (/^sec(\(.*\))?:/.test(lowerSubject) || /\b(security|vulnerability|cve|vault|auth)\b/.test(lowerSubject)) {
    types.add('security');
  }
  if (/^chore(\(.*\))?:/.test(lowerSubject) || /\b(chore|deps|bump|package)\b/.test(lowerSubject)) {
    types.add('chore');
  }
  if (/^deploy(\(.*\))?:/.test(lowerSubject) || /\b(deploy|vercel|ci|cd)\b/.test(lowerSubject)) {
    types.add('deployment');
  }

  // File path inspection
  const hasOnlyDocs =
    changedFiles.length > 0 &&
    changedFiles.every(
      (f) => f.startsWith('docs/') || f.endsWith('.md') || f.endsWith('.txt') || f.toLowerCase().includes('readme')
    );
  if (hasOnlyDocs) {
    types.add('documentation');
  }

  const hasStyles = changedFiles.some((f) => f.endsWith('.css') || f.includes('/styles/'));
  if (hasStyles) {
    types.add('ui');
  }

  const hasTests = changedFiles.some((f) => f.startsWith('tests/') || f.includes('.test.') || f.includes('.spec.'));
  if (hasTests) {
    types.add('test');
  }

  const hasSecurity = changedFiles.some((f) => f.includes('/auth/') || f.includes('/security/') || f.includes('vault'));
  if (hasSecurity && !types.has('security') && (types.has('feature') || types.has('fix'))) {
    types.add('security');
  }

  if (types.size === 0) {
    types.add('maintenance');
  }

  return Array.from(types);
}

/**
 * Parses git show raw metadata into structured commit info.
 */
export function parseCommitMetadata(rawShow: string): {
  commitHash: string;
  shortCommitHash: string;
  authorName: string;
  authoredAt: string;
  committedAt: string;
  subject: string;
  body: string;
} {
  const parts = rawShow.split('\0');
  if (parts.length < 7) {
    throw new Error(`Malformed git commit output: expected at least 7 null-delimited parts, received ${parts.length}`);
  }

  return {
    commitHash: parts[0].trim(),
    shortCommitHash: parts[1].trim(),
    authorName: parts[2].trim(),
    authoredAt: parts[3].trim(),
    committedAt: parts[4].trim(),
    subject: parts[5].trim(),
    body: parts[6].trim(),
  };
}

/**
 * Parses git diff-tree --numstat output into file stats.
 */
export function parseNumstatOutput(rawNumstat: string): {
  changedFiles: string[];
  fileStats: ChangedFileStat[];
  filesChanged: number;
  insertions: number;
  deletions: number;
} {
  const changedFiles: string[] = [];
  const fileStats: ChangedFileStat[] = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  const lines = rawNumstat.split('\n').filter((l) => l.trim().length > 0);

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      const insRaw = parts[0].trim();
      const delRaw = parts[1].trim();
      const filePath = parts.slice(2).join('\t').trim();

      const ins = insRaw === '-' ? 0 : Number.parseInt(insRaw, 10) || 0;
      const del = delRaw === '-' ? 0 : Number.parseInt(delRaw, 10) || 0;

      changedFiles.push(filePath);
      fileStats.push({ path: filePath, insertions: ins, deletions: del });
      totalInsertions += ins;
      totalDeletions += del;
    }
  }

  return {
    changedFiles,
    fileStats,
    filesChanged: changedFiles.length,
    insertions: totalInsertions,
    deletions: totalDeletions,
  };
}

export interface GenerateOptions {
  repoRoot?: string;
  configPath?: string;
  git?: GitExecutor;
  majorConfig?: MajorVersionConfig;
}

/**
 * Loads the tracked major version config from disk.
 */
export function loadMajorVersionConfig(configFilePath: string): MajorVersionConfig {
  if (!fs.existsSync(configFilePath)) {
    throw new Error(`Major version configuration file not found at: ${configFilePath}`);
  }
  const raw = fs.readFileSync(configFilePath, 'utf-8');
  return JSON.parse(raw) as MajorVersionConfig;
}

/**
 * Core deterministic version history generator.
 */
export function generateVersionHistory(options: GenerateOptions = {}): VersionHistoryManifest {
  const repoRoot = options.repoRoot || process.cwd();
  const git = options.git || defaultGitExecutor;

  // 1. Load config
  const config =
    options.majorConfig ||
    loadMajorVersionConfig(options.configPath || path.join(repoRoot, 'versions', 'major-version.json'));

  const baselineCommit = config.baselineCommit.trim();
  if (!baselineCommit) {
    throw new Error('Major version config is missing baselineCommit.');
  }

  // 2. Verify baseline commit exists in repository
  let baselineFullSha = '';
  try {
    baselineFullSha = git(['rev-parse', '--verify', `${baselineCommit}^{commit}`]).trim();
  } catch (err: any) {
    throw new Error(
      `Documented baseline commit [${baselineCommit}] could not be verified in the Git repository. ${err.message}`
    );
  }

  // 3. Verify baseline commit is an ancestor of HEAD
  try {
    git(['merge-base', '--is-ancestor', baselineFullSha, 'HEAD']);
  } catch (err: any) {
    // If shallow clone, check if repo is shallow
    let isShallow = false;
    try {
      isShallow = git(['rev-parse', '--is-shallow-repository']).trim() === 'true';
    } catch {}

    if (isShallow) {
      throw new Error(
        `Documented baseline commit [${baselineFullSha}] is not in the active Git history. ` +
          `The repository is a shallow clone. Please fetch sufficient depth or unshallow: git fetch --unshallow`
      );
    }

    throw new Error(
      `Documented baseline commit [${baselineFullSha}] exists but is not an ancestor of HEAD in current branch history.`
    );
  }

  // 4. Retrieve commit list from baseline to HEAD (inclusive of baseline)
  const subsequentRaw = git(['rev-list', '--reverse', `${baselineFullSha}..HEAD`]).trim();
  const subsequentShas = subsequentRaw ? subsequentRaw.split('\n').map((s) => s.trim()).filter(Boolean) : [];
  const chronologicalShas = [baselineFullSha, ...subsequentShas];

  // 5. Sequential numbering & major version evaluation
  const chronologicalEntries: ApplicationVersionEntry[] = [];

  let currentMajor = 0;
  let currentSequence = 0;

  for (let i = 0; i < chronologicalShas.length; i++) {
    const sha = chronologicalShas[i];
    const isBaseline = sha === baselineFullSha;

    // Get commit metadata
    const rawShow = git(['show', '-s', '--format=%H%x00%h%x00%an%x00%aI%x00%cI%x00%s%x00%b', sha]);
    const meta = parseCommitMetadata(rawShow);

    // Get diff stats
    const rawNumstat = git(['diff-tree', '--no-commit-id', '--numstat', '-r', sha]);
    const numstat = parseNumstatOutput(rawNumstat);

    // Classify changes
    const changeTypes = classifyChangeTypes(meta.subject, numstat.changedFiles);

    // Evaluate major version boundary:
    // Check if an explicit milestone was designated for this commit
    const milestoneMatch = config.milestones.find(
      (m) => m.startCommit && m.startCommit.toLowerCase() === sha.toLowerCase()
    );

    let isMajorVersionStart = false;

    if (isBaseline) {
      currentMajor = 0;
      currentSequence = 1;
    } else if (milestoneMatch && milestoneMatch.major > currentMajor) {
      // Explicit milestone start in config
      currentMajor = milestoneMatch.major;
      currentSequence = 1;
      isMajorVersionStart = true;
    } else if (numstat.changedFiles.some((f) => f.includes('major-version.json'))) {
      // Check if major-version.json changed currentMajor in this commit
      try {
        const fileContent = git(['show', `${sha}:versions/major-version.json`]);
        const parsed = JSON.parse(fileContent);
        if (typeof parsed.currentMajor === 'number' && parsed.currentMajor > currentMajor) {
          currentMajor = parsed.currentMajor;
          currentSequence = 1;
          isMajorVersionStart = true;
        } else {
          currentSequence += 1;
        }
      } catch {
        currentSequence += 1;
      }
    } else {
      currentSequence += 1;
    }

    const versionStr = `v${currentMajor}.${currentSequence}`;
    const hasExtended = meta.body.length > 0;
    const description = hasExtended ? meta.body : FALLBACK_COMMIT_DESCRIPTION;

    chronologicalEntries.push({
      version: versionStr,
      major: currentMajor,
      sequence: currentSequence,
      commitHash: meta.commitHash,
      shortCommitHash: meta.shortCommitHash,
      subject: meta.subject,
      description,
      hasExtendedDescription: hasExtended,
      authorName: meta.authorName,
      authoredAt: meta.authoredAt,
      committedAt: meta.committedAt,
      changeType: changeTypes,
      changedFiles: numstat.changedFiles,
      fileStats: numstat.fileStats,
      filesChanged: numstat.filesChanged,
      insertions: numstat.insertions,
      deletions: numstat.deletions,
      isBaseline,
      isMajorVersionStart,
    });
  }

  // 6. Reverse entries so latest version is first
  const latestFirst = [...chronologicalEntries].reverse();
  const currentVersion = latestFirst[0]?.version || 'v0.1';
  const baselineEntry = chronologicalEntries[0];

  const manifest: VersionHistoryManifest = {
    applicationName: 'YAI Studio',
    repository: 'YetVastSolutions/YaiStudio',
    generatedAt: new Date().toISOString(),
    currentVersion,
    currentMajor,
    totalVersions: latestFirst.length,
    baseline: {
      version: baselineEntry.version,
      commitHash: baselineEntry.commitHash,
      shortCommitHash: baselineEntry.shortCommitHash,
      subject: baselineEntry.subject,
      committedAt: baselineEntry.committedAt,
    },
    milestones: config.milestones,
    versions: latestFirst,
  };

  return manifest;
}
