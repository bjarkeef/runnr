import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAthleteProfile } from '@/lib/strava';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth.success) {
      return auth.response;
    }

    // Get user from database with comprehensive stats
    const user = await prisma.user.findUnique({
      where: { stravaId: auth.stravaId },
      select: {
        id: true,
        stravaId: true,
        createdAt: true,
        updatedAt: true,
        lastSyncedAt: true,
        gearNarrativeTone: true,
        gearNarrativeBeta: true,
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
    const athleteProfile = await getAthleteProfile(auth.tokens.access_token);

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
      
      preferences: {
        gearNarrativeTone: user.gearNarrativeTone ?? 'whimsical',
        gearNarrativeBeta: user.gearNarrativeBeta ?? false,
      },

      user: {
        id: user.id,
        stravaId: user.stravaId,
        username: athleteProfile.username ?? null,
        firstname: athleteProfile.firstname ?? null,
        lastname: athleteProfile.lastname ?? null,
        profile: athleteProfile.profile ?? null,
        memberSince: user.createdAt,
        lastUpdated: user.updatedAt,
        lastSynced: user.lastSyncedAt,
        gearNarrativeTone: user.gearNarrativeTone ?? 'whimsical',
        gearNarrativeBeta: user.gearNarrativeBeta ?? false,
        
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

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();
    const data: { gearNarrativeTone?: string; gearNarrativeBeta?: boolean } = {};

    if (body?.gearNarrativeTone !== undefined) {
      if (body.gearNarrativeTone !== 'whimsical' && body.gearNarrativeTone !== 'serious') {
        return NextResponse.json(
          { error: 'gearNarrativeTone must be "whimsical" or "serious"' },
          { status: 400 }
        );
      }
      data.gearNarrativeTone = body.gearNarrativeTone;
    }

    if (body?.gearNarrativeBeta !== undefined) {
      if (typeof body.gearNarrativeBeta !== 'boolean') {
        return NextResponse.json(
          { error: 'gearNarrativeBeta must be a boolean' },
          { status: 400 }
        );
      }
      data.gearNarrativeBeta = body.gearNarrativeBeta;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid preference fields provided' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { stravaId: auth.stravaId },
      data,
      select: { gearNarrativeTone: true, gearNarrativeBeta: true },
    });

    return NextResponse.json({
      success: true,
      gearNarrativeTone: user.gearNarrativeTone,
      gearNarrativeBeta: user.gearNarrativeBeta,
    });
  } catch (error) {
    console.error('Settings PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
