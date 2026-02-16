import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const SYNC_THRESHOLD_MS = 1000 * 60 * 60; // 1 hour
const RUNS_PER_PAGE = 24;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || String(RUNS_PER_PAGE));
    
    const cookieStore = await cookies();
    const storedTokens = cookieStore.get('runnr_strava_tokens')?.value;

    if (!storedTokens) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const parsedTokens = JSON.parse(storedTokens);
    const stravaId = parsedTokens.athleteId || parsedTokens.athlete?.id || parsedTokens.stravaId;
    
    if (!stravaId) {
      return NextResponse.json({ 
        error: 'Invalid token format - athleteId not found'
      }, { status: 400 });
    }

    // Count total runs for pagination
    const totalRuns = await prisma.activity.count({
      where: {
        user: { stravaId: parseInt(stravaId) },
        sportType: 'Run'
      }
    });
    
    // Find user with ONLY fields needed for runs list (no polyline/latlng - saves bandwidth!)
    const user = await prisma.user.findUnique({
      where: { stravaId: parseInt(stravaId) },
      select: {
        lastSyncedAt: true,
        activities: {
          select: {
            stravaId: true,
            name: true,
            distance: true,
            movingTime: true,
            startDateLocal: true,
            kudosCount: true,
          },
          where: {
            sportType: 'Run' // Only fetch runs, not other activities
          },
          orderBy: { startDate: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        },
      },
    });

    if (!user) {
      // User doesn't exist yet - they need to sync from Strava
      return NextResponse.json({ 
        activities: [],
        needsSync: true,
        lastSyncedAt: null,
        message: 'No data found. Click Sync from Strava to load your activities.'
      });
    }

    // Check if we need to trigger a sync (if never synced or synced more than 1 hour ago)
    const needsSync = !user.lastSyncedAt || 
                      (Date.now() - user.lastSyncedAt.getTime()) > SYNC_THRESHOLD_MS;

    // Return cached activities from database (minimal data for runs list)
    const response = NextResponse.json({
      activities: user.activities.map((activity) => ({
        id: Number(activity.stravaId),
        name: activity.name,
        distance: activity.distance,
        moving_time: activity.movingTime,
        start_date_local: activity.startDateLocal.toISOString(),
        kudos_count: activity.kudosCount,
      })),
      pagination: {
        page,
        limit,
        total: totalRuns,
        hasMore: page * limit < totalRuns,
        totalPages: Math.ceil(totalRuns / limit)
      },
      needsSync,
      lastSyncedAt: user.lastSyncedAt,
    });
    
    // Cache for 5 minutes if not needing sync, otherwise no cache
    response.headers.set('Cache-Control', needsSync ? 'no-store' : 'private, max-age=300');
    
    return response;
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to fetch activities',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}