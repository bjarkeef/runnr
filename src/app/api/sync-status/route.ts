import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStoredTokens } from '@/lib/auth';

const SYNC_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
  try {
    const auth = await getStoredTokens();
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { stravaId } = auth;

    // Get user's last sync time
    const user = await prisma.user.findUnique({
      where: { stravaId },
      select: { lastSyncedAt: true },
    });

    const lastSyncedAt = user?.lastSyncedAt || null;
    const timeSinceSync = lastSyncedAt ? Date.now() - lastSyncedAt.getTime() : Infinity;
    const needsSync = timeSinceSync > SYNC_THRESHOLD_MS;

    return NextResponse.json({
      lastSyncedAt,
      needsSync,
      timeSinceSync: lastSyncedAt ? Math.floor(timeSinceSync / 1000 / 60) : null, // in minutes
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check sync status', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
