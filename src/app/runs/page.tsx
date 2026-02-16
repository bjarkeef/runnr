'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/context/UserContext';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { formatTime, formatDistance } from '@/lib/utils';

interface Activity {
    id: number;
    name: string;
    distance: number;
    moving_time: number;
    start_date_local: string;
    type?: string; // 'Run', 'Race', etc.
    kudos_count?: number;
}

const isRace = (activity: Activity): boolean => {
    if (activity.type === 'Race') return true;
    // Also check activity name for common race indicators
    const raceKeywords = ['race', '5k', '10k', 'half marathon', 'marathon', 'trail race', 'parkrun', 'championship'];
    return raceKeywords.some(keyword => activity.name.toLowerCase().includes(keyword));
};

interface WeekGroup {
    weekStart: Date;
    weekEnd: Date;
    runs: Activity[];
    totalDistance: number;
    totalTime: number;
    weekLabel: string;
    trend?: {
        kmChange: number;
        percentChange: number;
        direction: 'up' | 'down' | 'flat';
    };
}

export default function RunsPage() {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [needsSync, setNeedsSync] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalRuns, setTotalRuns] = useState(0);

    // Group activities by week
    const groupByWeek = (acts: Activity[]): WeekGroup[] => {
        const groups = new Map<string, WeekGroup>();
        
        acts.forEach(activity => {
            const activityDate = new Date(activity.start_date_local);
            const weekStart = startOfWeek(activityDate, { weekStartsOn: 1 }); // Monday
            const weekEnd = endOfWeek(activityDate, { weekStartsOn: 1 });
            const weekKey = weekStart.toISOString();
            
            if (!groups.has(weekKey)) {
                const now = new Date();
                const isCurrentWeek = isWithinInterval(now, { start: weekStart, end: weekEnd });
                const weekLabel = isCurrentWeek 
                    ? 'This Week' 
                    : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
                
                groups.set(weekKey, {
                    weekStart,
                    weekEnd,
                    runs: [],
                    totalDistance: 0,
                    totalTime: 0,
                    weekLabel
                });
            }
            
            const group = groups.get(weekKey)!;
            group.runs.push(activity);
            group.totalDistance += activity.distance;
            group.totalTime += activity.moving_time;
        });
        
        // Calculate week-over-week trends for progress tracking
        const sortedWeeks = Array.from(groups.values()).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
        
        sortedWeeks.forEach((week, index) => {
            if (index < sortedWeeks.length - 1) {
                const previousWeek = sortedWeeks[index + 1];
                const currentKm = week.totalDistance / 1000;
                const previousKm = previousWeek.totalDistance / 1000;
                const kmChange = currentKm - previousKm;
                const percentChange = previousKm > 0 ? (kmChange / previousKm) * 100 : 0;
                
                week.trend = {
                    kmChange: parseFloat(kmChange.toFixed(2)),
                    percentChange: parseFloat(percentChange.toFixed(1)),
                    direction: kmChange > 0.5 ? 'up' : kmChange < -0.5 ? 'down' : 'flat'
                };
            }
        });
        
        return sortedWeeks;
    };

    const fetchActivities = async (pageNum = 1, append = false) => {
        try {
            if (append) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }
            setError(null);
            const response = await fetch(`/api/runs?page=${pageNum}&limit=24`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                },
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch');
            }
            
            const data = await response.json();
            
            // Check if data has activities array (new format) or is direct array (old format)
            const activitiesList = data.activities || data;
            setNeedsSync(data.needsSync || false);
            
            // Handle pagination data
            if (data.pagination) {
                setHasMore(data.pagination.hasMore);
                setTotalRuns(data.pagination.total);
                setPage(data.pagination.page);
            }
            
            // Append or replace activities
            if (append) {
                const combined = [...activities, ...activitiesList];
                setActivities(combined);
                setWeekGroups(groupByWeek(combined));
            } else {
                setActivities(activitiesList);
                setWeekGroups(groupByWeek(activitiesList));
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load runs';
            setError(errorMessage);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const syncRuns = async () => {
        try {
            setSyncing(true);
            const response = await fetch('/api/sync-runs', {
                method: 'POST',
            });
            if (!response.ok) throw new Error('Sync failed');
            
            // Refresh activities after sync - reset to page 1
            setPage(1);
            await fetchActivities(1, false);
        } catch {
            setError('Failed to sync runs from Strava');
        } finally {
            setSyncing(false);
        }
    };
    
    const loadMore = async () => {
        const nextPage = page + 1;
        await fetchActivities(nextPage, true);
    };

    const { lastSyncedAt } = useUser();

    useEffect(() => {
        fetchActivities(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Refresh runs list when an automatic or manual sync updates lastSyncedAt
    useEffect(() => {
        if (lastSyncedAt) {
            setPage(1);
            fetchActivities(1, false);
        }
    }, [lastSyncedAt]);

    if (loading) {
        return (
            <div className="container mx-auto max-w-6xl">
                {/* Header Skeleton */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Skeleton className="h-7 w-32" />
                        <Skeleton className="h-4 w-40 mt-2" />
                    </div>
                    <Skeleton className="h-9 w-24" />
                </div>
                
                {/* Week Groups Skeleton */}
                <div className="space-y-8">
                    {[...Array(2)].map((_, weekIndex) => (
                        <div key={weekIndex} className="space-y-4">
                            {/* Week Header Skeleton */}
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-6 w-28" />
                                        <Skeleton className="h-6 w-24 rounded-full" />
                                    </div>
                                    <div className="flex gap-4 mt-2">
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-4 w-20" />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Run Cards Grid Skeleton */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                                {[...Array(weekIndex === 0 ? 3 : 2)].map((_, i) => (
                                    <Card key={i}>
                                        <CardHeader className="pb-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <Skeleton className="h-5 w-3/4" />
                                            </div>
                                            <Skeleton className="h-4 w-32 mt-1" />
                                        </CardHeader>
                                        <CardContent className="pt-0 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Skeleton className="h-3 w-14 mb-1" />
                                                    <Skeleton className="h-5 w-16" />
                                                </div>
                                                <div>
                                                    <Skeleton className="h-3 w-10 mb-1" />
                                                    <Skeleton className="h-5 w-14" />
                                                </div>
                                            </div>
                                            <div className="pt-3 border-t">
                                                <div className="flex justify-between">
                                                    <Skeleton className="h-3 w-16" />
                                                    <Skeleton className="h-3 w-14" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return <div className="text-center text-red-500">{error}</div>;
    }

    if (activities.length === 0) {
        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">My Runs</h1>
                    <Button 
                        onClick={syncRuns} 
                        disabled={syncing}
                        variant="outline"
                        size="sm"
                    >
                        {syncing ? 'Syncing...' : 'Sync from Strava'}
                    </Button>
                </div>
                <div className="text-center">You have no runs to display. Click &quot;Sync from Strava&quot; to load your activities.</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-6xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold">🏃‍♂️ My Runs</h1>
                    {totalRuns > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                            Showing {activities.length} of {totalRuns} runs
                        </p>
                    )}
                </div>
                <Button 
                    onClick={syncRuns} 
                    disabled={syncing}
                    variant={needsSync ? "default" : "outline"}
                    size="sm"
                >
                    {syncing ? 'Syncing...' : needsSync ? '🔄 Sync New Runs' : '🔄 Sync'}
                </Button>
            </div>
            <div className="space-y-8">
                {weekGroups.map((week, weekIndex) => (
                    <div key={weekIndex} className="space-y-4">
                        {/* Week Header */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-semibold">{week.weekLabel}</h2>
                                    {/* 🔥 TREND INDICATOR - Week-over-week progress tracking */}
                                    {week.trend && (
                                        <div className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                                            week.trend.direction === 'up' 
                                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                                                : week.trend.direction === 'down'
                                                ? 'bg-red-500/20 text-red-700 dark:text-red-400'
                                                : 'bg-slate-500/20 text-slate-700 dark:text-slate-400'
                                        }`}>
                                            <span>
                                                {week.trend.direction === 'up' ? '📈' : week.trend.direction === 'down' ? '📉' : '➡️'}
                                            </span>
                                            <span>
                                                {week.trend.direction === 'up' ? '+' : ''}{week.trend.kmChange}km ({week.trend.percentChange > 0 ? '+' : ''}{week.trend.percentChange}%)
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-6 text-sm text-muted-foreground mt-1">
                                    <span>{week.runs.length} run{week.runs.length !== 1 ? 's' : ''}</span>
                                    {week.runs.some(run => isRace(run)) && (
                                        <span>• 🏆 {week.runs.filter(run => isRace(run)).length} race{week.runs.filter(run => isRace(run)).length !== 1 ? 's' : ''}</span>
                                    )}
                                    <span>• {formatDistance(week.totalDistance)} total</span>
                                    <span>• {formatTime(week.totalTime)} time</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Week Runs Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                            {week.runs.map(activity => (
                                <Link href={`/run/${activity.id}`} key={activity.id} className="block group">
                                    <Card className={`h-full transition-all duration-300 group-hover:border-primary group-hover:shadow-lg ${isRace(activity) ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}>
                                        <CardHeader className="pb-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <CardTitle className="truncate text-base sm:text-lg flex-1">{activity.name}</CardTitle>
                                                {/* Race badge indicator */}
                                                {isRace(activity) && (
                                                    <div className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs font-semibold border border-yellow-500/30">
                                                        <span>🏆</span>
                                                        <span>RACE</span>
                                                    </div>
                                                )}
                                            </div>
                                            <CardDescription className="text-xs sm:text-sm">
                                                {format(new Date(activity.start_date_local), 'EEEE, MMM d')}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-0 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-1">Distance</p>
                                                    <p className="font-semibold text-sm sm:text-base">{formatDistance(activity.distance)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-1">Time</p>
                                                    <p className="font-semibold text-sm sm:text-base">{formatTime(activity.moving_time)}</p>
                                                </div>
                                            </div>
                                            <div className="pt-3 border-t">
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>Avg Pace</span>
                                                    <span>{Math.floor((activity.moving_time / 60) / (activity.distance / 1000))}:{Math.round(((activity.moving_time / 60) / (activity.distance / 1000) % 1) * 60).toString().padStart(2, '0')}/km</span>
                                                </div>
                                                {activity.kudos_count !== undefined && activity.kudos_count > 0 && (
                                                    <div className="flex items-center gap-1 mt-2 text-xs text-orange-500">
                                                        <span>👏</span>
                                                        <span>{activity.kudos_count} kudo{activity.kudos_count !== 1 ? 's' : ''}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Load More Button */}
            {hasMore && !loading && (
                <div className="flex justify-center mt-8">
                    <Button 
                        onClick={loadMore} 
                        disabled={loadingMore}
                        variant="outline"
                        size="lg"
                        className="min-w-[200px]"
                    >
                        {loadingMore ? (
                            <>
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                                Loading...
                            </>
                        ) : (
                            `Load More Runs (${totalRuns - activities.length} remaining)`
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
