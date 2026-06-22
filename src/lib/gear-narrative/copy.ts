import type { NarrativeTone } from './types';

/** Base + disambiguator keys used as nicknameKey */
export const NICKNAME_LABELS: Record<NarrativeTone, Record<string, string>> = {
  whimsical: {
    speedster: 'The PR Goblin',
    steady_companion: 'Trusty Sidekick',
    hill_goat: 'Hill Goat',
    dawn_companion: 'Dawn Whisperer',
    storm_chaser: 'Mud Goblin',
    weekend_warrior: 'Weekend Beast',
    long_haul: 'Odyssey Engine',
    all_rounder: 'Jack of All Trails',
    speedster_ii: 'The PR Goblin II',
    speedster_iii: 'The PR Goblin III',
    steady_companion_ii: 'Trusty Sidekick II',
    steady_companion_iii: 'Trusty Sidekick III',
    hill_goat_ii: 'Hill Goat II',
    hill_goat_iii: 'Hill Goat III',
    dawn_companion_ii: 'Dawn Whisperer II',
    dawn_companion_iii: 'Dawn Whisperer III',
    storm_chaser_ii: 'Mud Goblin II',
    storm_chaser_iii: 'Mud Goblin III',
    weekend_warrior_ii: 'Weekend Beast II',
    weekend_warrior_iii: 'Weekend Beast III',
    long_haul_ii: 'Odyssey Engine II',
    long_haul_iii: 'Odyssey Engine III',
    all_rounder_ii: 'Jack of All Trails II',
    all_rounder_iii: 'Jack of All Trails III',
  },
  serious: {
    speedster: 'Tempo Specialist',
    steady_companion: 'Steady Companion',
    hill_goat: 'Hill Runner',
    dawn_companion: 'Early Runner',
    storm_chaser: 'All-Weather Runner',
    weekend_warrior: 'Weekend Runner',
    long_haul: 'Long-Distance Shoe',
    all_rounder: 'All-Rounder',
    speedster_ii: 'Tempo Specialist II',
    speedster_iii: 'Tempo Specialist III',
    steady_companion_ii: 'Steady Companion II',
    steady_companion_iii: 'Steady Companion III',
    hill_goat_ii: 'Hill Runner II',
    hill_goat_iii: 'Hill Runner III',
    dawn_companion_ii: 'Early Runner II',
    dawn_companion_iii: 'Early Runner III',
    storm_chaser_ii: 'All-Weather Runner II',
    storm_chaser_iii: 'All-Weather Runner III',
    weekend_warrior_ii: 'Weekend Runner II',
    weekend_warrior_iii: 'Weekend Runner III',
    long_haul_ii: 'Long-Distance Shoe II',
    long_haul_iii: 'Long-Distance Shoe III',
    all_rounder_ii: 'All-Rounder II',
    all_rounder_iii: 'All-Rounder III',
  },
};

export const TRAIT_LABELS: Record<NarrativeTone, Record<string, string>> = {
  whimsical: {
    frequent_tempo: 'Loves going fast',
    rain_lover: 'Puddle collector',
    elevation_heavy: 'Hill goat legs',
    night_owl: 'Night shifter',
    summer_shoe: 'Sun chaser',
    winter_shoe: 'Frost runner',
    race_day_favorite: 'Race-day charm',
    dawn_regular: 'Early bird',
    long_run_specialist: 'Sunday long-run soul',
    easy_miles_machine: 'Easy-mile machine',
  },
  serious: {
    frequent_tempo: 'Frequent tempo work',
    rain_lover: 'High rain share',
    elevation_heavy: 'High elevation share',
    night_owl: 'Evening / night runs',
    summer_shoe: 'Summer dominant',
    winter_shoe: 'Winter dominant',
    race_day_favorite: 'Often used on races',
    dawn_regular: 'Frequent dawn runs',
    long_run_specialist: 'Long-run specialist',
    easy_miles_machine: 'Mostly easy miles',
  },
};

const CHAPTER_COPY: Record<
  NarrativeTone,
  Record<string, { title: string; body: (m: Record<string, number>) => string }>
> = {
  whimsical: {
    origin: {
      title: 'Chapter One: First Steps',
      body: (m) =>
        `Every legend starts somewhere. These shoes logged their first ${(m.km ?? 0).toFixed(0)} km with you — the opening scene of a much longer story.`,
    },
    peak_month: {
      title: 'The Peak Chapter',
      body: (m) =>
        `One month stole the spotlight: ${(m.km ?? 0).toFixed(0)} km flew by. That was peak form for this pair.`,
    },
    wet_season: {
      title: 'The Wet Season',
      body: (m) =>
        `Rain didn't scare them. About ${((m.rainShare ?? 0) * 100).toFixed(0)}% of their kilometers fell in wet weather. Puddles were plot devices.`,
    },
    speed_chapter: {
      title: 'When They Learned Speed',
      body: (m) =>
        `Tempo and race pace made up ${((m.fastShare ?? 0) * 100).toFixed(0)}% of their miles. These weren't just daily drivers — they chased clocks.`,
    },
    climb_chapter: {
      title: 'Hills & Vertical Drama',
      body: (m) =>
        `Climbing defined ${((m.hillShare ?? 0) * 100).toFixed(0)}% of their terrain. Quads remember; soles remember more.`,
    },
    final_stretch: {
      title: 'The Final Stretch',
      body: (m) =>
        `At ${(m.km ?? 0).toFixed(0)} km, this pair is deep into its saga. Every remaining kilometer counts twice.`,
    },
  },
  serious: {
    origin: {
      title: 'First use',
      body: (m) =>
        `First ${(m.km ?? 0).toFixed(0)} km recorded with this shoe. Baseline for all later usage patterns.`,
    },
    peak_month: {
      title: 'Peak month',
      body: (m) =>
        `Highest monthly volume: ${(m.km ?? 0).toFixed(0)} km. That period dominates this shoe's usage history.`,
    },
    wet_season: {
      title: 'Wet conditions',
      body: (m) =>
        `Approximately ${((m.rainShare ?? 0) * 100).toFixed(0)}% of distance occurred in rain or wet weather.`,
    },
    speed_chapter: {
      title: 'Faster efforts',
      body: (m) =>
        `Tempo and race pace account for ${((m.fastShare ?? 0) * 100).toFixed(0)}% of distance in this shoe.`,
    },
    climb_chapter: {
      title: 'Elevated terrain',
      body: (m) =>
        `Hilly or mountain terrain makes up ${((m.hillShare ?? 0) * 100).toFixed(0)}% of recorded distance.`,
    },
    final_stretch: {
      title: 'Late lifespan',
      body: (m) =>
        `Current total ${(m.km ?? 0).toFixed(0)} km places this shoe in later lifespan. Monitor wear and consider rotation or replacement.`,
    },
  },
};

const MILESTONE_COPY: Record<
  NarrativeTone,
  Record<string, { title: string; body: (m: Record<string, number>) => string }>
> = {
  whimsical: {
    first_run: { title: 'First run', body: () => 'The journey begins.' },
    km_100: { title: '100 km', body: () => 'Triple digits. Still feeling fresh — or pretending to.' },
    km_250: { title: '250 km', body: () => 'A quarter-thousand. Habits formed.' },
    km_500: { title: '500 km', body: () => 'Halfway to the classic 1000 km horizon.' },
    km_750: { title: '750 km', body: () => 'Deep into the story. Cushioning has opinions.' },
    km_1000: { title: '1000 km', body: () => 'A full epic. Retirement (or hero status) looms.' },
    first_race: { title: 'First race', body: () => 'Race bib energy unlocked.' },
    first_rain: { title: 'First rain', body: () => 'Waterproof is a state of mind.' },
    first_freeze: { title: 'First freeze', body: () => 'Cold toes, warm memories.' },
    retired: { title: 'Retired', body: () => 'Hung up with honor. The story is complete — or archived.' },
  },
  serious: {
    first_run: { title: 'First run', body: () => 'Initial activity recorded with this gear.' },
    km_100: { title: '100 km', body: () => '100 km total distance reached.' },
    km_250: { title: '250 km', body: () => '250 km total distance reached.' },
    km_500: { title: '500 km', body: () => '500 km total distance reached.' },
    km_750: { title: '750 km', body: () => '750 km total distance reached.' },
    km_1000: { title: '1000 km', body: () => '1000 km total distance reached.' },
    first_race: { title: 'First race', body: () => 'First race-type activity recorded.' },
    first_rain: { title: 'First rain', body: () => 'First run in measurable precipitation.' },
    first_freeze: { title: 'First freeze', body: () => 'First run below freezing temperature.' },
    retired: { title: 'Retired', body: () => 'Gear marked retired in Strava.' },
  },
};

export function nicknameLabel(key: string, tone: NarrativeTone): string {
  return NICKNAME_LABELS[tone][key] ?? key.replace(/_/g, ' ');
}

export function traitLabel(key: string, tone: NarrativeTone): string {
  return TRAIT_LABELS[tone][key] ?? key.replace(/_/g, ' ');
}

export function chapterView(
  key: string,
  tone: NarrativeTone,
  metrics: Record<string, number> = {},
  base?: { startDate?: string; endDate?: string; distanceM: number; runCount: number }
) {
  const entry = CHAPTER_COPY[tone][key];
  return {
    key,
    startDate: base?.startDate,
    endDate: base?.endDate,
    distanceM: base?.distanceM ?? 0,
    runCount: base?.runCount ?? 0,
    metrics,
    title: entry?.title ?? key,
    body: entry?.body(metrics) ?? '',
  };
}

export function milestoneView(
  key: string,
  tone: NarrativeTone,
  at: string,
  metrics: Record<string, number> = {},
  distanceM?: number
) {
  const entry = MILESTONE_COPY[tone][key];
  return {
    key,
    at,
    distanceM,
    metrics,
    title: entry?.title ?? key,
    body: entry?.body(metrics) ?? '',
  };
}

export function buildTagline(
  nicknameKey: string,
  tone: NarrativeTone,
  topTraitKey: string | null,
  totalKm: number,
  runCount: number
): string {
  const name = nicknameLabel(nicknameKey, tone);
  const trait = topTraitKey ? traitLabel(topTraitKey, tone).toLowerCase() : null;
  if (tone === 'whimsical') {
    if (trait) return `${name} — ${trait}, ${totalKm.toFixed(0)} km across ${runCount} runs.`;
    return `${name} — ${totalKm.toFixed(0)} km of stories and ${runCount} runs.`;
  }
  if (trait) return `${name}. ${totalKm.toFixed(0)} km, ${runCount} runs. Notable: ${trait}.`;
  return `${name}. ${totalKm.toFixed(0)} km across ${runCount} runs.`;
}

/** Dev/test helper: ensure no duplicate labels within a tone map */
export function assertUniqueLabelsInTone(tone: NarrativeTone): string[] {
  const labels = Object.values(NICKNAME_LABELS[tone]);
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const l of labels) {
    if (seen.has(l)) dupes.push(l);
    seen.add(l);
  }
  return dupes;
}
