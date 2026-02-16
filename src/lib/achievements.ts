import type { StravaActivity } from './strava';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'distance' | 'speed' | 'consistency' | 'elevation' | 'milestones' | 'special';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  unlocked: boolean;
  progress: number; // 0-100
  target: number;
  current: number;
  unit: string;
  unlockedDate?: Date;
}

interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: Achievement['category'];
  tier: Achievement['tier'];
  checker: (activities: StravaActivity[]) => { unlocked: boolean; progress: number; current: number; target: number };
  unit: string;
}

const achievementDefinitions: AchievementDefinition[] = [
  // DISTANCE ACHIEVEMENTS
  {
    id: 'first-5k',
    name: 'First Steps',
    description: 'Complete your first 5K run',
    icon: '🎯',
    category: 'distance',
    tier: 'bronze',
    unit: 'km',
    checker: (activities) => {
      const longestRun = Math.max(...activities.map(a => a.distance), 0);
      return {
        unlocked: longestRun >= 5000,
        progress: Math.min((longestRun / 5000) * 100, 100),
        current: longestRun / 1000,
        target: 5
      };
    }
  },
  {
    id: 'first-10k',
    name: 'Double Digits',
    description: 'Complete your first 10K run',
    icon: '🏃',
    category: 'distance',
    tier: 'silver',
    unit: 'km',
    checker: (activities) => {
      const longestRun = Math.max(...activities.map(a => a.distance), 0);
      return {
        unlocked: longestRun >= 10000,
        progress: Math.min((longestRun / 10000) * 100, 100),
        current: longestRun / 1000,
        target: 10
      };
    }
  },
  {
    id: 'half-marathon',
    name: 'Half the Battle',
    description: 'Complete a half marathon (21.1 km)',
    icon: '🎖️',
    category: 'distance',
    tier: 'gold',
    unit: 'km',
    checker: (activities) => {
      const longestRun = Math.max(...activities.map(a => a.distance), 0);
      return {
        unlocked: longestRun >= 21097,
        progress: Math.min((longestRun / 21097) * 100, 100),
        current: longestRun / 1000,
        target: 21.1
      };
    }
  },
  {
    id: 'marathon',
    name: 'Marathon Warrior',
    description: 'Complete a full marathon (42.2 km)',
    icon: '👑',
    category: 'distance',
    tier: 'platinum',
    unit: 'km',
    checker: (activities) => {
      const longestRun = Math.max(...activities.map(a => a.distance), 0);
      return {
        unlocked: longestRun >= 42195,
        progress: Math.min((longestRun / 42195) * 100, 100),
        current: longestRun / 1000,
        target: 42.2
      };
    }
  },
  {
    id: 'ultra-runner',
    name: 'Ultra Legend',
    description: 'Complete an ultra marathon (50+ km)',
    icon: '💎',
    category: 'distance',
    tier: 'diamond',
    unit: 'km',
    checker: (activities) => {
      const longestRun = Math.max(...activities.map(a => a.distance), 0);
      return {
        unlocked: longestRun >= 50000,
        progress: Math.min((longestRun / 50000) * 100, 100),
        current: longestRun / 1000,
        target: 50
      };
    }
  },

  // TOTAL DISTANCE MILESTONES
  {
    id: 'century',
    name: 'Century Runner',
    description: 'Run a total of 100 km',
    icon: '💯',
    category: 'milestones',
    tier: 'bronze',
    unit: 'km',
    checker: (activities) => {
      const total = activities.reduce((sum, a) => sum + a.distance, 0);
      return {
        unlocked: total >= 100000,
        progress: Math.min((total / 100000) * 100, 100),
        current: total / 1000,
        target: 100
      };
    }
  },
  {
    id: 'half-thousand',
    name: 'Half Thousand',
    description: 'Run a total of 500 km',
    icon: '🔥',
    category: 'milestones',
    tier: 'silver',
    unit: 'km',
    checker: (activities) => {
      const total = activities.reduce((sum, a) => sum + a.distance, 0);
      return {
        unlocked: total >= 500000,
        progress: Math.min((total / 500000) * 100, 100),
        current: total / 1000,
        target: 500
      };
    }
  },
  {
    id: 'thousand-k',
    name: 'Thousand Kilometer Club',
    description: 'Run a total of 1,000 km',
    icon: '⭐',
    category: 'milestones',
    tier: 'gold',
    unit: 'km',
    checker: (activities) => {
      const total = activities.reduce((sum, a) => sum + a.distance, 0);
      return {
        unlocked: total >= 1000000,
        progress: Math.min((total / 1000000) * 100, 100),
        current: total / 1000,
        target: 1000
      };
    }
  },
  {
    id: 'five-thousand',
    name: 'Distance Dominator',
    description: 'Run a total of 5,000 km',
    icon: '🌟',
    category: 'milestones',
    tier: 'platinum',
    unit: 'km',
    checker: (activities) => {
      const total = activities.reduce((sum, a) => sum + a.distance, 0);
      return {
        unlocked: total >= 5000000,
        progress: Math.min((total / 5000000) * 100, 100),
        current: total / 1000,
        target: 5000
      };
    }
  },

  // CONSISTENCY ACHIEVEMENTS
  {
    id: 'week-streak',
    name: 'Week Warrior',
    description: 'Run at least 3 times in one week',
    icon: '📅',
    category: 'consistency',
    tier: 'bronze',
    unit: 'runs',
    checker: (activities) => {
      const weekRuns = getMaxRunsInWeek(activities);
      return {
        unlocked: weekRuns >= 3,
        progress: Math.min((weekRuns / 3) * 100, 100),
        current: weekRuns,
        target: 3
      };
    }
  },
  {
    id: 'dedicated-runner',
    name: 'Dedicated Runner',
    description: 'Run at least 5 times in one week',
    icon: '💪',
    category: 'consistency',
    tier: 'silver',
    unit: 'runs',
    checker: (activities) => {
      const weekRuns = getMaxRunsInWeek(activities);
      return {
        unlocked: weekRuns >= 5,
        progress: Math.min((weekRuns / 5) * 100, 100),
        current: weekRuns,
        target: 5
      };
    }
  },
  {
    id: 'daily-runner',
    name: 'Daily Grinder',
    description: 'Run every day for a week',
    icon: '🔥',
    category: 'consistency',
    tier: 'gold',
    unit: 'days',
    checker: (activities) => {
      const streak = getLongestStreak(activities);
      return {
        unlocked: streak >= 7,
        progress: Math.min((streak / 7) * 100, 100),
        current: streak,
        target: 7
      };
    }
  },
  {
    id: 'month-streak',
    name: 'Unstoppable',
    description: 'Run every day for 30 days straight',
    icon: '🏆',
    category: 'consistency',
    tier: 'platinum',
    unit: 'days',
    checker: (activities) => {
      const streak = getLongestStreak(activities);
      return {
        unlocked: streak >= 30,
        progress: Math.min((streak / 30) * 100, 100),
        current: streak,
        target: 30
      };
    }
  },

  // SPEED ACHIEVEMENTS
  {
    id: 'speed-demon-5k',
    name: 'Speed Demon',
    description: 'Complete a 5K in under 25 minutes',
    icon: '⚡',
    category: 'speed',
    tier: 'silver',
    unit: 'min',
    checker: (activities) => {
      const best5k = getBestTimeForDistance(activities, 4500, 5500);
      const targetTime = 25 * 60; // 25 minutes in seconds
      return {
        unlocked: best5k > 0 && best5k <= targetTime,
        progress: best5k > 0 ? Math.min((targetTime / best5k) * 100, 100) : 0,
        current: best5k / 60,
        target: 25
      };
    }
  },
  {
    id: 'fast-10k',
    name: '10K Speedster',
    description: 'Complete a 10K in under 50 minutes',
    icon: '💨',
    category: 'speed',
    tier: 'gold',
    unit: 'min',
    checker: (activities) => {
      const best10k = getBestTimeForDistance(activities, 9500, 10500);
      const targetTime = 50 * 60;
      return {
        unlocked: best10k > 0 && best10k <= targetTime,
        progress: best10k > 0 ? Math.min((targetTime / best10k) * 100, 100) : 0,
        current: best10k / 60,
        target: 50
      };
    }
  },

  // ELEVATION ACHIEVEMENTS
  {
    id: 'hill-climber',
    name: 'Hill Climber',
    description: 'Gain 100m elevation in a single run',
    icon: '⛰️',
    category: 'elevation',
    tier: 'bronze',
    unit: 'm',
    checker: (activities) => {
      const maxElevation = Math.max(...activities.map(a => a.total_elevation_gain), 0);
      return {
        unlocked: maxElevation >= 100,
        progress: Math.min((maxElevation / 100) * 100, 100),
        current: maxElevation,
        target: 100
      };
    }
  },
  {
    id: 'mountain-goat',
    name: 'Mountain Goat',
    description: 'Gain 500m elevation in a single run',
    icon: '🏔️',
    category: 'elevation',
    tier: 'silver',
    unit: 'm',
    checker: (activities) => {
      const maxElevation = Math.max(...activities.map(a => a.total_elevation_gain), 0);
      return {
        unlocked: maxElevation >= 500,
        progress: Math.min((maxElevation / 500) * 100, 100),
        current: maxElevation,
        target: 500
      };
    }
  },
  {
    id: 'peak-master',
    name: 'Peak Master',
    description: 'Gain 1000m elevation in a single run',
    icon: '🗻',
    category: 'elevation',
    tier: 'gold',
    unit: 'm',
    checker: (activities) => {
      const maxElevation = Math.max(...activities.map(a => a.total_elevation_gain), 0);
      return {
        unlocked: maxElevation >= 1000,
        progress: Math.min((maxElevation / 1000) * 100, 100),
        current: maxElevation,
        target: 1000
      };
    }
  },

  // SPECIAL ACHIEVEMENTS
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Complete a run before 6 AM',
    icon: '🌅',
    category: 'special',
    tier: 'bronze',
    unit: 'runs',
    checker: (activities) => {
      const earlyRuns = activities.filter(a => {
        const hour = new Date(a.start_date_local).getHours();
        return hour < 6;
      }).length;
      return {
        unlocked: earlyRuns > 0,
        progress: earlyRuns > 0 ? 100 : 0,
        current: earlyRuns,
        target: 1
      };
    }
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Complete a run after 10 PM',
    icon: '🦉',
    category: 'special',
    tier: 'bronze',
    unit: 'runs',
    checker: (activities) => {
      const nightRuns = activities.filter(a => {
        const hour = new Date(a.start_date_local).getHours();
        return hour >= 22;
      }).length;
      return {
        unlocked: nightRuns > 0,
        progress: nightRuns > 0 ? 100 : 0,
        current: nightRuns,
        target: 1
      };
    }
  },
  {
    id: 'century-club',
    name: 'Century Club',
    description: 'Complete 100 runs',
    icon: '💯',
    category: 'special',
    tier: 'gold',
    unit: 'runs',
    checker: (activities) => {
      const count = activities.length;
      return {
        unlocked: count >= 100,
        progress: Math.min((count / 100) * 100, 100),
        current: count,
        target: 100
      };
    }
  },
];

// Helper functions
function getMaxRunsInWeek(activities: StravaActivity[]): number {
  const weeklyRuns = new Map<string, number>();
  
  activities.forEach(activity => {
    const date = new Date(activity.start_date_local);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    weeklyRuns.set(weekKey, (weeklyRuns.get(weekKey) || 0) + 1);
  });
  
  return Math.max(...Array.from(weeklyRuns.values()), 0);
}

function getLongestStreak(activities: StravaActivity[]): number {
  if (activities.length === 0) return 0;
  
  const dates = activities
    .map(a => new Date(a.start_date_local).toISOString().split('T')[0])
    .sort();
  
  const uniqueDates = Array.from(new Set(dates));
  
  let maxStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1]);
    const currDate = new Date(uniqueDates[i]);
    const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  return maxStreak;
}

function getBestTimeForDistance(activities: StravaActivity[], minDistance: number, maxDistance: number): number {
  const qualifyingRuns = activities.filter(a => 
    a.distance >= minDistance && a.distance <= maxDistance
  );
  
  if (qualifyingRuns.length === 0) return 0;
  
  return Math.min(...qualifyingRuns.map(a => a.moving_time));
}

export function calculateAchievements(activities: StravaActivity[]): Achievement[] {
  const runActivities = activities.filter(a => a.type === 'Run' || a.sport_type === 'Run');
  
  return achievementDefinitions.map(def => {
    const result = def.checker(runActivities);
    
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      category: def.category,
      tier: def.tier,
      unlocked: result.unlocked,
      progress: Math.round(result.progress),
      target: result.target,
      current: Math.round(result.current * 10) / 10,
      unit: def.unit,
      unlockedDate: result.unlocked ? new Date() : undefined
    };
  });
}
