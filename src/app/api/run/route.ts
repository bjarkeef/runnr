import { NextResponse } from 'next/server';
import { getFullActivity } from '@/lib/strava';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { nicknameLabel } from '@/lib/gear-narrative/copy';
import type { GearHighlights, GearMilestoneStored, NarrativeTone } from '@/lib/gear-narrative/types';
import {
  enrichWeatherSnapshot,
  fetchHistoricalWeather,
  parseLatLng,
  type ActivityWeather,
} from '@/lib/weather';

export interface RunGearMoment {
  key: string;
  label: string;
  detail?: string;
  tone: 'record' | 'milestone' | 'info';
}

export interface RunGearContext {
  id: string;
  href: string;
  name: string;
  brandName?: string | null;
  modelName?: string | null;
  description?: string | null;
  primary: boolean;
  retired: boolean;
  distanceM: number;
  distanceKm: number;
  shoeHealth: 'good' | 'monitor' | 'replace';
  /** Shoe Story nickname if beta narrative exists */
  nickname?: string | null;
  runCount?: number | null;
  /** 1-based index of this activity among runs tagged with this gear (oldest = 1) */
  runIndex?: number | null;
  /** km on this shoe before this run (approx from prior tagged runs) */
  distanceBeforeKm?: number | null;
  /** km on this shoe after this run */
  distanceAfterKm?: number | null;
  moments: RunGearMoment[];
}

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

function shoeHealth(distanceM: number): 'good' | 'monitor' | 'replace' {
  if (distanceM > 800_000) return 'replace';
  if (distanceM > 600_000) return 'monitor';
  return 'good';
}

function highlightMatches(
  highlights: GearHighlights | null,
  stravaIdStr: string,
  prismaActivityId?: string
): RunGearMoment[] {
  if (!highlights) return [];
  const ids = new Set([stravaIdStr, prismaActivityId].filter(Boolean) as string[]);
  const moments: RunGearMoment[] = [];

  const check = (
    field: keyof GearHighlights,
    key: string,
    label: string,
    detail?: string
  ) => {
    const val = highlights[field];
    if (typeof val === 'string' && ids.has(val)) {
      moments.push({ key, label, detail, tone: 'record' });
    }
  };

  check('fastestActivityId', 'fastest', 'Fastest run in these shoes',
    highlights.fastestSpeed != null
      ? `Avg ${((1000 / 60) / highlights.fastestSpeed).toFixed(1)} min/km pace among all tagged runs`
      : undefined);
  check('longestActivityId', 'longest', 'Longest run in these shoes',
    highlights.longestDistanceM != null
      ? `${(highlights.longestDistanceM / 1000).toFixed(1)} km — longest distance tagged to this pair`
      : undefined);
  check('hilliestActivityId', 'hilliest', 'Hilliest run in these shoes',
    highlights.maxElevM != null
      ? `${Math.round(highlights.maxElevM)} m elevation — most climbing on this pair`
      : undefined);
  check('wettestActivityId', 'wettest', 'Wettest run in these shoes',
    highlights.maxPrecipMm != null
      ? `${highlights.maxPrecipMm.toFixed(1)} mm precip at start — soggiest outing`
      : undefined);
  check('coldestActivityId', 'coldest', 'Coldest run in these shoes',
    highlights.minTempC != null
      ? `${highlights.minTempC.toFixed(0)}°C at start — chilliest outing`
      : undefined);
  check('hottestActivityId', 'hottest', 'Hottest run in these shoes',
    highlights.maxTempC != null
      ? `${highlights.maxTempC.toFixed(0)}°C at start — warmest outing`
      : undefined);

  return moments;
}

async function loadGearContext(
  userId: string,
  stravaIdStr: string,
  gearIdFromStrava?: string | null,
  narrativeTone: NarrativeTone = 'whimsical'
): Promise<RunGearContext | null> {
  let stravaIdBig: bigint;
  try {
    stravaIdBig = BigInt(stravaIdStr);
  } catch {
    return null;
  }

  const activityRow = await prisma.activity.findFirst({
    where: { userId, stravaId: stravaIdBig },
    select: {
      id: true,
      gearId: true,
      distance: true,
      startDate: true,
    },
  });

  const gearId = activityRow?.gearId || gearIdFromStrava || null;
  if (!gearId) return null;

  const gear = await prisma.gear.findFirst({
    where: { id: gearId, userId },
    include: {
      narrative: {
        select: {
          nicknameKey: true,
          firstRunAt: true,
          lastRunAt: true,
          runCount: true,
          totalDistanceM: true,
          highlights: true,
          milestones: true,
        },
      },
    },
  });

  // Gear might only exist in Strava response, not yet in our Gear table
  if (!gear) {
    return null;
  }

  const moments: RunGearMoment[] = [];
  const narrative = gear.narrative;
  const highlights = (narrative?.highlights ?? null) as unknown as GearHighlights | null;

  // Runs tagged with this gear, oldest first — for first/last/index/distance context
  const gearRuns = await prisma.activity.findMany({
    where: { userId, gearId, sportType: 'Run' },
    select: { id: true, stravaId: true, distance: true, startDate: true },
    orderBy: { startDate: 'asc' },
  });

  let runIndex: number | null = null;
  let distanceBeforeKm: number | null = null;
  let distanceAfterKm: number | null = null;
  let isFirst = false;
  let isLatest = false;

  if (gearRuns.length > 0) {
    const idx = gearRuns.findIndex(
      (r) => String(r.stravaId) === stravaIdStr || r.id === activityRow?.id
    );
    if (idx >= 0) {
      runIndex = idx + 1;
      isFirst = idx === 0;
      isLatest = idx === gearRuns.length - 1;
      const beforeM = gearRuns.slice(0, idx).reduce((s, r) => s + r.distance, 0);
      const afterM = gearRuns.slice(0, idx + 1).reduce((s, r) => s + r.distance, 0);
      distanceBeforeKm = beforeM / 1000;
      distanceAfterKm = afterM / 1000;
    }
  }

  if (isFirst) {
    moments.push({
      key: 'maiden',
      label: 'Maiden voyage',
      detail: 'First run tagged to this pair',
      tone: 'milestone',
    });
  }
  if (isLatest && gearRuns.length > 1) {
    moments.push({
      key: 'latest',
      label: 'Most recent outing',
      detail: `Run ${runIndex} of ${gearRuns.length} on this pair`,
      tone: 'info',
    });
  }

  // Narrative highlight records for this specific activity
  moments.push(...highlightMatches(highlights, stravaIdStr, activityRow?.id));

  // Distance milestones crossed during this run (before → after)
  if (distanceBeforeKm != null && distanceAfterKm != null) {
    const milestoneKm = [100, 250, 500, 750, 800, 1000];
    for (const mk of milestoneKm) {
      if (distanceBeforeKm < mk && distanceAfterKm >= mk) {
        moments.push({
          key: `dist_${mk}`,
          label: `Crossed ${mk} km on this pair`,
          detail: `Went from ${distanceBeforeKm.toFixed(0)} km → ${distanceAfterKm.toFixed(0)} km lifetime mileage`,
          tone: 'milestone',
        });
      }
    }
  }

  // Narrative milestones whose date falls on this activity day
  const storedMilestones = (narrative?.milestones ?? []) as unknown as GearMilestoneStored[];
  if (activityRow?.startDate && storedMilestones.length) {
    const day = activityRow.startDate.toISOString().slice(0, 10);
    for (const m of storedMilestones) {
      if (!m.at) continue;
      const mDay = (typeof m.at === 'string' ? m.at : new Date(m.at).toISOString()).slice(0, 10);
      if (mDay === day) {
        moments.push({
          key: `ms_${m.key}`,
          label: m.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          detail: m.distanceM != null ? `At ~${(m.distanceM / 1000).toFixed(0)} km on shoes` : undefined,
          tone: 'milestone',
        });
      }
    }
  }

  // Dedupe by key
  const seen = new Set<string>();
  const uniqueMoments = moments.filter((m) => {
    if (seen.has(m.key)) return false;
    seen.add(m.key);
    return true;
  });

  // Prefer records first, then milestones, then info
  const order = { record: 0, milestone: 1, info: 2 };
  uniqueMoments.sort((a, b) => order[a.tone] - order[b.tone]);

  const nickname = narrative?.nicknameKey
    ? nicknameLabel(narrative.nicknameKey, narrativeTone)
    : null;

  return {
    id: gear.id,
    href: `/gear/${gear.id}`,
    name: gear.name,
    brandName: gear.brandName,
    modelName: gear.modelName,
    description: gear.description,
    primary: gear.primary,
    retired: gear.retired,
    distanceM: gear.distance,
    distanceKm: gear.distance / 1000,
    shoeHealth: shoeHealth(gear.distance),
    nickname,
    runCount: narrative?.runCount ?? gearRuns.length,
    runIndex,
    distanceBeforeKm,
    distanceAfterKm,
    moments: uniqueMoments,
  };
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

    const userPrefs = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { gearNarrativeTone: true, gearNarrativeBeta: true },
    });
    const tone = (userPrefs?.gearNarrativeTone === 'serious' ? 'serious' : 'whimsical') as NarrativeTone;

    let weather: ActivityWeather | null = null;
    let gearContext: RunGearContext | null = null;

    try {
      weather = await loadOrFetchWeather(auth.user.id, stravaId);
    } catch (e) {
      console.warn('[Run] weather attach failed', e);
    }

    try {
      gearContext = await loadGearContext(
        auth.user.id,
        stravaId,
        activity.gear_id ?? activity.gear?.id ?? null,
        tone
      );
    } catch (e) {
      console.warn('[Run] gear context attach failed', e);
    }

    // Enrich Strava gear blob with our link/context when possible
    const gear =
      activity.gear || gearContext
        ? {
            ...(activity.gear ?? {}),
            id: gearContext?.id ?? activity.gear?.id ?? activity.gear_id,
            name: gearContext?.name ?? activity.gear?.name,
            brand_name: gearContext?.brandName ?? activity.gear?.brand_name,
            model_name: gearContext?.modelName ?? activity.gear?.model_name,
            description: gearContext?.description ?? activity.gear?.description,
            distance: gearContext?.distanceM ?? activity.gear?.distance ?? 0,
            primary: gearContext?.primary ?? activity.gear?.primary ?? false,
            retired: gearContext?.retired ?? false,
            href: gearContext?.href ?? (gearContext?.id ? `/gear/${gearContext.id}` : null),
            nickname: gearContext?.nickname ?? null,
            shoe_health: gearContext?.shoeHealth ?? null,
            run_count: gearContext?.runCount ?? null,
            run_index: gearContext?.runIndex ?? null,
            distance_before_km: gearContext?.distanceBeforeKm ?? null,
            distance_after_km: gearContext?.distanceAfterKm ?? null,
            moments: gearContext?.moments ?? [],
            story_available: Boolean(userPrefs?.gearNarrativeBeta && gearContext?.nickname),
          }
        : null;

    const response = NextResponse.json({
      ...activity,
      weather,
      gear,
      gear_context: gearContext,
    });
    response.headers.set('Cache-Control', 'private, max-age=600');
    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to fetch detailed activity' }, { status: 500 });
  }
}