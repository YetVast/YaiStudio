import { NextResponse } from 'next/server';
import manifest from '@/generated/version-history.json';

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  });
}
