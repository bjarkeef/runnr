import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const SYNC_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
  try {
    const cookieStore = await cookies();
    const storedTokens = cookieStore.get('runnr_strava_tokens')?.value;

    if (!storedTokens) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const parsedTokens = JSON.parse(storedTokens);
    const stravaId = parsedTokens.athleteId || parsedTokens.athlete?.id || parsedTokens.stravaId;

    if (!stravaId) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
    }

    // Get user's last sync time
    const user = await prisma.user.findUnique({
      where: { stravaId: parseInt(stravaId) },
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
