// Training plan generator based on race goals and current fitness

import type { StravaActivity } from "./strava";
import { formatPaceRange as formatPaceRangeUtil } from "./utils";

export interface RaceGoal {
  date: string; // ISO date string - race date
  startDate?: string; // ISO date string - when to start training (defaults to today)
  distance: "5K" | "10K" | "Half Marathon" | "Marathon";
  targetTime?: string; // Optional target time (HH:MM:SS)
  runsPerWeek: number; // How many days per week user can run (2-7)
  trainingDays?: number[]; // Optional: specific weekdays [0=Mon, 1=Tue, ... 6=Sun]
}

export interface TrainingMetrics {
  recentRunCount: number;
  weeklyKilometers: number; // Changed from mileage
  avgPace: number;
  longestRun: number;
}

export interface PaceZones {
  easy: { min: number; max: number }; // min/km
  tempo: { min: number; max: number };
  threshold: { min: number; max: number };
  interval: { min: number; max: number };
  long: { min: number; max: number };
}

export interface DetailedTrainingMetrics extends TrainingMetrics {
  activities: StravaActivity[];
  paceZones: PaceZones;
  weeklyTrend: "increasing" | "stable" | "decreasing";
  consistencyScore: number; // 0-100
  avgLongRun: number;
  recentPaceImprovement: number; // percentage
}

export interface WeeklyPlan {
  weekNumber: number;
  weekStartDate: string;
  focus: string;
  totalKilometers: number;
  workouts: Workout[];
  notes: string;
}

export interface Workout {
  day: string;
  type:
    | "Easy Run"
    | "Long Run"
    | "Tempo Run"
    | "Intervals"
    | "Recovery Run"
    | "Rest"
    | "Cross Training"
    | "Race Day";
  distance?: number; // in km
  description: string;
  intensity: "Low" | "Medium" | "High";
}

export interface TrainingPlan {
  raceGoal: RaceGoal;
  weeksUntilRace: number;
  currentFitness: string;
  estimatedRaceTime: string;
  plan: WeeklyPlan[];
  recommendations: string[];
  generatedDate: string;
}

// Race distance mapping to kilometers
const RACE_DISTANCES = {
  "5K": 5,
  "10K": 10,
  "Half Marathon": 21.1,
  Marathon: 42.2,
};

// Calculate detailed metrics from Strava activities
export function calculateDetailedMetrics(
  activities: StravaActivity[],
  weeklyKilometers: number,
  avgPace: number,
  longestRun: number,
  recentRunCount: number
): DetailedTrainingMetrics {
  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);

  const recentRuns = activities.filter(
    (a) => new Date(a.start_date) >= fourWeeksAgo
  );
  const olderRuns = activities.filter((a) => {
    const date = new Date(a.start_date);
    return date >= eightWeeksAgo && date < fourWeeksAgo;
  });

  // Calculate pace trends
  const recentAvgPace =
    recentRuns.length > 0
      ? recentRuns.reduce(
          (sum, r) => sum + r.moving_time / 60 / (r.distance / 1000),
          0
        ) / recentRuns.length
      : avgPace;
  const olderAvgPace =
    olderRuns.length > 0
      ? olderRuns.reduce(
          (sum, r) => sum + r.moving_time / 60 / (r.distance / 1000),
          0
        ) / olderRuns.length
      : recentAvgPace;

  const paceImprovement =
    olderAvgPace > 0
      ? ((olderAvgPace - recentAvgPace) / olderAvgPace) * 100
      : 0;

  // Calculate weekly trend
  const week1km = recentRuns
    .slice(0, Math.floor(recentRuns.length / 4))
    .reduce((sum, r) => sum + r.distance / 1000, 0);
  const week4km = recentRuns
    .slice(-Math.floor(recentRuns.length / 4))
    .reduce((sum, r) => sum + r.distance / 1000, 0);
  const weeklyTrend: "increasing" | "stable" | "decreasing" =
    week4km > week1km * 1.1
      ? "increasing"
      : week4km < week1km * 0.9
      ? "decreasing"
      : "stable";

  // Calculate consistency (runs per week over 4 weeks)
  const consistencyScore = Math.min(100, (recentRunCount / 16) * 100); // 4 runs/week = 100%

  // Calculate average long run (top 25% of runs by distance)
  const sortedByDistance = [...recentRuns].sort(
    (a, b) => b.distance - a.distance
  );
  const longRuns = sortedByDistance.slice(
    0,
    Math.max(1, Math.ceil(sortedByDistance.length * 0.25))
  );
  const avgLongRun =
    longRuns.length > 0
      ? longRuns.reduce((sum, r) => sum + r.distance / 1000, 0) /
        longRuns.length
      : longestRun;

  // Calculate intelligent pace zones based on recent performance
  // Using Jack Daniels' VDOT-based pace zones
  const easyPaceMin = recentAvgPace * 1.15; // 15% slower than avg
  const easyPaceMax = recentAvgPace * 1.3; // 30% slower
  const tempoPaceMin = recentAvgPace * 0.9; // 10% faster
  const tempoPaceMax = recentAvgPace * 0.95; // 5% faster
  const thresholdPaceMin = recentAvgPace * 0.85; // 15% faster
  const thresholdPaceMax = recentAvgPace * 0.9; // 10% faster
  const intervalPaceMin = recentAvgPace * 0.75; // 25% faster
  const intervalPaceMax = recentAvgPace * 0.85; // 15% faster
  const longPaceMin = recentAvgPace * 1.1; // 10% slower
  const longPaceMax = recentAvgPace * 1.2; // 20% slower

  const paceZones: PaceZones = {
    easy: { min: easyPaceMin, max: easyPaceMax },
    tempo: { min: tempoPaceMin, max: tempoPaceMax },
    threshold: { min: thresholdPaceMin, max: thresholdPaceMax },
    interval: { min: intervalPaceMin, max: intervalPaceMax },
    long: { min: longPaceMin, max: longPaceMax },
  };

  return {
    activities,
    recentRunCount,
    weeklyKilometers,
    avgPace: recentAvgPace,
    longestRun,
    paceZones,
    weeklyTrend,
    consistencyScore,
    avgLongRun,
    recentPaceImprovement: paceImprovement,
  };
}

// Use centralized util function
const formatPaceRange = formatPaceRangeUtil;

// Calculate weeks until race from a given start date
function getWeeksUntilRace(raceDate: string, startDate?: string): number {
  const start = startDate ? new Date(startDate) : new Date();
  const race = new Date(raceDate);
  const diffTime = race.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.ceil(diffDays / 7);
}

// Assess current fitness level using comprehensive Strava data
function assessFitnessLevel(
  metrics: DetailedTrainingMetrics,
  raceDistance: string
): string {
  const targetDistance =
    RACE_DISTANCES[raceDistance as keyof typeof RACE_DISTANCES];

  // Multiple factors for fitness assessment
  const weeklyToRaceRatio = metrics.weeklyKilometers / targetDistance;
  const longRunRatio = metrics.avgLongRun / targetDistance;
  const consistency = metrics.consistencyScore / 100;

  // Weighted scoring system
  let score = 0;

  // Weekly volume score (0-40 points)
  if (weeklyToRaceRatio >= 2.5) score += 40;
  else if (weeklyToRaceRatio >= 1.8) score += 30;
  else if (weeklyToRaceRatio >= 1.2) score += 20;
  else score += 10;

  // Long run readiness (0-25 points)
  if (longRunRatio >= 0.7) score += 25;
  else if (longRunRatio >= 0.5) score += 18;
  else if (longRunRatio >= 0.3) score += 10;
  else score += 5;

  // Consistency score (0-20 points)
  score += consistency * 20;

  // Frequency bonus (0-15 points)
  if (metrics.recentRunCount >= 16) score += 15; // 4+ runs/week
  else if (metrics.recentRunCount >= 12) score += 10; // 3 runs/week
  else if (metrics.recentRunCount >= 8) score += 5; // 2 runs/week

  // Recent improvement bonus (0-10 points, can be negative)
  score += Math.max(-5, Math.min(10, metrics.recentPaceImprovement));

  // Classify based on total score
  if (score >= 75) return "Advanced";
  else if (score >= 50) return "Intermediate";
  else return "Beginner";
}

// Generate workout for specific phase and fitness level
function generateWorkout(
  phase: "base" | "build" | "peak" | "taper",
  dayOfWeek: number,
  weekKilometers: number,
  metrics: DetailedTrainingMetrics,
  raceDistance: string,
  runsPerWeek: number,
  customTrainingDays?: number[]
): Workout {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const paceZones = metrics.paceZones;

  // Define run days based on custom selection or frequency
  let runDays: number[] = [];

  if (customTrainingDays && customTrainingDays.length > 0) {
    // Use custom training days if provided
    runDays = customTrainingDays;
  } else {
    // Priority: Long run (Sunday) > Quality workouts > Easy runs
    if (runsPerWeek === 2) {
      runDays = [2, 6]; // Wednesday (quality), Sunday (long)
    } else if (runsPerWeek === 3) {
      runDays = [1, 4, 6]; // Tuesday (easy), Friday (quality), Sunday (long)
    } else if (runsPerWeek === 4) {
      runDays = [1, 2, 5, 6]; // Tue (easy), Wed (quality), Sat (quality), Sun (long)
    } else if (runsPerWeek === 5) {
      runDays = [1, 2, 3, 5, 6]; // Mon-Wed (build), Sat (quality), Sun (long)
    } else if (runsPerWeek === 6) {
      runDays = [1, 2, 3, 4, 5, 6]; // All except Friday (rest day)
    } else {
      // 7 runs/week
      runDays = [0, 1, 2, 3, 4, 5, 6]; // Every day
    }
  }

  // If this day is not a run day, make it rest
  if (!runDays.includes(dayOfWeek)) {
    return {
      day: days[dayOfWeek],
      type: "Rest",
      description: "Complete rest or light stretching/mobility work",
      intensity: "Low",
    };
  }

  // Long run day (last day in run days array - typically Sunday but flexible)
  const longRunDay = runDays[runDays.length - 1];
  if (dayOfWeek === longRunDay) {
    const longRunDistance = Math.round(weekKilometers * 0.35 * 10) / 10; // 35% of weekly kilometers
    const paceGuidance = formatPaceRange(
      paceZones.long.min,
      paceZones.long.max
    );
    return {
      day: days[dayOfWeek],
      type: "Long Run",
      distance: longRunDistance,
      description: `${longRunDistance}km at easy, conversational pace (${paceGuidance}). Focus on time on feet and building endurance.`,
      intensity: phase === "peak" ? "Medium" : "Low",
    };
  }

  // Quality workout day - prioritize certain days based on schedule
  // For custom days, use the middle day(s) for quality work
  let isQualityDay = false;
  if (customTrainingDays && customTrainingDays.length > 0) {
    // For custom schedules, make quality days at 1/3 and 2/3 points in the week
    const qualityIndices =
      runsPerWeek === 2
        ? [0] // First run is quality for 2/week
        : runsPerWeek === 3
        ? [1] // Middle run for 3/week
        : runsPerWeek >= 4
        ? [Math.floor(runDays.length / 3), Math.floor((runDays.length * 2) / 3)]
        : []; // Two quality days
    const qualityDays = qualityIndices.map((i) => runDays[i]);
    isQualityDay = qualityDays.includes(dayOfWeek);
  } else {
    // Default logic for non-custom days
    if (runsPerWeek === 2 && dayOfWeek === 2)
      isQualityDay = true; // Wed for 2/week
    else if (runsPerWeek === 3 && dayOfWeek === 4)
      isQualityDay = true; // Fri for 3/week
    else if (runsPerWeek >= 4 && (dayOfWeek === 2 || dayOfWeek === 5))
      isQualityDay = true; // Wed/Sat for 4+/week
  }

  if (isQualityDay) {
    // Quality workouts get same distance as easy runs for simplicity
    // The difference is in intensity, not necessarily distance
    const longRunKm = weekKilometers * 0.35;
    const remainingKm = weekKilometers - longRunKm;
    const otherRunDays = runDays.length - 1; // Exclude long run day
    const qualityDistance =
      otherRunDays > 0 ? Math.round((remainingKm / otherRunDays) * 10) / 10 : 0;

    if (phase === "base") {
      const paceGuidance = formatPaceRange(
        paceZones.easy.min,
        paceZones.easy.max
      );
      return {
        day: days[dayOfWeek],
        type: "Easy Run",
        distance: qualityDistance,
        description: `${qualityDistance}km easy run at comfortable pace (${paceGuidance})`,
        intensity: "Low",
      };
    } else if (phase === "build") {
      const tempoKm = Math.round(qualityDistance * 0.6 * 10) / 10;
      const tempoPace = formatPaceRange(
        paceZones.tempo.min,
        paceZones.tempo.max
      );
      return {
        day: days[dayOfWeek],
        type: "Tempo Run",
        distance: qualityDistance,
        description: `${qualityDistance}km total: 2km warmup, ${tempoKm}km at tempo pace (${tempoPace}, comfortably hard), 2km cooldown`,
        intensity: "High",
      };
    } else if (phase === "peak") {
      const intervalPace = formatPaceRange(
        paceZones.interval.min,
        paceZones.interval.max
      );
      const targetDistance =
        RACE_DISTANCES[raceDistance as keyof typeof RACE_DISTANCES];
      const intervalDistance = targetDistance <= 10 ? "800m" : "1km";
      return {
        day: days[dayOfWeek],
        type: "Intervals",
        distance: qualityDistance,
        description: `${qualityDistance}km total: 2km warmup, 6-8 × ${intervalDistance} at ${intervalPace} with equal recovery, 2km cooldown`,
        intensity: "High",
      };
    } else {
      // taper
      const paceGuidance = formatPaceRange(
        paceZones.easy.min,
        paceZones.easy.max
      );
      return {
        day: days[dayOfWeek],
        type: "Easy Run",
        distance: qualityDistance,
        description: `${qualityDistance}km easy run (${paceGuidance}). Keep it relaxed and save energy for race day.`,
        intensity: "Low",
      };
    }
  }

  // Easy run days (all other run days)
  // Calculate remaining km after long run (35%) and distribute among other runs
  const longRunKm = weekKilometers * 0.35;
  const remainingKm = weekKilometers - longRunKm;
  const otherRunDays = runDays.length - 1; // Exclude long run day
  const easyDistance =
    otherRunDays > 0 ? Math.round((remainingKm / otherRunDays) * 10) / 10 : 0;
  const paceGuidance = formatPaceRange(paceZones.easy.min, paceZones.easy.max);

  return {
    day: days[dayOfWeek],
    type: "Easy Run",
    distance: easyDistance,
    description: `${easyDistance}km at easy, comfortable pace (${paceGuidance})`,
    intensity: "Low",
  };
}

// Generate weekly plan based on phase
function generateWeeklyPlan(
  weekNumber: number,
  weeksUntilRace: number,
  baseWeeklyKilometers: number,
  metrics: DetailedTrainingMetrics,
  raceDistance: string,
  runsPerWeek: number,
  customTrainingDays?: number[],
  previousWeekKilometers?: number,
  planStartDate?: string
): WeeklyPlan {
  const weeksRemaining = weeksUntilRace - weekNumber + 1;
  // Use planStartDate if provided, otherwise default to today
  const startDate = planStartDate ? new Date(planStartDate) : new Date();
  const weekStartDate = new Date(
    startDate.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000
  );

  // Check if this should be a recovery week (every 4th week, but not in taper or final weeks)
  const isRecoveryWeek = weekNumber % 4 === 0 && weeksRemaining > 3;

  // Determine training phase
  let phase: "base" | "build" | "peak" | "taper";
  let targetWeeklyKilometers: number;
  let focus: string;
  let notes: string;

  if (weeksRemaining <= 2) {
    // Taper phase (last 2 weeks)
    phase = "taper";
    targetWeeklyKilometers =
      baseWeeklyKilometers * (weeksRemaining === 2 ? 0.7 : 0.5);
    focus = "Taper & Recovery";
    notes =
      weeksRemaining === 1
        ? "Final week! Reduce volume significantly, focus on rest and race prep."
        : "Begin taper. Reduce volume but maintain some intensity to stay sharp.";
  } else if (weeksRemaining <= Math.ceil(weeksUntilRace * 0.3)) {
    // Peak phase (last 30% of training, before taper)
    phase = "peak";
    targetWeeklyKilometers = baseWeeklyKilometers * 1.2; // Peak kilometers
    focus = "Race-Specific Training";
    notes =
      "Peak training volume. Include race-pace efforts and longer tempo runs.";
  } else if (weeksRemaining <= Math.ceil(weeksUntilRace * 0.6)) {
    // Build phase (middle 30% of training)
    phase = "build";
    const buildProgress =
      (weeksUntilRace * 0.6 - weeksRemaining) / (weeksUntilRace * 0.3);
    targetWeeklyKilometers = baseWeeklyKilometers * (1.0 + 0.2 * buildProgress); // Build from 100% to 120%
    focus = "Building Endurance & Speed";
    notes = "Increase volume gradually. Add tempo runs and hill work.";
  } else {
    // Base phase (first 40% of training)
    phase = "base";
    const baseProgress = (weekNumber - 1) / Math.ceil(weeksUntilRace * 0.4); // Progress from week 1
    targetWeeklyKilometers = baseWeeklyKilometers * (0.8 + 0.2 * baseProgress); // Build from 80% to 100%
    focus = "Building Base Fitness";
    notes =
      "Focus on easy kilometers and building aerobic base. No hard efforts yet.";
  }

  // Max weekly volume caps based on race distance (to prevent injury in long plans)
  const maxWeeklyKm: Record<string, number> = {
    "5K": 45,
    "10K": 65,
    "Half Marathon": 85,
    Marathon: 110,
  };

  // SIMPLIFIED 10% RULE: Just increase 10% from previous (or start conservatively)
  let weeklyKilometers: number;
  
  if (isRecoveryWeek && previousWeekKilometers) {
    // Recovery week: reduce to 85% of previous week
    weeklyKilometers = previousWeekKilometers * 0.85;
    focus = "Recovery Week";
    notes = "⚡ Recovery week: Reduced volume for recovery. All easy pace.";
  } else if (phase === "taper") {
    // Taper: use calculated target
    weeklyKilometers = targetWeeklyKilometers;
  } else if (previousWeekKilometers) {
    // Normal week: increase by 10% from previous, but cap at max
    weeklyKilometers = Math.min(previousWeekKilometers * 1.10, maxWeeklyKm[raceDistance] || 80);
  } else {
    // Week 1: Start conservatively at 80% of base
    weeklyKilometers = baseWeeklyKilometers * 0.80;
  }

  weeklyKilometers = Math.round(weeklyKilometers * 10) / 10;

  // Generate workouts for the week
  const workouts: Workout[] = [];
  for (let day = 0; day < 7; day++) {
    workouts.push(
      generateWorkout(
        phase,
        day,
        weeklyKilometers,
        metrics,
        raceDistance,
        runsPerWeek,
        customTrainingDays
      )
    );
  }

  // Add race day if it's the final week
  if (weeksRemaining === 1) {
    workouts[6] = {
      day: "Sunday",
      type: "Race Day",
      distance: RACE_DISTANCES[raceDistance as keyof typeof RACE_DISTANCES],
      description:
        "🏁 RACE DAY! Trust your training, execute your strategy, and have fun!",
      intensity: "High",
    };
  }

  // Calculate ACTUAL total kilometers from workouts
  const actualTotalKilometers = workouts.reduce((sum, workout) => {
    return sum + (workout.distance || 0);
  }, 0);
  const roundedTotalKm = Math.round(actualTotalKilometers * 10) / 10;

  return {
    weekNumber,
    weekStartDate: weekStartDate.toISOString().split("T")[0],
    focus,
    totalKilometers: roundedTotalKm, // Use actual sum instead of target
    workouts,
    notes,
  };
}

// Generate complete training plan
export function generateTrainingPlan(
  raceGoal: RaceGoal,
  trainingMetrics: DetailedTrainingMetrics,
  predictions: { formattedTime?: string }
): TrainingPlan {
  const weeksUntilRace = getWeeksUntilRace(raceGoal.date, raceGoal.startDate);
  const fitnessLevel = assessFitnessLevel(trainingMetrics, raceGoal.distance);
  const raceDistanceKm = RACE_DISTANCES[raceGoal.distance];

  // SIMPLIFIED: Start from CURRENT volume, not theoretical minimums
  // Health and injury prevention FIRST!
  let baseWeeklyKilometers = trainingMetrics.weeklyKilometers;
  
  // If they're running very little, start slightly higher but not crazy
  if (baseWeeklyKilometers < 10) {
    baseWeeklyKilometers = 12; // Minimum starting point: 12km/week
  }
  
  // Cap at reasonable max based on race distance to avoid injury
  const reasonableMax = {
    "5K": 35,
    "10K": 50,
    "Half Marathon": 70,
    Marathon: 90,
  };
  
  if (baseWeeklyKilometers > reasonableMax[raceGoal.distance]) {
    baseWeeklyKilometers = reasonableMax[raceGoal.distance];
  }

  // Generate weekly plans with progressive volume increases
  const plan: WeeklyPlan[] = [];
  // Generate full plan up to race date (no artificial cap)
  // This ensures the race day appears in the correct week
  const weeksToGenerate = weeksUntilRace;

  for (let week = 1; week <= weeksToGenerate; week++) {
    const previousWeekKm =
      week > 1 ? plan[week - 2].totalKilometers : undefined;
    plan.push(
      generateWeeklyPlan(
        week,
        weeksToGenerate,
        baseWeeklyKilometers,
        trainingMetrics,
        raceGoal.distance,
        raceGoal.runsPerWeek,
        raceGoal.trainingDays,
        previousWeekKm,
        raceGoal.startDate
      )
    );
  }

  // Generate smart recommendations based on actual data
  const recommendations: string[] = [];

  if (weeksUntilRace < 8) {
    recommendations.push(
      "⚠️ Less than 8 weeks until race. Focus on consistency and avoid injury."
    );
  }

  if (trainingMetrics.longestRun < raceDistanceKm * 0.6) {
    recommendations.push(
      `🎯 Build up your long run distance gradually. Current longest: ${trainingMetrics.longestRun.toFixed(
        1
      )}km. Target: ${(raceDistanceKm * 0.75).toFixed(1)}km+`
    );
  }

  if (trainingMetrics.weeklyKilometers < baseWeeklyKilometers * 0.8) {
    recommendations.push(
      `📈 Gradually increase weekly volume. Current: ${trainingMetrics.weeklyKilometers.toFixed(
        1
      )}km/week. Target: ${baseWeeklyKilometers.toFixed(1)}km/week`
    );
  }

  if (trainingMetrics.recentRunCount < 12) {
    recommendations.push(
      "🏃 Try to run at least 3-4 times per week for optimal race preparation."
    );
  }

  if (fitnessLevel === "Advanced") {
    recommendations.push(
      "💪 Your current fitness is excellent! Focus on race-specific workouts."
    );
  } else if (fitnessLevel === "Beginner") {
    recommendations.push(
      "🌱 Build your base gradually. Avoid increasing volume by more than 10% per week."
    );
  }

  // Pace-based recommendations
  if (trainingMetrics.recentPaceImprovement > 5) {
    recommendations.push(
      `🚀 Your pace is improving rapidly (+${trainingMetrics.recentPaceImprovement.toFixed(
        1
      )}%)! Keep up the momentum but watch for overtraining.`
    );
  } else if (trainingMetrics.recentPaceImprovement < -5) {
    recommendations.push(
      "⚠️ Your pace has slowed recently. Ensure adequate recovery and check for fatigue or overtraining."
    );
  }

  // Consistency recommendations
  if (trainingMetrics.consistencyScore < 50) {
    recommendations.push(
      `📅 Work on consistency. Current score: ${Math.round(
        trainingMetrics.consistencyScore
      )}%. Regular training yields better results.`
    );
  } else if (trainingMetrics.consistencyScore >= 80) {
    recommendations.push(
      `⭐ Excellent training consistency (${Math.round(
        trainingMetrics.consistencyScore
      )}%)! This discipline will pay off on race day.`
    );
  }

  recommendations.push(
    "💧 Stay hydrated and fuel properly on long runs (60+ minutes)."
  );
  recommendations.push(
    "😴 Prioritize sleep and recovery - progress happens during rest."
  );

  return {
    raceGoal,
    weeksUntilRace,
    currentFitness: fitnessLevel,
    estimatedRaceTime:
      predictions.formattedTime || raceGoal.targetTime || "Not available",
    plan,
    recommendations,
    generatedDate: new Date().toISOString().split("T")[0],
  };
}

// Check if plan should be regenerated (once per day)
export function shouldRegeneratePlan(
  lastGeneratedDate: string | null
): boolean {
  if (!lastGeneratedDate) return true;

  const today = new Date().toISOString().split("T")[0];
  return today !== lastGeneratedDate;
}
