import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { refreshAccessToken, getAthleteProfile, type StravaTokens } from '@/lib/strava';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const storedTokens = cookieStore.get('runnr_strava_tokens')?.value;

    if (!storedTokens) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let tokens: StravaTokens = JSON.parse(storedTokens);
    const stravaId = tokens.athleteId || tokens.athlete?.id;

    if (!stravaId) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 400 });
    }

    // Refresh token if needed
    if (Date.now() > tokens.tokenExpiry) {
      tokens = await refreshAccessToken(tokens.refresh_token, tokens.athleteId);
    }

    // Get user from database with comprehensive stats
    const user = await prisma.user.findUnique({
      where: { stravaId: parseInt(stravaId) },
      select: {
        id: true,
        stravaId: true,
        createdAt: true,
        updatedAt: true,
        lastSyncedAt: true,
        _count: {
          select: {
            activities: true,
            raceGoals: true,
            trainingPlans: true,
          }
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get athlete profile from Strava
    const athleteProfile = await getAthleteProfile(tokens.access_token);

    // Get database-wide statistics
    const [totalUsers, totalActivities, totalRaceGoals, totalTrainingPlans, totalGear] = await Promise.all([
      prisma.user.count(),
      prisma.activity.count(),
      prisma.raceGoal.count(),
      prisma.trainingPlan.count(),
      prisma.gear.count(),
    ]);

    // Get user's activity statistics
    const userActivityStats = await prisma.activity.aggregate({
      where: {
        userId: user.id,
        sportType: 'Run'
      },
      _sum: {
        distance: true,
        movingTime: true,
        totalElevationGain: true,
      },
      _avg: {
        distance: true,
        averageSpeed: true,
      },
      _max: {
        distance: true,
      },
    });

    // Get kudos stats
    const kudosStats = await prisma.activity.aggregate({
      where: { userId: user.id },
      _sum: { kudosCount: true },
      _avg: { kudosCount: true },
      _max: { kudosCount: true },
    });

    // Get gear stats
    const userGear = await prisma.gear.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        distance: true,
        primary: true,
        retired: true,
      },
      orderBy: { distance: 'desc' },
    });

    // Get oldest and newest activity dates
    const [oldestActivity, newestActivity] = await Promise.all([
      prisma.activity.findFirst({
        where: { userId: user.id },
        orderBy: { startDate: 'asc' },
        select: { startDate: true },
      }),
      prisma.activity.findFirst({
        where: { userId: user.id },
        orderBy: { startDate: 'desc' },
        select: { startDate: true },
      }),
    ]);

    // Build response
    const response = {
      version: '1.0.0', // App version
      buildDate: '2025-11-09', // Last build date
      environment: process.env.NODE_ENV,
      
      user: {
        id: user.id,
        stravaId: user.stravaId,
        username: athleteProfile.username,
        firstname: athleteProfile.firstname,
        lastname: athleteProfile.lastname,
        profile: athleteProfile.profile,
        memberSince: user.createdAt,
        lastUpdated: user.updatedAt,
        lastSynced: user.lastSyncedAt,
        
        stats: {
          totalActivities: user._count.activities,
          totalRaceGoals: user._count.raceGoals,
          totalTrainingPlans: user._count.trainingPlans,
        },
        
        activityStats: {
          totalDistance: userActivityStats._sum.distance ? Math.round(userActivityStats._sum.distance / 1000) : 0, // km
          totalTime: userActivityStats._sum.movingTime ? Math.round(userActivityStats._sum.movingTime / 60) : 0, // minutes
          totalElevation: userActivityStats._sum.totalElevationGain || 0, // meters
          avgDistance: userActivityStats._avg.distance ? (userActivityStats._avg.distance / 1000).toFixed(2) : 0, // km
          avgSpeed: userActivityStats._avg.averageSpeed ? userActivityStats._avg.averageSpeed.toFixed(2) : 0, // m/s
          longestRun: userActivityStats._max.distance ? (userActivityStats._max.distance / 1000).toFixed(2) : 0, // km
          oldestActivity: oldestActivity?.startDate || null,
          newestActivity: newestActivity?.startDate || null,
        },

        kudosStats: {
          totalKudos: kudosStats._sum.kudosCount || 0,
          avgKudos: kudosStats._avg.kudosCount ? kudosStats._avg.kudosCount.toFixed(1) : '0',
          maxKudos: kudosStats._max.kudosCount || 0,
        },

        gearStats: {
          totalGear: userGear.length,
          activeGear: userGear.filter(g => !g.retired).length,
          retiredGear: userGear.filter(g => g.retired).length,
          primaryGear: userGear.find(g => g.primary)?.name || null,
          totalGearDistance: Math.round(userGear.reduce((sum, g) => sum + g.distance, 0) / 1000), // km
          gear: userGear.map(g => ({
            name: g.name,
            distance: Math.round(g.distance / 1000),
            primary: g.primary,
            retired: g.retired,
          })),
        },
      },
      
      database: {
        totalUsers,
        totalActivities,
        totalRaceGoals,
        totalTrainingPlans,
        totalGear,
        
        userPercentile: {
          activities: totalActivities > 0 ? ((user._count.activities / totalActivities) * 100).toFixed(2) : 0,
        },
      },
      
      cache: {
        achievementsCacheTTL: '15 minutes',
        racePredictionsCacheTTL: '30 minutes',
      },
      
      system: {
        database: 'PostgreSQL (Prisma Accelerate)',
        runtime: 'Node.js',
        framework: 'Next.js 15 (Turbopack)',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
