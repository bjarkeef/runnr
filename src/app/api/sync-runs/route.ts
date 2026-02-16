import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getActivities, refreshAccessToken, StravaActivity } from '@/lib/strava';
import { prisma } from '@/lib/prisma';

async function fetchAndCacheGear(gearId: string, accessToken: string, userId: string) {
  try {
    // Check if gear already exists in database
    const existingGear = await prisma.gear.findUnique({
      where: { id: gearId },
    });

    if (existingGear) {
      return; // Already cached
    }

    // Fetch gear details from Strava
    const gearResponse = await fetch(`https://www.strava.com/api/v3/gear/${gearId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!gearResponse.ok) {
      console.error(`[Sync] Failed to fetch gear ${gearId}: ${gearResponse.status}`);
      return;
    }

    const gearData = await gearResponse.json();

    // Save gear to database
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
    const cookieStore = await cookies();
    const storedTokens = cookieStore.get('runnr_strava_tokens')?.value;

    if (!storedTokens) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const parsedTokens = JSON.parse(storedTokens);
    const stravaId = parsedTokens.athleteId || parsedTokens.athlete?.id || parsedTokens.stravaId;
    const accessToken = parsedTokens.access_token || parsedTokens.accessToken;
    const refreshToken = parsedTokens.refresh_token || parsedTokens.refreshToken;
    const tokenExpiry = parsedTokens.expires_at || parsedTokens.tokenExpiry;

    if (!stravaId || !accessToken) {
      return NextResponse.json({ error: 'Invalid authentication data' }, { status: 400 });
    }

    // Check if token needs refresh
    let currentAccessToken = accessToken;
    if (Date.now() > tokenExpiry) {
      const newTokens = await refreshAccessToken(refreshToken, parseInt(stravaId));
      currentAccessToken = newTokens.access_token;
      
      // Update user with new tokens
      await prisma.user.update({
        where: { stravaId },
        data: {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          tokenExpiry: newTokens.tokenExpiry,
        },
      });

      // Update cookie
      cookieStore.set('runnr_strava_tokens', JSON.stringify(newTokens), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    // Check for an existing user to determine last sync time
    const existingUser = await prisma.user.findUnique({
      where: { stravaId: parseInt(stravaId) },
      select: { id: true, lastSyncedAt: true },
    });

    // Fetch activities from Strava, but limit to those after the last synced timestamp when possible
    const afterTimestamp = existingUser?.lastSyncedAt ? Math.floor(existingUser.lastSyncedAt.getTime() / 1000) : undefined;

    const activities: StravaActivity[] = [];
    let page = 1;
    const perPage = 200;
    const maxPages = 10; // safety limit

    while (page <= maxPages) {
      const batch = await getActivities(currentAccessToken, page, perPage, afterTimestamp);
      if (!batch || batch.length === 0) break;
      activities.push(...batch);
      // stop if we got a small batch (no more pages)
      if (batch.length < perPage) break;
      page++;
    }

    // Find or create user (update tokens)
    const user = await prisma.user.upsert({
      where: { stravaId: parseInt(stravaId) },
      update: {
        accessToken: currentAccessToken,
        refreshToken,
        tokenExpiry,
      },
      create: {
        stravaId: parseInt(stravaId),
        accessToken: currentAccessToken,
        refreshToken,
        tokenExpiry,
      },
    });

    // Sync activities to database
    let syncedCount = 0;
    let skippedCount = 0;

    const newlyAddedGearIds = new Set<string>();

    for (const activity of activities) {
      try {
        // Upsert activity - create if new, update kudos/gear if exists
        const result = await prisma.activity.upsert({
          where: { stravaId: activity.id },
          update: {
            // Update only fields that change frequently
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

        // Count as synced if newly created (no previous updatedAt)
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          syncedCount++;
          if (activity.gear_id) newlyAddedGearIds.add(activity.gear_id);
        } else {
          skippedCount++;
        }
      } catch (err) {
        skippedCount++;
      }
    }

    // Fetch and cache each unique gear item from newly created activities in parallel
    if (newlyAddedGearIds.size > 0) {
      const gearPromises = Array.from(newlyAddedGearIds).map(gearId => fetchAndCacheGear(gearId, currentAccessToken, user.id));
      await Promise.allSettled(gearPromises);
    }

    // Also update gear distances from Strava (they may have changed) for gear we now have cached
    // We update distances for any gear that exists for these activities (new or existing)
    const allGearIds = new Set<string>();
    for (const activity of activities) {
      if (activity.gear_id) allGearIds.add(activity.gear_id);
    }

    if (allGearIds.size > 0) {
      const updatePromises = Array.from(allGearIds).map(async (gearId) => {
        try {
          const gearResponse = await fetch(`https://www.strava.com/api/v3/gear/${gearId}`, {
            headers: { Authorization: `Bearer ${currentAccessToken}` },
          });

          if (gearResponse.ok) {
            const gearData = await gearResponse.json();
            await prisma.gear.update({
              where: { id: gearId },
              data: {
                distance: gearData.distance || 0,
                primary: gearData.primary || false,
                retired: gearData.retired || false,
              },
            });
          }
        } catch {
          // Ignore update errors
        }
      });

      await Promise.allSettled(updatePromises);
    }

    // Update user's lastSyncedAt timestamp
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
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
