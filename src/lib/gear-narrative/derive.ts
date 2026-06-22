import {
  ARCHETYPE_KEYS,
  type ActivityForNarrative,
  type ClassifiedRun,
  type GearChapterStored,
  type GearDraftNarrative,
  type GearHighlights,
  type GearLifePathSegment,
  type GearMilestoneStored,
  type PaceBucket,
  type PaceBuckets,
  type SeasonBucket,
  type SeasonBuckets,
  type TerrainBucket,
  type TerrainBuckets,
  type TimeBucket,
  type TimeBuckets,
  type WeatherBucket,
  type WeatherBuckets,
} from './types';

function emptyPace(): PaceBuckets {
  return { easyKm: 0, steadyKm: 0, tempoKm: 0, raceKm: 0 };
}
function emptyTerrain(): TerrainBuckets {
  return { flatKm: 0, rollingKm: 0, hillyKm: 0, mountainKm: 0 };
}
function emptyWeather(): WeatherBuckets {
  return { clearKm: 0, rainKm: 0, snowKm: 0, coldKm: 0, hotKm: 0, windyKm: 0 };
}
function emptyTime(): TimeBuckets {
  return { dawnKm: 0, dayKm: 0, duskKm: 0, nightKm: 0, hourKm: Array(24).fill(0) };
}
function emptySeason(): SeasonBuckets {
  return { springKm: 0, summerKm: 0, autumnKm: 0, winterKm: 0 };
}

export function classifyTerrain(elevM: number, distanceM: number): TerrainBucket {
  const km = distanceM / 1000;
  if (km <= 0) return 'flat';
  const mPerKm = elevM / km;
  if (mPerKm < 15) return 'flat';
  if (mPerKm < 30) return 'rolling';
  if (mPerKm < 50) return 'hilly';
  return 'mountain';
}

export function classifyTimeOfDay(localDate: Date): TimeBucket {
  const h = localDate.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

export function classifySeason(localDate: Date): SeasonBucket {
  const m = localDate.getMonth(); // 0-11 NH
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export function classifyWeather(a: ActivityForNarrative): WeatherBucket {
  if (a.weatherTempC == null && a.weatherCode == null && a.weatherPrecipMm == null) {
    return 'unknown';
  }
  const code = a.weatherCode ?? 0;
  const precip = a.weatherPrecipMm ?? 0;
  const temp = a.weatherTempC ?? 15;
  const wind = a.weatherWindKmh ?? 0;

  // WMO snow codes roughly 71-77, 85-86
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (precip >= 0.5 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (wind >= 30) return 'windy';
  if (temp < 5) return 'cold';
  if (temp > 25) return 'hot';
  return 'clear';
}

function percentileThresholds(sortedAsc: number[]): { p40: number; p70: number; p90: number } {
  if (sortedAsc.length === 0) return { p40: 0, p70: 0, p90: 0 };
  const at = (p: number) => {
    const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
    return sortedAsc[idx];
  };
  return { p40: at(40), p70: at(70), p90: at(90) };
}

/** Faster speed = lower pace rank; we bucket by speed percentiles */
export function classifyPace(
  speed: number,
  thresholds: { p40: number; p70: number; p90: number },
  workoutType?: number | null
): PaceBucket {
  // Strava workout_type 1 is often race
  if (workoutType === 1) return 'race';
  if (speed >= thresholds.p90) return 'race';
  if (speed >= thresholds.p70) return 'tempo';
  if (speed >= thresholds.p40) return 'steady';
  return 'easy';
}

export function classifyRuns(activities: ActivityForNarrative[]): ClassifiedRun[] {
  const speeds = activities.map((a) => a.averageSpeed).filter((s) => s > 0).sort((a, b) => a - b);
  const thr = percentileThresholds(speeds);

  return activities.map((activity) => {
    const km = activity.distance / 1000;
    return {
      activity,
      pace: classifyPace(activity.averageSpeed, thr, activity.workoutType),
      terrain: classifyTerrain(activity.totalElevationGain, activity.distance),
      weather: classifyWeather(activity),
      timeOfDay: classifyTimeOfDay(activity.startDateLocal),
      season: classifySeason(activity.startDateLocal),
      km,
    };
  });
}

function addPace(b: PaceBuckets, pace: PaceBucket, km: number) {
  if (pace === 'easy') b.easyKm += km;
  else if (pace === 'steady') b.steadyKm += km;
  else if (pace === 'tempo') b.tempoKm += km;
  else b.raceKm += km;
}

function addTerrain(b: TerrainBuckets, t: TerrainBucket, km: number) {
  if (t === 'flat') b.flatKm += km;
  else if (t === 'rolling') b.rollingKm += km;
  else if (t === 'hilly') b.hillyKm += km;
  else b.mountainKm += km;
}

function addWeather(b: WeatherBuckets, w: WeatherBucket, km: number) {
  if (w === 'unknown') return;
  if (w === 'clear') b.clearKm += km;
  else if (w === 'rain') b.rainKm += km;
  else if (w === 'snow') b.snowKm += km;
  else if (w === 'cold') b.coldKm += km;
  else if (w === 'hot') b.hotKm += km;
  else if (w === 'windy') b.windyKm += km;
}

function addTime(b: TimeBuckets, t: TimeBucket, km: number, hour?: number) {
  if (t === 'dawn') b.dawnKm += km;
  else if (t === 'day') b.dayKm += km;
  else if (t === 'dusk') b.duskKm += km;
  else b.nightKm += km;
  if (hour != null && hour >= 0 && hour < 24) {
    if (!b.hourKm || b.hourKm.length !== 24) b.hourKm = Array(24).fill(0);
    b.hourKm[hour] += km;
  }
}

function addSeason(b: SeasonBuckets, s: SeasonBucket, km: number) {
  if (s === 'spring') b.springKm += km;
  else if (s === 'summer') b.summerKm += km;
  else if (s === 'autumn') b.autumnKm += km;
  else b.winterKm += km;
}

export function scoreArchetypes(runs: ClassifiedRun[], totalKm: number): Record<string, number> {
  const scores: Record<string, number> = Object.fromEntries(ARCHETYPE_KEYS.map((k) => [k, 0]));
  if (totalKm <= 0 || runs.length === 0) {
    scores.all_rounder = 1;
    return scores;
  }

  let tempoRace = 0;
  let easySteady = 0;
  let hills = 0;
  let dawn = 0;
  let storm = 0;
  let weekendKm = 0;
  let longRuns = 0;

  for (const r of runs) {
    if (r.pace === 'tempo' || r.pace === 'race') tempoRace += r.km;
    if (r.pace === 'easy' || r.pace === 'steady') easySteady += r.km;
    if (r.terrain === 'hilly' || r.terrain === 'mountain') hills += r.km;
    if (r.timeOfDay === 'dawn') dawn += r.km;
    if (r.weather === 'rain' || r.weather === 'snow' || r.weather === 'windy') storm += r.km;
    const dow = r.activity.startDateLocal.getDay();
    if (dow === 0 || dow === 6) weekendKm += r.km;
    if (r.km >= 15) longRuns += r.km;
  }

  scores.speedster = tempoRace / totalKm;
  scores.steady_companion = easySteady / totalKm;
  scores.hill_goat = hills / totalKm;
  scores.dawn_companion = dawn / totalKm;
  scores.storm_chaser = storm / totalKm;
  scores.weekend_warrior = weekendKm / totalKm;
  scores.long_haul = longRuns / totalKm;
  scores.all_rounder = 0.15; // mild baseline so ties fall here sometimes

  return scores;
}

export function pickArchetypeKey(scores: Record<string, number>): string {
  let best = 'all_rounder';
  let bestScore = -1;
  for (const key of ARCHETYPE_KEYS) {
    const s = scores[key] ?? 0;
    if (s > bestScore) {
      bestScore = s;
      best = key;
    }
  }
  return best;
}

export function collectTraitKeys(runs: ClassifiedRun[], totalKm: number): string[] {
  if (totalKm <= 0) return [];
  const traits: { key: string; score: number }[] = [];

  let tempoRace = 0,
    rain = 0,
    hills = 0,
    night = 0,
    summer = 0,
    winter = 0,
    dawn = 0,
    longR = 0,
    easy = 0,
    races = 0;

  for (const r of runs) {
    if (r.pace === 'tempo' || r.pace === 'race') tempoRace += r.km;
    if (r.weather === 'rain' || r.weather === 'snow') rain += r.km;
    if (r.terrain === 'hilly' || r.terrain === 'mountain') hills += r.km;
    if (r.timeOfDay === 'night' || r.timeOfDay === 'dusk') night += r.km;
    if (r.season === 'summer') summer += r.km;
    if (r.season === 'winter') winter += r.km;
    if (r.timeOfDay === 'dawn') dawn += r.km;
    if (r.km >= 15) longR += r.km;
    if (r.pace === 'easy') easy += r.km;
    if (r.activity.workoutType === 1 || r.pace === 'race') races += r.km;
  }

  const push = (key: string, share: number, min = 0.2) => {
    if (share >= min) traits.push({ key, score: share });
  };

  push('frequent_tempo', tempoRace / totalKm, 0.22);
  push('rain_lover', rain / totalKm, 0.12);
  push('elevation_heavy', hills / totalKm, 0.25);
  push('night_owl', night / totalKm, 0.25);
  push('summer_shoe', summer / totalKm, 0.4);
  push('winter_shoe', winter / totalKm, 0.35);
  push('dawn_regular', dawn / totalKm, 0.2);
  push('long_run_specialist', longR / totalKm, 0.3);
  push('easy_miles_machine', easy / totalKm, 0.45);
  push('race_day_favorite', races / totalKm, 0.08);

  return traits
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((t) => t.key);
}

export function rankedNicknameCandidates(archetypeKey: string, scores: Record<string, number>): string[] {
  const ranked = [...ARCHETYPE_KEYS].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  const out: string[] = [];
  const push = (k: string) => {
    if (!out.includes(k)) out.push(k);
  };
  push(archetypeKey);
  for (const k of ranked) push(k);
  // disambiguators last
  for (const base of ranked) {
    push(`${base}_ii`);
    push(`${base}_iii`);
  }
  return out;
}

function buildBuckets(runs: ClassifiedRun[]) {
  const paceBuckets = emptyPace();
  const terrainBuckets = emptyTerrain();
  const weatherBuckets = emptyWeather();
  const timeBuckets = emptyTime();
  const seasonBuckets = emptySeason();
  for (const r of runs) {
    addPace(paceBuckets, r.pace, r.km);
    addTerrain(terrainBuckets, r.terrain, r.km);
    addWeather(weatherBuckets, r.weather, r.km);
    addTime(timeBuckets, r.timeOfDay, r.km, r.activity.startDateLocal.getHours());
    addSeason(seasonBuckets, r.season, r.km);
  }
  return { paceBuckets, terrainBuckets, weatherBuckets, timeBuckets, seasonBuckets };
}

/** Prefer Strava id for /run/[id] routes (Strava API expects numeric activity ids). */
function runLinkId(a: ActivityForNarrative): string {
  return a.stravaId || a.id;
}

function buildHighlights(runs: ClassifiedRun[]): GearHighlights {
  const h: GearHighlights = {};
  for (const r of runs) {
    const a = r.activity;
    if (h.fastestSpeed == null || a.averageSpeed > h.fastestSpeed) {
      h.fastestSpeed = a.averageSpeed;
      h.fastestActivityId = runLinkId(a);
    }
    if (h.longestDistanceM == null || a.distance > h.longestDistanceM) {
      h.longestDistanceM = a.distance;
      h.longestActivityId = runLinkId(a);
    }
    if (h.maxElevM == null || a.totalElevationGain > h.maxElevM) {
      h.maxElevM = a.totalElevationGain;
      h.hilliestActivityId = runLinkId(a);
    }
    if (a.weatherPrecipMm != null && (h.maxPrecipMm == null || a.weatherPrecipMm > h.maxPrecipMm)) {
      h.maxPrecipMm = a.weatherPrecipMm;
      h.wettestActivityId = runLinkId(a);
    }
    if (a.weatherTempC != null && (h.minTempC == null || a.weatherTempC < h.minTempC)) {
      h.minTempC = a.weatherTempC;
      h.coldestActivityId = runLinkId(a);
    }
    if (a.weatherTempC != null && (h.maxTempC == null || a.weatherTempC > h.maxTempC)) {
      h.maxTempC = a.weatherTempC;
      h.hottestActivityId = runLinkId(a);
    }
  }
  return h;
}

function buildMilestones(
  runs: ClassifiedRun[],
  retired: boolean
): GearMilestoneStored[] {
  const sorted = [...runs].sort(
    (a, b) => a.activity.startDate.getTime() - b.activity.startDate.getTime()
  );
  const out: GearMilestoneStored[] = [];
  let cum = 0;
  const thresholds = [
    { km: 100, key: 'km_100' },
    { km: 250, key: 'km_250' },
    { km: 500, key: 'km_500' },
    { km: 750, key: 'km_750' },
    { km: 1000, key: 'km_1000' },
  ];
  const hit = new Set<string>();
  let firstRain = false;
  let firstFreeze = false;
  let firstRace = false;

  if (sorted[0]) {
    out.push({
      key: 'first_run',
      at: sorted[0].activity.startDate.toISOString(),
      distanceM: sorted[0].activity.distance,
    });
  }

  for (const r of sorted) {
    cum += r.activity.distance;
    const cumKm = cum / 1000;
    for (const t of thresholds) {
      if (!hit.has(t.key) && cumKm >= t.km) {
        hit.add(t.key);
        out.push({ key: t.key, at: r.activity.startDate.toISOString(), distanceM: cum });
      }
    }
    if (!firstRace && (r.activity.workoutType === 1 || r.pace === 'race')) {
      firstRace = true;
      out.push({ key: 'first_race', at: r.activity.startDate.toISOString() });
    }
    if (!firstRain && (r.weather === 'rain' || r.weather === 'snow')) {
      firstRain = true;
      out.push({ key: 'first_rain', at: r.activity.startDate.toISOString() });
    }
    if (!firstFreeze && r.activity.weatherTempC != null && r.activity.weatherTempC < 0) {
      firstFreeze = true;
      out.push({ key: 'first_freeze', at: r.activity.startDate.toISOString() });
    }
  }

  if (retired && sorted.length) {
    out.push({
      key: 'retired',
      at: sorted[sorted.length - 1].activity.startDate.toISOString(),
      distanceM: cum,
    });
  }

  return out;
}

function buildChapters(runs: ClassifiedRun[], totalKm: number, pace: PaceBuckets, terrain: TerrainBuckets, weather: WeatherBuckets): GearChapterStored[] {
  const chapters: GearChapterStored[] = [];
  if (!runs.length) return chapters;

  const sorted = [...runs].sort(
    (a, b) => a.activity.startDate.getTime() - b.activity.startDate.getTime()
  );
  const first = sorted[0];
  chapters.push({
    key: 'origin',
    startDate: first.activity.startDate.toISOString(),
    endDate: first.activity.startDate.toISOString(),
    distanceM: first.activity.distance,
    runCount: 1,
    metrics: { km: first.km },
  });

  // Peak month
  const byMonth = new Map<string, { km: number; runs: number; start: Date; end: Date }>();
  for (const r of runs) {
    const d = r.activity.startDateLocal;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const cur = byMonth.get(key) ?? { km: 0, runs: 0, start: d, end: d };
    cur.km += r.km;
    cur.runs += 1;
    if (d < cur.start) cur.start = d;
    if (d > cur.end) cur.end = d;
    byMonth.set(key, cur);
  }
  let peakKey = '';
  let peakKm = 0;
  for (const [k, v] of byMonth) {
    if (v.km > peakKm) {
      peakKm = v.km;
      peakKey = k;
    }
  }
  if (peakKey) {
    const p = byMonth.get(peakKey)!;
    chapters.push({
      key: 'peak_month',
      startDate: p.start.toISOString(),
      endDate: p.end.toISOString(),
      distanceM: p.km * 1000,
      runCount: p.runs,
      metrics: { km: p.km },
    });
  }

  const rainShare = totalKm > 0 ? (weather.rainKm + weather.snowKm) / totalKm : 0;
  if (rainShare >= 0.1) {
    chapters.push({
      key: 'wet_season',
      distanceM: (weather.rainKm + weather.snowKm) * 1000,
      runCount: runs.filter((r) => r.weather === 'rain' || r.weather === 'snow').length,
      metrics: { rainShare },
    });
  }

  const fastShare = totalKm > 0 ? (pace.tempoKm + pace.raceKm) / totalKm : 0;
  if (fastShare >= 0.18) {
    chapters.push({
      key: 'speed_chapter',
      distanceM: (pace.tempoKm + pace.raceKm) * 1000,
      runCount: runs.filter((r) => r.pace === 'tempo' || r.pace === 'race').length,
      metrics: { fastShare },
    });
  }

  const hillShare = totalKm > 0 ? (terrain.hillyKm + terrain.mountainKm) / totalKm : 0;
  if (hillShare >= 0.2) {
    chapters.push({
      key: 'climb_chapter',
      distanceM: (terrain.hillyKm + terrain.mountainKm) * 1000,
      runCount: runs.filter((r) => r.terrain === 'hilly' || r.terrain === 'mountain').length,
      metrics: { hillShare },
    });
  }

  if (totalKm >= 800) {
    chapters.push({
      key: 'final_stretch',
      distanceM: totalKm * 1000,
      runCount: runs.length,
      metrics: { km: totalKm },
    });
  }

  // Cap at 4 by priority order already roughly applied
  const priority = ['origin', 'peak_month', 'wet_season', 'speed_chapter', 'climb_chapter', 'final_stretch'];
  chapters.sort((a, b) => priority.indexOf(a.key) - priority.indexOf(b.key));
  return chapters.slice(0, 4);
}

function dominantFromMap(entries: [string, number][]): string {
  let best = entries[0]?.[0] ?? 'easy';
  let bestV = -1;
  for (const [k, v] of entries) {
    if (v > bestV) {
      bestV = v;
      best = k;
    }
  }
  return best;
}

export function buildLifePath(runs: ClassifiedRun[]): GearLifePathSegment[] {
  if (!runs.length) return [];

  const sorted = [...runs].sort(
    (a, b) => a.activity.startDate.getTime() - b.activity.startDate.getTime()
  );
  const spanMonths =
    (sorted[sorted.length - 1].activity.startDate.getTime() - sorted[0].activity.startDate.getTime()) /
    (1000 * 60 * 60 * 24 * 30);

  if (spanMonths >= 2) {
    const groups = new Map<string, ClassifiedRun[]>();
    for (const r of sorted) {
      const d = r.activity.startDateLocal;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    return [...groups.entries()].map(([key, group]) => segmentFromGroup(key, group));
  }

  // Distance bins of 25km
  const segments: GearLifePathSegment[] = [];
  let binStart = 0;
  let cum = 0;
  let group: ClassifiedRun[] = [];
  for (const r of sorted) {
    group.push(r);
    cum += r.km;
    if (cum - binStart >= 25 || r === sorted[sorted.length - 1]) {
      const label = `${binStart.toFixed(0)}–${cum.toFixed(0)} km`;
      segments.push(segmentFromGroup(label, group));
      binStart = cum;
      group = [];
    }
  }
  return segments;
}

function segmentFromGroup(label: string, group: ClassifiedRun[]): GearLifePathSegment {
  const paceMap = new Map<PaceBucket, number>();
  const terrMap = new Map<TerrainBucket, number>();
  const weaMap = new Map<WeatherBucket, number>();
  let distanceM = 0;
  let start = group[0].activity.startDate;
  let end = group[0].activity.startDate;

  for (const r of group) {
    distanceM += r.activity.distance;
    paceMap.set(r.pace, (paceMap.get(r.pace) ?? 0) + r.km);
    terrMap.set(r.terrain, (terrMap.get(r.terrain) ?? 0) + r.km);
    if (r.weather !== 'unknown') weaMap.set(r.weather, (weaMap.get(r.weather) ?? 0) + r.km);
    if (r.activity.startDate < start) start = r.activity.startDate;
    if (r.activity.startDate > end) end = r.activity.startDate;
  }

  const monthLabel = /^\d{4}-\d{2}$/.test(label)
    ? new Date(group[0].activity.startDateLocal.getFullYear(), group[0].activity.startDateLocal.getMonth(), 1).toLocaleString(
        'en',
        { month: 'short', year: 'numeric' }
      )
    : label;

  return {
    id: label,
    label: monthLabel,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    distanceM,
    runCount: group.length,
    dominantPace: dominantFromMap([...paceMap.entries()]) as PaceBucket,
    dominantTerrain: dominantFromMap([...terrMap.entries()]) as TerrainBucket,
    dominantWeather: (weaMap.size ? dominantFromMap([...weaMap.entries()]) : 'unknown') as WeatherBucket,
    activityIds: group.map((g) => runLinkId(g.activity)),
  };
}

export function deriveGearDraft(
  gearId: string,
  activities: ActivityForNarrative[],
  retired: boolean
): GearDraftNarrative {
  const runs = classifyRuns(activities);
  const totalDistanceM = activities.reduce((s, a) => s + a.distance, 0);
  const totalKm = totalDistanceM / 1000;
  const scores = scoreArchetypes(runs, totalKm);
  const archetypeKey = pickArchetypeKey(scores);
  const traitKeys = collectTraitKeys(runs, totalKm);
  const buckets = buildBuckets(runs);
  const sortedDates = activities.map((a) => a.startDate).sort((a, b) => a.getTime() - b.getTime());

  return {
    gearId,
    archetypeKey,
    nicknameKey: archetypeKey, // temporary; uniqueness pass overwrites
    traitKeys,
    firstRunAt: sortedDates[0] ?? null,
    lastRunAt: sortedDates[sortedDates.length - 1] ?? null,
    runCount: activities.length,
    totalDistanceM,
    ...buckets,
    chapters: buildChapters(runs, totalKm, buckets.paceBuckets, buckets.terrainBuckets, buckets.weatherBuckets),
    milestones: buildMilestones(runs, retired),
    highlights: buildHighlights(runs),
    lifePath: buildLifePath(runs),
    nicknameCandidates: rankedNicknameCandidates(archetypeKey, scores),
  };
}

/**
 * Assign unique nicknameKey across all drafts for one user.
 * Priority: more distance, then more recent last run, then gearId.
 */
export function assignUniqueNicknames(drafts: GearDraftNarrative[]): GearDraftNarrative[] {
  const sorted = [...drafts].sort((a, b) => {
    if (b.totalDistanceM !== a.totalDistanceM) return b.totalDistanceM - a.totalDistanceM;
    const aT = a.lastRunAt?.getTime() ?? 0;
    const bT = b.lastRunAt?.getTime() ?? 0;
    if (bT !== aT) return bT - aT;
    return a.gearId.localeCompare(b.gearId);
  });

  const used = new Set<string>();
  for (const d of sorted) {
    let chosen = d.archetypeKey;
    for (const cand of d.nicknameCandidates) {
      if (!used.has(cand)) {
        chosen = cand;
        break;
      }
    }
    // ultimate fallback
    let n = 4;
    while (used.has(chosen)) {
      chosen = `${d.archetypeKey}_${n}`;
      n++;
    }
    used.add(chosen);
    d.nicknameKey = chosen;
  }

  return drafts;
}
