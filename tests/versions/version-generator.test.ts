import { describe, it, expect } from 'vitest';
import {
  generateVersionHistory,
  classifyChangeTypes,
  parseCommitMetadata,
  parseNumstatOutput,
  FALLBACK_COMMIT_DESCRIPTION,
  type GitExecutor,
} from '@/lib/versions/generator';
import type { MajorVersionConfig } from '@/lib/versions/types';

describe('Version History Generator', () => {
  const mockConfig: MajorVersionConfig = {
    baselineCommit: 'd4cabebcfd960b6547dd5217669c60d508982c28',
    baselineVersion: 'v0.1',
    currentMajor: 0,
    milestones: [
      {
        major: 0,
        name: 'Baseline V0',
        startCommit: 'd4cabebcfd960b6547dd5217669c60d508982c28',
        authorizedBy: 'Yagnavalk Chaapala',
        authorizedDate: '2026-11-19T12:29:34+05:30',
        description: 'Baseline',
      },
    ],
  };

  it('correctly classifies change types from subject and file paths', () => {
    // Feature
    expect(classifyChangeTypes('feat: add voice synthesis')).toContain('feature');
    // Fix
    expect(classifyChangeTypes('fix(auth): resolve cookie expiration')).toContain('fix');
    // Docs
    expect(classifyChangeTypes('docs: update architecture guide', ['docs/guide.md'])).toContain('documentation');
    // UI
    expect(classifyChangeTypes('style: refine button tokens', ['src/styles/tokens.css'])).toContain('ui');
    // Test
    expect(classifyChangeTypes('test: add unit tests for sync', ['tests/sync.test.ts'])).toContain('test');
    // Refactor
    expect(classifyChangeTypes('refactor: split storage adapter')).toContain('refactor');
    // Security
    expect(classifyChangeTypes('fix(security): sanitize markdown tokens', ['src/lib/auth/token.ts'])).toContain('security');
  });

  it('correctly parses raw git show null-delimited output', () => {
    const parts = [
      'd4cabebcfd960b6547dd5217669c60d508982c28',
      'd4cabeb',
      'Yagnavalk Chaapala',
      '2026-11-19T12:29:34+05:30',
      '2026-11-19T12:29:34+05:30',
      'UI Improvements',
      'Detailed body line 1\nLine 2',
    ];
    const raw = parts.join('\0');
    const parsed = parseCommitMetadata(raw);
    expect(parsed.commitHash).toBe('d4cabebcfd960b6547dd5217669c60d508982c28');
    expect(parsed.shortCommitHash).toBe('d4cabeb');
    expect(parsed.authorName).toBe('Yagnavalk Chaapala');
    expect(parsed.subject).toBe('UI Improvements');
    expect(parsed.body).toBe('Detailed body line 1\nLine 2');
  });

  it('correctly parses git diff-tree numstat lines', () => {
    const raw = `10\t2\tsrc/index.ts\n50\t0\tdocs/README.md\n-\t-\tpublic/logo.png`;
    const parsed = parseNumstatOutput(raw);
    expect(parsed.filesChanged).toBe(3);
    expect(parsed.insertions).toBe(60);
    expect(parsed.deletions).toBe(2);
    expect(parsed.changedFiles).toEqual(['src/index.ts', 'docs/README.md', 'public/logo.png']);
  });

  it('maps initial baseline commit d4cabeb to v0.1 and increments sequentially', () => {
    const baselineSha = 'd4cabebcfd960b6547dd5217669c60d508982c28';
    const secondSha = 'fd909fb82d1c2d0bd28ef51de8105b2d0746502f';
    const thirdSha = '597b3bd1f7c137f0b30d384a1b99459d07f94af2';

    const mockGit: GitExecutor = (args: string[]) => {
      const cmd = args.join(' ');
      if (cmd.includes('rev-parse --verify')) {
        return baselineSha;
      }
      if (cmd.includes('merge-base --is-ancestor')) {
        return '';
      }
      if (cmd.includes('rev-list --reverse')) {
        return `${secondSha}\n${thirdSha}`;
      }
      if (cmd.includes(`show -s`) && cmd.includes(baselineSha)) {
        return [baselineSha, 'd4cabeb', 'Yagnavalk', '2026-11-19T12:00:00Z', '2026-11-19T12:00:00Z', 'UI Consistency', ''].join('\0');
      }
      if (cmd.includes(`show -s`) && cmd.includes(secondSha)) {
        return [secondSha, 'fd909fb', 'Yagnavalk', '2026-11-19T12:30:00Z', '2026-11-19T12:30:00Z', 'docs: update v0 documentation', ''].join('\0');
      }
      if (cmd.includes(`show -s`) && cmd.includes(thirdSha)) {
        return [thirdSha, '597b3bd', 'Yagnavalk', '2026-11-19T13:00:00Z', '2026-11-19T13:00:00Z', 'fix: fix minor button styling', ''].join('\0');
      }
      if (cmd.includes('diff-tree')) {
        return `5\t1\tsrc/file.ts`;
      }
      return '';
    };

    const manifest = generateVersionHistory({
      git: mockGit,
      majorConfig: mockConfig,
    });

    expect(manifest.totalVersions).toBe(3);
    // Ordered latest-to-oldest
    expect(manifest.versions[0].version).toBe('v0.3');
    expect(manifest.versions[0].shortCommitHash).toBe('597b3bd');
    expect(manifest.versions[0].changeType).toContain('fix');

    expect(manifest.versions[1].version).toBe('v0.2');
    expect(manifest.versions[1].shortCommitHash).toBe('fd909fb');
    expect(manifest.versions[1].changeType).toContain('documentation');

    // Baseline is at the bottom
    expect(manifest.versions[2].version).toBe('v0.1');
    expect(manifest.versions[2].shortCommitHash).toBe('d4cabeb');
    expect(manifest.versions[2].isBaseline).toBe(true);

    expect(manifest.baseline.version).toBe('v0.1');
    expect(manifest.baseline.shortCommitHash).toBe('d4cabeb');
  });

  it('handles missing commit descriptions honestly without fabricating text', () => {
    const baselineSha = 'd4cabebcfd960b6547dd5217669c60d508982c28';
    const mockGit: GitExecutor = (args: string[]) => {
      const cmd = args.join(' ');
      if (cmd.includes('rev-parse --verify')) return baselineSha;
      if (cmd.includes('merge-base --is-ancestor')) return '';
      if (cmd.includes('rev-list --reverse')) return '';
      if (cmd.includes('show -s')) {
        return [baselineSha, 'd4cabeb', 'Yagnavalk', '2026-11-19T12:00:00Z', '2026-11-19T12:00:00Z', 'Subject only', ''].join('\0');
      }
      return '1\t0\tREADME.md';
    };

    const manifest = generateVersionHistory({ git: mockGit, majorConfig: mockConfig });
    expect(manifest.versions[0].hasExtendedDescription).toBe(false);
    expect(manifest.versions[0].description).toBe(FALLBACK_COMMIT_DESCRIPTION);
  });

  it('preserves extended commit descriptions when authored', () => {
    const baselineSha = 'd4cabebcfd960b6547dd5217669c60d508982c28';
    const body = 'Detailed explanation of why this was changed.\n\nVerification: npm test passed.';
    const mockGit: GitExecutor = (args: string[]) => {
      const cmd = args.join(' ');
      if (cmd.includes('rev-parse --verify')) return baselineSha;
      if (cmd.includes('merge-base --is-ancestor')) return '';
      if (cmd.includes('rev-list --reverse')) return '';
      if (cmd.includes('show -s')) {
        return [baselineSha, 'd4cabeb', 'Yagnavalk', '2026-11-19T12:00:00Z', '2026-11-19T12:00:00Z', 'Subject line', body].join('\0');
      }
      return '1\t0\tREADME.md';
    };

    const manifest = generateVersionHistory({ git: mockGit, majorConfig: mockConfig });
    expect(manifest.versions[0].hasExtendedDescription).toBe(true);
    expect(manifest.versions[0].description).toBe(body);
  });

  it('handles explicit major version increments deterministically', () => {
    const c1 = 'd4cabebcfd960b6547dd5217669c60d508982c28';
    const c2 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const c3 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; // Major 1 authorized commit!
    const c4 = 'cccccccccccccccccccccccccccccccccccccccc';

    const configWithMajor1: MajorVersionConfig = {
      ...mockConfig,
      currentMajor: 1,
      milestones: [
        mockConfig.milestones[0],
        {
          major: 1,
          name: 'YAI Studio V1 Local-First Architecture',
          startCommit: c3,
          authorizedBy: 'Yagnavalk Chaapala',
          authorizedDate: '2026-11-19T14:00:00Z',
          description: 'V1 Milestone',
        },
      ],
    };

    const mockGit: GitExecutor = (args: string[]) => {
      const cmd = args.join(' ');
      if (cmd.includes('rev-parse --verify')) return c1;
      if (cmd.includes('merge-base --is-ancestor')) return '';
      if (cmd.includes('rev-list --reverse')) return `${c2}\n${c3}\n${c4}`;
      if (cmd.includes('show -s')) {
        const hash = args[args.length - 1];
        return [hash, hash.slice(0, 7), 'Author', '2026-11-19T12:00:00Z', '2026-11-19T12:00:00Z', `Commit ${hash.slice(0, 4)}`, ''].join('\0');
      }
      return '2\t1\tfile.ts';
    };

    const manifest = generateVersionHistory({
      git: mockGit,
      majorConfig: configWithMajor1,
    });

    expect(manifest.totalVersions).toBe(4);
    // Ordered latest to oldest:
    // c4 -> v1.2
    expect(manifest.versions[0].version).toBe('v1.2');
    expect(manifest.versions[0].major).toBe(1);
    expect(manifest.versions[0].sequence).toBe(2);

    // c3 -> v1.1 (Major version start!)
    expect(manifest.versions[1].version).toBe('v1.1');
    expect(manifest.versions[1].major).toBe(1);
    expect(manifest.versions[1].sequence).toBe(1);
    expect(manifest.versions[1].isMajorVersionStart).toBe(true);

    // c2 -> v0.2
    expect(manifest.versions[2].version).toBe('v0.2');
    expect(manifest.versions[2].major).toBe(0);
    expect(manifest.versions[2].sequence).toBe(2);

    // c1 -> v0.1 (Baseline)
    expect(manifest.versions[3].version).toBe('v0.1');
    expect(manifest.versions[3].major).toBe(0);
    expect(manifest.versions[3].sequence).toBe(1);
    expect(manifest.versions[3].isBaseline).toBe(true);
  });

  it('fails with clear error if documented baseline commit does not exist', () => {
    const invalidConfig: MajorVersionConfig = {
      ...mockConfig,
      baselineCommit: '0000000000000000000000000000000000000000',
    };

    const mockGit: GitExecutor = () => {
      throw new Error('fatal: Not a valid object name');
    };

    expect(() =>
      generateVersionHistory({ git: mockGit, majorConfig: invalidConfig })
    ).toThrowError(/Documented baseline commit \[0000000000000000000000000000000000000000\] could not be verified/);
  });

  it('fails with clear error if baseline is not an ancestor of HEAD (e.g. shallow clone)', () => {
    const mockGit: GitExecutor = (args: string[]) => {
      const cmd = args.join(' ');
      if (cmd.includes('rev-parse --verify')) return mockConfig.baselineCommit;
      if (cmd.includes('merge-base --is-ancestor')) {
        throw new Error('exit code 1');
      }
      if (cmd.includes('rev-parse --is-shallow-repository')) {
        return 'true';
      }
      return '';
    };

    expect(() =>
      generateVersionHistory({ git: mockGit, majorConfig: mockConfig })
    ).toThrowError(/shallow clone/);
  });

  it('successfully generates manifest from actual current repository Git history', () => {
    const manifest = generateVersionHistory();
    expect(manifest.applicationName).toBe('YAI Studio');
    expect(manifest.totalVersions).toBeGreaterThanOrEqual(6);
    expect(manifest.baseline.version).toBe('v0.1');
    expect(manifest.baseline.shortCommitHash).toBe('d4cabeb');
    expect(manifest.versions[0].version).toMatch(/^v0\.\d+$/);
    expect(manifest.versions[manifest.versions.length - 1].version).toBe('v0.1');
    expect(manifest.versions[manifest.versions.length - 1].isBaseline).toBe(true);
  }, 15000);
});
