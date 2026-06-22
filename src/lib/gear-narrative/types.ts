/** Bump when stored shape changes so clients/docs know a rebuild is needed */
export const NARRATIVE_VERSION = 2;

export type NarrativeTone = 'whimsical' | 'serious';

export type PaceBucket = 'easy' | 'steady' | 'tempo' | 'race';
export type TerrainBucket = 'flat' | 'rolling' | 'hilly' | 'mountain';
export type WeatherBucket = 'clear' | 'rain' | 'snow' | 'cold' | 'hot' | 'windy' | 'unknown';
export type TimeBucket = 'dawn' | 'day' | 'dusk' | 'night';
export type SeasonBucket = 'spring' | 'summer' | 'autumn' | 'winter';

export const ARCHETYPE_KEYS = [
  'speedster',
  'steady_companion',
  'hill_goat',
  'dawn_companion',
  'storm_chaser',
  'weekend_warrior',
  'long_haul',
  'all_rounder',
] as const;

export type ArchetypeKey = (typeof ARCHETYPE_KEYS)[number];

export interface PaceBuckets {
  easyKm: number;
  steadyKm: number;
  tempoKm: number;
  raceKm: number;
}

export interface TerrainBuckets {
  flatKm: number;
  rollingKm: number;
  hillyKm: number;
  mountainKm: number;
}

export interface WeatherBuckets {
  clearKm: number;
  rainKm: number;
  snowKm: number;
  coldKm: number;
  hotKm: number;
  windyKm: number;
}

export interface TimeBuckets {
  dawnKm: number;
  dayKm: number;
  duskKm: number;
  nightKm: number;
  /** Distance (km) per local hour 0–23; used for the 24h dial in the UI */
  hourKm: number[];
}

export interface SeasonBuckets {
  springKm: number;
  summerKm: number;
  autumnKm: number;
  winterKm: number;
}

export interface GearChapterStored {
  key: string;
  startDate?: string;
  endDate?: string;
  distanceM: number;
  runCount: number;
  metrics?: Record<string, number>;
}

export interface GearMilestoneStored {
  key: string;
  at: string;
  distanceM?: number;
  metrics?: Record<string, number>;
}

export interface GearHighlights {
  fastestActivityId?: string;
  fastestSpeed?: number;
  longestActivityId?: string;
  longestDistanceM?: number;
  hilliestActivityId?: string;
  maxElevM?: number;
  wettestActivityId?: string;
  maxPrecipMm?: number;
  coldestActivityId?: string;
  minTempC?: number;
  hottestActivityId?: string;
  maxTempC?: number;
}

export interface GearLifePathSegment {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  distanceM: number;
  runCount: number;
  dominantPace: PaceBucket;
  dominantTerrain: TerrainBucket;
  dominantWeather: WeatherBucket;
  activityIds?: string[];
}

export interface ActivityForNarrative {
  /** Prisma row id (internal) */
  id: string;
  /** Strava activity id — use this for /run/[id] links */
  stravaId: string;
  distance: number;
  movingTime: number;
  averageSpeed: number;
  totalElevationGain: number;
  startDate: Date;
  startDateLocal: Date;
  workoutType?: number | null;
  startLatlng?: [number, number] | null;
  weatherTempC?: number | null;
  weatherCode?: number | null;
  weatherPrecipMm?: number | null;
  weatherWindKmh?: number | null;
}

export interface ClassifiedRun {
  activity: ActivityForNarrative;
  pace: PaceBucket;
  terrain: TerrainBucket;
  weather: WeatherBucket;
  timeOfDay: TimeBucket;
  season: SeasonBucket;
  km: number;
}

export interface GearDraftNarrative {
  gearId: string;
  archetypeKey: string;
  nicknameKey: string;
  traitKeys: string[];
  firstRunAt: Date | null;
  lastRunAt: Date | null;
  runCount: number;
  totalDistanceM: number;
  paceBuckets: PaceBuckets;
  terrainBuckets: TerrainBuckets;
  weatherBuckets: WeatherBuckets;
  timeBuckets: TimeBuckets;
  seasonBuckets: SeasonBuckets;
  chapters: GearChapterStored[];
  milestones: GearMilestoneStored[];
  highlights: GearHighlights;
  lifePath: GearLifePathSegment[];
  /** Internal: ranked nickname candidates for uniqueness pass */
  nicknameCandidates: string[];
}

export interface GearChapterView extends GearChapterStored {
  title: string;
  body: string;
}

export interface GearMilestoneView extends GearMilestoneStored {
  title: string;
  body: string;
}

export interface NarrativeSummaryView {
  nickname: string;
  tagline: string;
  topTrait: string | null;
  runCount: number;
  archetypeKey: string;
  nicknameKey: string;
  lifePathPreview?: GearLifePathSegment[];
}

export interface NarrativeFullView extends NarrativeSummaryView {
  traits: string[];
  firstRunAt: string | null;
  lastRunAt: string | null;
  totalDistanceM: number;
  paceBuckets: PaceBuckets;
  terrainBuckets: TerrainBuckets;
  weatherBuckets: WeatherBuckets;
  timeBuckets: TimeBuckets;
  seasonBuckets: SeasonBuckets;
  chapters: GearChapterView[];
  milestones: GearMilestoneView[];
  highlights: GearHighlights;
  lifePath: GearLifePathSegment[];
  computedAt: string;
}
