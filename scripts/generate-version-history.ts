#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVersionHistory } from '../src/lib/versions/generator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'src', 'generated', 'version-history.json');
const outputDir = path.dirname(outputPath);

function main() {
  console.log('[Version History] Generating application version manifest from Git history...');

  try {
    const manifest = generateVersionHistory({ repoRoot });

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(
      `[Version History] Successfully generated manifest: ` +
        `${manifest.totalVersions} versions tracked. Current: ${manifest.currentVersion}. Baseline: ${manifest.baseline.version} (${manifest.baseline.shortCommitHash}).`
    );
  } catch (error: any) {
    // If output manifest already exists and git failed (e.g. deployment container without git or tarball),
    // warn but do not abort if manifest is valid.
    if (fs.existsSync(outputPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
        if (existing.versions && Array.isArray(existing.versions) && existing.versions.length > 0) {
          console.warn(
            `[Version History] Warning: Git generation failed (${error.message}). ` +
              `Using existing pre-generated manifest at ${outputPath} (Current: ${existing.currentVersion}).`
          );
          return;
        }
      } catch {}
    }

    console.error(`[Version History] Fatal generation error: ${error.message}`);
    process.exit(1);
  }
}

main();
