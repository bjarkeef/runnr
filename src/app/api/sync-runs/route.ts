import { NextResponse } from 'next/server';
import { getAllActivities, getGearSafe, StravaActivity } from '@/lib/strava';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

async function fetchAndCacheGear(gearId: string, accessToken: string, userId: string) {
  try {
    const existingGear = await prisma.gear.findUnique({
      where: { id: gearId },
    });

    if (existingGear) {
      return;
    }

    const gearData = await getGearSafe(accessToken, gearId);
    if (!gearData) return;

    await prisma.gear.create({
      data: {
        id: gearData.id,
        userId,
        name: gearData.name,
        brandName: gearData.brand_name || null,
        modelName: gearData.model_name || null,
        description: gearData.description || null,
        distance: gearData.distance || 0,
        primary: gearData.primary || false,
        retired: gearData.retired || false,
      },
    });

    console.log(`[Sync] Cached gear: ${gearData.name} (${gearId})`);
  } catch (error) {
    console.error(`[Sync] Error caching gear ${gearId}:`, error);
  }
}

export async function POST() {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth.success) {
      return auth.response;
    }

    const { tokens, stravaId } = auth;
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const tokenExpiry = tokens.tokenExpiry;

    // Check for an existing user to determine last sync time
    const existingUser = await prisma.user.findUnique({
      where: { stravaId },
      select: { id: true, lastSyncedAt: true },
    });

    // Fetch activities from Strava, limited to those after last sync when possible
    const afterTimestamp = existingUser?.lastSyncedAt
      ? Math.floor(existingUser.lastSyncedAt.getTime() / 1000)
      : undefined;

    const activities: StravaActivity[] = await getAllActivities(accessToken, 10, afterTimestamp);

    // Find or create user (update tokens)
    const user = await prisma.user.upsert({
      where: { stravaId },
      update: {
        accessToken,
        refreshToken,
        tokenExpiry,
      },
      create: {
        stravaId,
        accessToken,
        refreshToken,
        tokenExpiry,
      },
    });

    let syncedCount = 0;
    let skippedCount = 0;
    const newlyAddedGearIds = new Set<string>();

    for (const activity of activities) {
      try {
        const result = await prisma.activity.upsert({
          where: { stravaId: activity.id },
          update: {
            name: activity.name,
            kudosCount: activity.kudos_count || 0,
            gearId: activity.gear_id || null,
          },
          create: {
            userId: user.id,
            stravaId: activity.id,
            name: activity.name,
            distance: activity.distance,
            movingTime: activity.moving_time,
            elapsedTime: activity.elapsed_time,
            totalElevationGain: activity.total_elevation_gain,
            startDate: new Date(activity.start_date),
            startDateLocal: new Date(activity.start_date_local),
            timezone: activity.timezone || 'UTC',
            averageSpeed: activity.average_speed,
            maxSpeed: activity.max_speed,
            averageHeartrate: activity.average_heartrate,
            maxHeartrate: activity.max_heartrate,
            sportType: activity.sport_type || activity.type,
            workoutType: activity.workout_type,
            summaryPolyline: activity.map?.summary_polyline,
            startLatlng: activity.start_latlng || undefined,
            endLatlng: activity.end_latlng || undefined,
            kudosCount: activity.kudos_count || 0,
            gearId: activity.gear_id || null,
          },
        });

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          syncedCount++;
          if (activity.gear_id) newlyAddedGearIds.add(activity.gear_id);
        } else {
          skippedCount++;
        }
      } catch {
        skippedCount++;
      }
    }

    if (newlyAddedGearIds.size > 0) {
      const gearPromises = Array.from(newlyAddedGearIds).map((gearId) =>
        fetchAndCacheGear(gearId, accessToken, user.id)
      );
      await Promise.allSettled(gearPromises);
    }

    // Update gear distances from Strava for all gear referenced in this batch
    const allGearIds = new Set<string>();
    for (const activity of activities) {
      if (activity.gear_id) allGearIds.add(activity.gear_id);
    }

    if (allGearIds.size > 0) {
      const updatePromises = Array.from(allGearIds).map(async (gearId) => {
        try {
          const gearData = await getGearSafe(accessToken, gearId);
          if (!gearData) return;

          await prisma.gear.update({
            where: { id: gearId },
            data: {
              distance: gearData.distance || 0,
              primary: gearData.primary || false,
              retired: gearData.retired || false,
            },
          });
        } catch {
          // Ignore update errors (gear may not exist in DB yet)
        }
      });

      await Promise.allSettled(updatePromises);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      skipped: skippedCount,
      total: activities.length,
      lastSyncedAt: new Date(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to sync runs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
