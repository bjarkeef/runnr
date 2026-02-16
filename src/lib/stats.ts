import type { StravaActivity } from './strava';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, startOfWeek, isSameWeek } from 'date-fns';

export interface PersonalRecord {
    distance: string;
    time: number;
    pace: number;
    date: string;
    activityId: number;
}

export interface KudosStats {
    total: number;
    avg: number;
    max: number;
}

export interface GearStats {
    totalGear: number;
    activeGear: number;
    totalDistance: number;
    primaryGear: string | null;
    shoes: {
        name: string;
        distance: number;
        primary: boolean;
        retired: boolean;
    }[];
}

export interface StatsInsights {
    totalDistance: number;
    totalTime: number;
    totalElevation: number;
    runCount: number;
    avgDistance: number;
    avgPace: number;
    longestRun: {
        distance: number;
        date: string;
        id: number;
    };
    fastestRun: {
        pace: number;
        time: number;
        distance: number;
        date: string;
        id: number;
    };
    currentStreak: number;
    longestStreak: number;
    bestMonth: {
        month: string;
        distance: number;
    };
    mostActiveDay: string;
    prs: {
        '1k'?: PersonalRecord;
        '5k'?: PersonalRecord;
        '10k'?: PersonalRecord;
        'halfMarathon'?: PersonalRecord;
        'marathon'?: PersonalRecord;
    };
    monthlyProgress: {
        month: string;
        distance: number;
        count: number;
    }[];
    weeklyProgress: {
        week: string;
        distance: number;
        count: number;
        percentChange: number | null;
    }[];
    dayOfWeekDistribution: {
        day: string;
        count: number;
    }[];
    kudos?: KudosStats;
    gear?: GearStats;
}

export function calculateStats(
    activities: StravaActivity[],
    kudos?: KudosStats,
    gear?: GearStats,
    weeklyWeeks: number = 26
): StatsInsights {
    const runs = activities.filter(a => a.type === 'Run' || a.sport_type === 'Run');

    if (runs.length === 0) {
        return {
            totalDistance: 0,
            totalTime: 0,
            totalElevation: 0,
            runCount: 0,
            avgDistance: 0,
            avgPace: 0,
            longestRun: { distance: 0, date: '', id: 0 },
            currentStreak: 0,
            longestStreak: 0,
            bestMonth: { month: '', distance: 0 },
            mostActiveDay: '',
            prs: {},
            monthlyProgress: [],
            weeklyProgress: [],
            dayOfWeekDistribution: [],
            kudos,
            gear
        };
    }

    const totalDistance = runs.reduce((sum, a) => sum + a.distance, 0);
    const totalTime = runs.reduce((sum, a) => sum + a.moving_time, 0);
    const totalElevation = runs.reduce((sum, a) => sum + a.total_elevation_gain, 0);

    // Longest run
    const longest = runs.reduce((prev, curr) => curr.distance > prev.distance ? curr : prev, runs[0]);

    // Fastest run (best average pace) - require minimum distance 1 km to avoid short sprint artifacts
    const runsForFastest = runs.filter(r => r.distance >= 1000);
    let fastestRun = { pace: 0, time: 0, distance: 0, date: '', id: 0 };
    if (runsForFastest.length > 0) {
        let bestPace = Infinity;
        let best = runsForFastest[0];
        runsForFastest.forEach(r => {
            const pace = r.moving_time / (r.distance / 1000);
            if (pace < bestPace) {
                bestPace = pace;
                best = r;
            }
        });
        fastestRun = {
            pace: Math.round(bestPace),
            time: best.moving_time,
            distance: Math.round(best.distance / 100) / 10,
            date: best.start_date_local,
            id: best.id
        };
    }

    // Weekly Streaks
    const { current: currentStreak, longest: longestStreak } = calculateWeeklyStreaks(runs);

    // Day of week distribution
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts = new Array(7).fill(0);
    runs.forEach(r => {
        const day = new Date(r.start_date_local).getDay();
        dayCounts[day]++;
    });
    const mostActiveDayIndex = dayCounts.indexOf(Math.max(...dayCounts));
    const mostActiveDay = days[mostActiveDayIndex];

    const dayOfWeekDistribution = days.map((day, i) => ({
        day,
        count: dayCounts[i]
    }));

    // Monthly progress (last 12 months)
    const monthlyProgress: { month: string; distance: number; count: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(monthDate);
        const monthRuns = runs.filter(r => isWithinInterval(new Date(r.start_date_local), { start: mStart, end: mEnd }));

        monthlyProgress.push({
            month: format(monthDate, 'MMM yyyy'),
            distance: Math.round(monthRuns.reduce((sum, r) => sum + r.distance, 0) / 100) / 10,
            count: monthRuns.length
        });
    }

    const bestMonthObj = monthlyProgress.reduce((prev, curr) => curr.distance > prev.distance ? curr : prev, monthlyProgress[0]);

    // Weekly progress (configurable range)
    const weeklyProgress: StatsInsights['weeklyProgress'] = [];

    let iterations = weeklyWeeks;
    if (weeklyWeeks === -1) {
        // Calculate all weeks from earliest activity
        const earliestRun = runs.reduce((prev, curr) =>
            new Date(curr.start_date_local) < new Date(prev.start_date_local) ? curr : prev,
            runs[runs.length - 1]
        );
        const earliestDate = startOfWeek(new Date(earliestRun.start_date_local), { weekStartsOn: 1 });
        const weeksDiff = Math.ceil((now.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        iterations = Math.max(1, weeksDiff + 1);
    }

    for (let i = iterations - 1; i >= 0; i--) {
        const weekDate = new Date(now);
        weekDate.setDate(now.getDate() - (i * 7));
        const wStart = startOfWeek(weekDate, { weekStartsOn: 1 });
        const wEnd = new Date(wStart);
        wEnd.setDate(wStart.getDate() + 6);
        wEnd.setHours(23, 59, 59, 999);

        const weekRuns = runs.filter(r => isWithinInterval(new Date(r.start_date_local), { start: wStart, end: wEnd }));
        const distance = Math.round(weekRuns.reduce((sum, r) => sum + r.distance, 0) / 100) / 10;

        let percentChange: number | null = null;
        if (weeklyProgress.length > 0) {
            const prevDistance = weeklyProgress[weeklyProgress.length - 1].distance;
            if (prevDistance > 0) {
                percentChange = Math.round(((distance - prevDistance) / prevDistance) * 100);
            } else if (distance > 0) {
                percentChange = 100; // From 0 to something
            }
        }

        weeklyProgress.push({
            week: format(wStart, 'MMM d'),
            distance,
            count: weekRuns.length,
            percentChange
        });
    }

    // PRs
    const prs: StatsInsights['prs'] = {};

    const distances = [
        { name: '1k', target: 1000, tolerance: 100 },
        { name: '5k', target: 5000, tolerance: 300 },
        { name: '10k', target: 10000, tolerance: 500 },
        { name: 'halfMarathon', target: 21097, tolerance: 1000 },
        { name: 'marathon', target: 42195, tolerance: 2000 },
    ] as const;

    distances.forEach(d => {
        // Consider any run with at least the target distance and estimate the best time
        // for the requested target (e.g., best 1k split approximated from longer runs)
        const qualifying = runs.filter(r => r.distance >= d.target);
        if (qualifying.length > 0) {
            let bestTimeForTarget = Number.MAX_SAFE_INTEGER;
            let bestRun = qualifying[0];

            qualifying.forEach(r => {
                // Estimate time for the target distance by scaling moving_time proportionally
                // This is an approximation when split-level data isn't available
                const estimatedTime = Math.round(r.moving_time * (d.target / r.distance));
                if (estimatedTime < bestTimeForTarget) {
                    bestTimeForTarget = estimatedTime;
                    bestRun = r;
                }
            });

            prs[d.name] = {
                distance: d.name,
                time: bestTimeForTarget,
                pace: bestTimeForTarget / (d.target / 1000),
                date: bestRun.start_date_local,
                activityId: bestRun.id
            };
        }
    });

    return {
        totalDistance: Math.round(totalDistance / 100) / 10,
        totalTime,
        totalElevation: Math.round(totalElevation),
        runCount: runs.length,
        avgDistance: Math.round((totalDistance / runs.length) / 100) / 10,
        avgPace: totalTime / (totalDistance / 1000),
        longestRun: {
            distance: Math.round(longest.distance / 100) / 10,
            date: longest.start_date_local,
            id: longest.id
        },
        fastestRun,
        currentStreak,
        longestStreak,
        bestMonth: {
            month: bestMonthObj.month,
            distance: bestMonthObj.distance
        },
        mostActiveDay,
        prs,
        monthlyProgress,
        weeklyProgress,
        dayOfWeekDistribution,
        kudos,
        gear
    };
}

function calculateWeeklyStreaks(runs: StravaActivity[]): { current: number; longest: number } {
    if (runs.length === 0) return { current: 0, longest: 0 };

    // Get unique start of weeks (Monday) for all runs
    const weekStarts = Array.from(new Set(
        runs.map(r => format(startOfWeek(new Date(r.start_date_local), { weekStartsOn: 1 }), 'yyyy-MM-dd'))
    )).sort().reverse(); // Newest first

    if (weekStarts.length === 0) return { current: 0, longest: 0 };

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const currentWeekStr = format(currentWeekStart, 'yyyy-MM-dd');

    const lastWeekStart = subMonths(currentWeekStart, 0); // Need to subtract 1 week
    lastWeekStart.setDate(currentWeekStart.getDate() - 7);
    const lastWeekStr = format(lastWeekStart, 'yyyy-MM-dd');

    // Current Streak calculation
    // If user ran this week or last week, the streak can continue
    const hasRunThisWeek = weekStarts.includes(currentWeekStr);
    const hasRunLastWeek = weekStarts.includes(lastWeekStr);

    if (hasRunThisWeek || hasRunLastWeek) {
        let checkWeek = hasRunThisWeek ? currentWeekStart : lastWeekStart;
        while (true) {
            const checkWeekStr = format(checkWeek, 'yyyy-MM-dd');
            if (weekStarts.includes(checkWeekStr)) {
                currentStreak++;
                checkWeek = new Date(checkWeek);
                checkWeek.setDate(checkWeek.getDate() - 7);
            } else {
                break;
            }
        }
    }

    // Longest Streak calculation
    const ascendingWeeks = [...weekStarts].reverse().map(w => new Date(w));
    if (ascendingWeeks.length > 0) {
        tempStreak = 1;
        longestStreak = 1;
        for (let j = 1; j < ascendingWeeks.length; j++) {
            const prev = ascendingWeeks[j - 1];
            const curr = ascendingWeeks[j];
            // Difference in days between week starts should be exactly 7
            const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 7) {
                tempStreak++;
                longestStreak = Math.max(longestStreak, tempStreak);
            } else {
                tempStreak = 1;
            }
        }
    }

    return { current: currentStreak, longest: longestStreak };
}
