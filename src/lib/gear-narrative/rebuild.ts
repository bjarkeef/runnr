import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NARRATIVE_VERSION, type ActivityForNarrative, type GearDraftNarrative } from './types';
import { assignUniqueNicknames, deriveGearDraft } from './derive';
import { fetchHistoricalWeather } from './weather';

const WEATHER_BATCH_LIMIT = 25;

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseLatLng(raw: unknown): [number, number] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const lat = Number(raw[0]);
  const lng = Number(raw[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

async function backfillWeather(userId: string): Promise<number> {
  const needsWeather = await prisma.activity.findMany({
    where: {
      userId,
      sportType: 'Run',
      gearId: { not: null },
      weatherFetchedAt: null,
      NOT: { startLatlng: { equals: Prisma.DbNull } },
    },
    select: {
      id: true,
      startDate: true,
      startLatlng: true,
    },
    take: WEATHER_BATCH_LIMIT,
    orderBy: { startDate: 'desc' },
  });

  let updated = 0;
  for (const act of needsWeather) {
    const ll = parseLatLng(act.startLatlng);
    if (!ll) {
      await prisma.activity.update({
        where: { id: act.id },
        data: { weatherFetchedAt: new Date() },
      });
      continue;
    }
    const snap = await fetchHistoricalWeather(ll[0], ll[1], act.startDate);
    await prisma.activity.update({
      where: { id: act.id },
      data: {
        weatherTempC: snap?.tempC ?? null,
        weatherCode: snap?.weatherCode ?? null,
        weatherPrecipMm: snap?.precipMm ?? null,
        weatherWindKmh: snap?.windKmh ?? null,
        weatherFetchedAt: new Date(),
      },
    });
    updated++;
  }
  return updated;
}

function toActivityForNarrative(a: {
  id: string;
  distance: number;
  movingTime: number;
  averageSpeed: number;
  totalElevationGain: number;
  startDate: Date;
  startDateLocal: Date;
  workoutType: number | null;
  startLatlng: unknown;
  weatherTempC: number | null;
  weatherCode: number | null;
  weatherPrecipMm: number | null;
  weatherWindKmh: number | null;
}): ActivityForNarrative {
  return {
    id: a.id,
    distance: a.distance,
    movingTime: a.movingTime,
    averageSpeed: a.averageSpeed,
    totalElevationGain: a.totalElevationGain,
    startDate: a.startDate,
    startDateLocal: a.startDateLocal,
    workoutType: a.workoutType,
    startLatlng: parseLatLng(a.startLatlng),
    weatherTempC: a.weatherTempC,
    weatherCode: a.weatherCode,
    weatherPrecipMm: a.weatherPrecipMm,
    weatherWindKmh: a.weatherWindKmh,
  };
}

async function persistDrafts(userId: string, drafts: GearDraftNarrative[]) {
  const now = new Date();
  for (const d of drafts) {
    const data = {
      userId,
      archetypeKey: d.archetypeKey,
      nicknameKey: d.nicknameKey,
      traitKeys: asJson(d.traitKeys),
      firstRunAt: d.firstRunAt,
      lastRunAt: d.lastRunAt,
      runCount: d.runCount,
      totalDistanceM: d.totalDistanceM,
      paceBuckets: asJson(d.paceBuckets),
      terrainBuckets: asJson(d.terrainBuckets),
      weatherBuckets: asJson(d.weatherBuckets),
      timeBuckets: asJson(d.timeBuckets),
      seasonBuckets: asJson(d.seasonBuckets),
      chapters: asJson(d.chapters),
      milestones: asJson(d.milestones),
      highlights: asJson(d.highlights),
      lifePath: asJson(d.lifePath),
      version: NARRATIVE_VERSION,
      computedAt: now,
    };

    await prisma.gearNarrative.upsert({
      where: { gearId: d.gearId },
      create: { gearId: d.gearId, ...data },
      update: data,
    });
  }
}

/**
 * Rebuild all gear narratives for a user. Safe to call from sync-runs (non-fatal).
 */
export async function rebuildGearNarratives(userId: string): Promise<{
  gearCount: number;
  weatherBackfilled: number;
}> {
  const weatherBackfilled = await backfillWeather(userId);

  const gearList = await prisma.gear.findMany({
    where: { userId },
  });

  if (gearList.length === 0) {
    return { gearCount: 0, weatherBackfilled };
  }

  const activities = await prisma.activity.findMany({
    where: {
      userId,
      sportType: 'Run',
      gearId: { not: null },
    },
    select: {
      id: true,
      gearId: true,
      distance: true,
      movingTime: true,
      averageSpeed: true,
      totalElevationGain: true,
      startDate: true,
      startDateLocal: true,
      workoutType: true,
      startLatlng: true,
      weatherTempC: true,
      weatherCode: true,
      weatherPrecipMm: true,
      weatherWindKmh: true,
    },
  });

  const byGear = new Map<string, typeof activities>();
  for (const a of activities) {
    if (!a.gearId) continue;
    const arr = byGear.get(a.gearId) ?? [];
    arr.push(a);
    byGear.set(a.gearId, arr);
  }

  const drafts: GearDraftNarrative[] = gearList.map((g) => {
    const acts = (byGear.get(g.id) ?? []).map(toActivityForNarrative);
    return deriveGearDraft(g.id, acts, g.retired);
  });

  assignUniqueNicknames(drafts);

  try {
    await persistDrafts(userId, drafts);
  } catch (err) {
    // Uniqueness collision edge case: re-assign and retry once
    console.warn('[GearNarrative] persist failed, retrying nickname assignment', err);
    assignUniqueNicknames(drafts);
    // Force unique with gearId suffix if still colliding in-memory (shouldn't)
    const used = new Set<string>();
    for (const d of drafts) {
      if (used.has(d.nicknameKey)) {
        d.nicknameKey = `${d.nicknameKey}_${d.gearId.slice(-4)}`;
      }
      used.add(d.nicknameKey);
    }
    await persistDrafts(userId, drafts);
  }

  return { gearCount: drafts.length, weatherBackfilled };
}

/** Fire-and-forget safe wrapper for sync hooks */
export async function rebuildGearNarrativesSafe(userId: string): Promise<void> {
  try {
    const result = await rebuildGearNarratives(userId);
    console.log(
      `[GearNarrative] Rebuilt ${result.gearCount} narratives, weather backfill ${result.weatherBackfilled}`
    );
  } catch (e) {
    console.error('[GearNarrative] Rebuild failed (non-fatal):', e);
  }
}
