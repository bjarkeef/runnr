import { NextResponse } from 'next/server';
import { getFullActivity } from '@/lib/strava';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  enrichWeatherSnapshot,
  fetchHistoricalWeather,
  parseLatLng,
  type ActivityWeather,
} from '@/lib/weather';

/**
 * Resolve a URL id to a Strava activity id.
 * Normal links use Strava numeric ids; older narrative highlights may still
 * pass a Prisma cuid — map those via the local Activity row when possible.
 */
async function resolveStravaActivityId(
  rawId: string,
  userId: string
): Promise<string> {
  if (/^\d+$/.test(rawId)) {
    return rawId;
  }

  try {
    const row = await prisma.activity.findFirst({
      where: { id: rawId, userId },
      select: { stravaId: true },
    });
    if (row?.stravaId != null) {
      return String(row.stravaId);
    }
  } catch {
    // fall through
  }

  return rawId;
}

async function loadOrFetchWeather(
  userId: string,
  stravaIdStr: string
): Promise<ActivityWeather | null> {
  let stravaIdBig: bigint;
  try {
    stravaIdBig = BigInt(stravaIdStr);
  } catch {
    return null;
  }

  const row = await prisma.activity.findFirst({
    where: { userId, stravaId: stravaIdBig },
    select: {
      id: true,
      startDate: true,
      startLatlng: true,
      weatherTempC: true,
      weatherCode: true,
      weatherPrecipMm: true,
      weatherWindKmh: true,
      weatherFetchedAt: true,
    },
  });

  if (!row) return null;

  // Cached snapshot
  if (row.weatherFetchedAt) {
    if (
      row.weatherTempC == null &&
      row.weatherCode == null &&
      row.weatherPrecipMm == null &&
      row.weatherWindKmh == null
    ) {
      // Fetched but no usable data (no lat/lng or API miss)
      return null;
    }
    return enrichWeatherSnapshot(
      {
        tempC: row.weatherTempC,
        weatherCode: row.weatherCode,
        precipMm: row.weatherPrecipMm,
        windKmh: row.weatherWindKmh,
      },
      row.weatherFetchedAt
    );
  }

  // Lazy backfill on first detail view
  const ll = parseLatLng(row.startLatlng);
  if (!ll) {
    await prisma.activity.update({
      where: { id: row.id },
      data: { weatherFetchedAt: new Date() },
    });
    return null;
  }

  const snap = await fetchHistoricalWeather(ll[0], ll[1], row.startDate);
  const now = new Date();
  await prisma.activity.update({
    where: { id: row.id },
    data: {
      weatherTempC: snap?.tempC ?? null,
      weatherCode: snap?.weatherCode ?? null,
      weatherPrecipMm: snap?.precipMm ?? null,
      weatherWindKmh: snap?.windKmh ?? null,
      weatherFetchedAt: now,
    },
  });

  if (!snap) return null;
  return enrichWeatherSnapshot(snap, now);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get('id');

  if (!activityId) {
    return NextResponse.json({ error: 'Activity ID is required' }, { status: 400 });
  }

  const auth = await getAuthenticatedUser();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const stravaId = await resolveStravaActivityId(activityId, auth.user.id);
    const activity = await getFullActivity(auth.tokens.access_token, stravaId);

    let weather: ActivityWeather | null = null;
    try {
      weather = await loadOrFetchWeather(auth.user.id, stravaId);
    } catch (e) {
      console.warn('[Run] weather attach failed', e);
    }

    const response = NextResponse.json({ ...activity, weather });
    response.headers.set('Cache-Control', 'private, max-age=600');
    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to fetch detailed activity' }, { status: 500 });
  }
}