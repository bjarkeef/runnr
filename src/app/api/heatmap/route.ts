import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStoredTokens } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await getStoredTokens();
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { stravaId } = auth;

    // Fetch activities with map data for heatmap (limit to last 200 for performance)
    const user = await prisma.user.findUnique({
      where: { stravaId },
      select: {
        activities: {
          select: {
            stravaId: true,
            name: true,
            distance: true,
            movingTime: true,
            startDate: true,
            averageSpeed: true,
            summaryPolyline: true,
            startLatlng: true,
          },
          where: {
            sportType: 'Run',
            summaryPolyline: {
              not: null // Only activities with map data
            }
          },
          orderBy: { startDate: 'desc' },
          take: 200, // Limit for performance
        },
      },
    });

    if (!user) {
      return NextResponse.json({ 
        activities: [],
        message: 'No data found. Please sync from Strava first.'
      });
    }

    // Map activities to heatmap format
    const response = NextResponse.json({
      activities: user.activities.map((activity) => ({
        id: Number(activity.stravaId),
        name: activity.name,
        distance: activity.distance,
        moving_time: activity.movingTime,
        start_date: activity.startDate.toISOString(),
        average_speed: activity.averageSpeed,
        map: {
          summary_polyline: activity.summaryPolyline,
        },
        start_latlng: activity.startLatlng as [number, number] | undefined,
      })),
    });
    
    // Cache heatmap data for 30 minutes
    response.headers.set('Cache-Control', 'private, max-age=1800');
    
    return response;
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to fetch heatmap data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
