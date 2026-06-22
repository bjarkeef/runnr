import { buildTagline, chapterView, milestoneView, nicknameLabel, traitLabel } from './copy';
import type {
  GearChapterStored,
  GearHighlights,
  GearLifePathSegment,
  GearMilestoneStored,
  NarrativeFullView,
  NarrativeSummaryView,
  NarrativeTone,
  PaceBuckets,
  SeasonBuckets,
  TerrainBuckets,
  TimeBuckets,
  WeatherBuckets,
} from './types';

export interface StoredNarrativeLike {
  archetypeKey: string;
  nicknameKey: string;
  traitKeys: unknown;
  firstRunAt: Date | string | null;
  lastRunAt: Date | string | null;
  runCount: number;
  totalDistanceM: number;
  paceBuckets: unknown;
  terrainBuckets: unknown;
  weatherBuckets: unknown;
  timeBuckets: unknown;
  seasonBuckets: unknown;
  chapters: unknown;
  milestones: unknown;
  highlights: unknown;
  lifePath: unknown;
  computedAt: Date | string;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return typeof d === 'string' ? d : d.toISOString();
}

export function resolveNarrativeSummary(
  n: StoredNarrativeLike,
  tone: NarrativeTone
): NarrativeSummaryView {
  const traits = asStringArray(n.traitKeys);
  const topTraitKey = traits[0] ?? null;
  const lifePath = (n.lifePath ?? []) as GearLifePathSegment[];

  return {
    nickname: nicknameLabel(n.nicknameKey, tone),
    tagline: buildTagline(n.nicknameKey, tone, topTraitKey, n.totalDistanceM / 1000, n.runCount),
    topTrait: topTraitKey ? traitLabel(topTraitKey, tone) : null,
    runCount: n.runCount,
    archetypeKey: n.archetypeKey,
    nicknameKey: n.nicknameKey,
    lifePathPreview: lifePath.slice(0, 8),
  };
}

export function resolveNarrativeFull(n: StoredNarrativeLike, tone: NarrativeTone): NarrativeFullView {
  const summary = resolveNarrativeSummary(n, tone);
  const traitKeys = asStringArray(n.traitKeys);
  const chapters = (n.chapters ?? []) as GearChapterStored[];
  const milestones = (n.milestones ?? []) as GearMilestoneStored[];

  return {
    ...summary,
    traits: traitKeys.map((k) => traitLabel(k, tone)),
    firstRunAt: iso(n.firstRunAt),
    lastRunAt: iso(n.lastRunAt),
    totalDistanceM: n.totalDistanceM,
    paceBuckets: n.paceBuckets as PaceBuckets,
    terrainBuckets: n.terrainBuckets as TerrainBuckets,
    weatherBuckets: n.weatherBuckets as WeatherBuckets,
    timeBuckets: n.timeBuckets as TimeBuckets,
    seasonBuckets: n.seasonBuckets as SeasonBuckets,
    chapters: chapters.map((c) =>
      chapterView(c.key, tone, c.metrics ?? {}, {
        startDate: c.startDate,
        endDate: c.endDate,
        distanceM: c.distanceM,
        runCount: c.runCount,
      })
    ),
    milestones: milestones.map((m) =>
      milestoneView(m.key, tone, m.at, m.metrics ?? {}, m.distanceM)
    ),
    highlights: (n.highlights ?? {}) as GearHighlights,
    lifePath: (n.lifePath ?? []) as GearLifePathSegment[],
    computedAt: iso(n.computedAt) ?? new Date().toISOString(),
  };
}

export function parseTone(raw: string | null | undefined): NarrativeTone {
  return raw === 'serious' ? 'serious' : 'whimsical';
}
