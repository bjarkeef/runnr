import { NextResponse } from 'next/server';
import { StravaActivity } from '@/lib/strava';
import { prisma } from '@/lib/prisma';
import { calculateStats } from '@/lib/stats';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.success) {
    return auth.response;
  }

  try {
    // Fetch user and gear
    const user = await prisma.user.findUnique({
      where: { stravaId: auth.stravaId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userGear = await prisma.gear.findMany({
      where: { userId: user.id }
    });

    // Fetch activities for stats
    const userActivities = await prisma.activity.findMany({
      where: {
        userId: user.id,
        sportType: 'Run'
      },
      orderBy: { startDate: 'desc' },
    });

    // Kudos stats
    const kudosAgg = await prisma.activity.aggregate({
      where: { userId: user.id, sportType: 'Run' },
      _sum: { kudosCount: true },
      _avg: { kudosCount: true },
      _max: { kudosCount: true },
    });

    const kudos = {
      total: kudosAgg._sum.kudosCount || 0,
      avg: Math.round((kudosAgg._avg.kudosCount || 0) * 10) / 10,
      max: kudosAgg._max.kudosCount || 0,
    };

    // Gear stats
    const gear = {
      totalGear: userGear.length,
      activeGear: userGear.filter(g => !g.retired).length,
      totalDistance: Math.round(userGear.reduce((sum, g) => sum + g.distance, 0) / 100) / 10,
      primaryGear: userGear.find(g => g.primary)?.name || null,
      shoes: userGear.map(g => ({
        name: g.name,
        distance: Math.round(g.distance / 100) / 10,
        primary: g.primary,
        retired: g.retired,
      })),
    };

    const activities: StravaActivity[] = userActivities.map(a => ({
      id: Number(a.stravaId),
      name: a.name || '',
      distance: a.distance,
      moving_time: a.movingTime,
      elapsed_time: a.elapsedTime,
      total_elevation_gain: a.totalElevationGain,
      type: 'Run',
      sport_type: 'Run',
      start_date: a.startDate.toISOString(),
      start_date_local: a.startDate.toISOString(),
      average_speed: a.averageSpeed,
      timezone: '',
      utc_offset: 0,
      location_city: null,
      location_state: null,
      location_country: null,
      start_latlng: [0, 0] as [number, number],
      end_latlng: [0, 0] as [number, number],
      max_speed: 0,
      map: {
        id: '',
        summary_polyline: '',
        resource_state: 2
      }
    }));

    // Get range from query params
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '6m';

    let weeklyWeeks = 26; // Default 6 months
    if (range === '12m') weeklyWeeks = 52;
    if (range === 'all') weeklyWeeks = -1;

    const stats = calculateStats(activities, kudos, gear, weeklyWeeks);

    // Support lightweight weekly-only requests for the chart
    const only = searchParams.get('only');
    if (only === 'weekly') {
      return NextResponse.json({ weeklyProgress: stats.weeklyProgress });
    }

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
