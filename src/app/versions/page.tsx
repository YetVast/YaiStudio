import React from 'react';
import manifest from '@/generated/version-history.json';
import VersionsClient from './VersionsClient';
import type { VersionHistoryManifest } from '@/lib/versions/types';

export const dynamic = 'force-static';

export default function VersionsPage() {
  const versionData = manifest as unknown as VersionHistoryManifest;
  return <VersionsClient manifest={versionData} />;
}
