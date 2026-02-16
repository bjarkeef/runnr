'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { formatTime, formatDistance, formatPace } from '@/lib/utils';

const RunMap = dynamic(() => import('@/components/RunMap'), {
    ssr: false,
    loading: () => <Skeleton className="h-96 w-full" />,
});

interface Activity {
    id: number;
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    total_elevation_gain: number;
    start_date_local: string;
    average_speed: number;
    max_speed: number;
    average_heartrate?: number;
    max_heartrate?: number;
    kudos_count: number;
    comment_count: number;
    description?: string;
    calories: number;
    gear?: {
        id: string;
        name: string;
        primary: boolean;
        distance: number;
        brand_name?: string;
        model_name?: string;
        description?: string;
    };
    map: {
        polyline: string;
    };
    laps: {
        id?: number;
        distance: number;
        elapsed_time: number;
        split: number;
        total_elevation_gain?: number;
    }[];
    splits_standard?: {
        distance: number;
        elapsed_time: number;
        elevation_difference: number;
        moving_time: number;
        split: number;
        average_speed: number;
        pace_zone: number;
    }[];
    splits_metric?: {
        distance: number;
        elapsed_time: number;
        elevation_difference: number;
        moving_time: number;
        split: number;
        average_speed: number;
        pace_zone: number;
    }[];
}

export default function RunDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const [activity, setActivity] = useState<Activity | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        const fetchActivity = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/run?id=${id}`);
                if (!response.ok) throw new Error('Failed to fetch');
                const data = await response.json();
                setActivity(data);
            } catch {
                setError('Failed to load run details. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchActivity();
    }, [id]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-1/2" />
                <Skeleton className="h-8 w-1/4" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (error) {
        return <div className="text-center text-red-500">{error}</div>;
    }

    if (!activity) {
        return <div className="text-center">Run not found.</div>;
    }

    return (
        <div className="container mx-auto max-w-6xl space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6">
            {/* Back Button */}
            <Button variant="ghost" asChild className="mb-2 sm:mb-4 -ml-2">
                <Link href="/runs" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-sm sm:text-base">Back to Runs</span>
                </Link>
            </Button>

            <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight">{activity.name}</h1>
                <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                    {format(new Date(activity.start_date_local), 'MMM d, yyyy @ h:mm a')}
                </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard title="Distance" value={formatDistance(activity.distance)} />
                <StatCard title="Moving Time" value={formatTime(activity.moving_time)} />
                <StatCard title="Pace" value={formatPace(activity.average_speed)} />
                <StatCard title="Elevation Gain" value={`${activity.total_elevation_gain.toFixed(0)} m`} />
                <StatCard title="Elapsed Time" value={formatTime(activity.elapsed_time)} />
                <StatCard title="Calories" value={`${activity.calories.toFixed(0)}`} />
                {activity.average_heartrate && <StatCard title="Avg Heart Rate" value={`${activity.average_heartrate.toFixed(0)} bpm`} />}
                {activity.max_heartrate && <StatCard title="Max Heart Rate" value={`${activity.max_heartrate.toFixed(0)} bpm`} />}
            </div>

            {/* Social Stats - Kudos & Comments */}
            {(activity.kudos_count > 0 || activity.comment_count > 0) && (
                <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
                    {activity.kudos_count > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">👏</span>
                            <div>
                                <p className="text-lg font-semibold">{activity.kudos_count}</p>
                                <p className="text-xs text-muted-foreground">Kudo{activity.kudos_count !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    )}
                    {activity.comment_count > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">💬</span>
                            <div>
                                <p className="text-lg font-semibold">{activity.comment_count}</p>
                                <p className="text-xs text-muted-foreground">Comment{activity.comment_count !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activity.map.polyline && <RunMap polyline={activity.map.polyline} />}

            {/* Gear Information */}
            {activity.gear && (
                <Card className="border-l-4 border-l-primary">
                    <CardHeader className="pb-2 sm:pb-3">
                        <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                <span className="text-xl sm:text-2xl">👟</span>
                                <span className="hidden sm:inline">Running Shoes</span>
                                <span className="sm:hidden">Shoes</span>
                            </CardTitle>
                            {activity.gear.primary && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 sm:py-1 rounded-full font-medium whitespace-nowrap">
                                    Primary
                                </span>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <p className="text-base sm:text-lg font-semibold">{activity.gear.name}</p>
                            {(activity.gear.brand_name || activity.gear.model_name) && (
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    {activity.gear.brand_name} {activity.gear.model_name}
                                </p>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 sm:p-2 bg-muted rounded-lg flex-shrink-0">
                                    <span className="text-xl sm:text-2xl">📏</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">Total Distance</p>
                                    <p className="text-sm sm:text-base font-semibold truncate">
                                        {(activity.gear.distance / 1000).toFixed(0)} km
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className="p-1.5 sm:p-2 bg-muted rounded-lg flex-shrink-0">
                                    <span className="text-xl sm:text-2xl">⚠️</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">Shoe Health</p>
                                    <p className="text-sm sm:text-base font-semibold truncate">
                                        {activity.gear.distance > 800000 ? (
                                            <span className="text-red-500">Replace Soon</span>
                                        ) : activity.gear.distance > 600000 ? (
                                            <span className="text-orange-500">Monitor</span>
                                        ) : (
                                            <span className="text-green-500">Good</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {activity.gear.description && (
                            <div className="pt-2 border-t">
                                <p className="text-xs sm:text-sm text-muted-foreground italic">
                                    {activity.gear.description}
                                </p>
                            </div>
                        )}
                        
                        <div className="pt-2 text-xs text-muted-foreground">
                            💡 Tip: Shoes last 800-1000 km
                        </div>
                    </CardContent>
                </Card>
            )}

            {activity.description && (
                <Card>
                    <CardHeader><CardTitle>Description</CardTitle></CardHeader>
                    <CardContent>
                        <p>{activity.description}</p>
                    </CardContent>
                </Card>
            )}

            {(activity.splits_metric || activity.splits_standard) && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">Splits</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            {activity.splits_metric ? '1km intervals' : '1km intervals'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-muted-foreground">
                            {(activity.splits_metric || activity.splits_standard || []).length} splits •
                            {formatDistance(activity.distance)}
                        </div>
                        <div className="overflow-x-auto -mx-3 sm:mx-0">
                            <div className="min-w-[600px] px-3 sm:px-0">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="p-1.5 sm:p-2 font-semibold">#</th>
                                        <th className="p-1.5 sm:p-2 font-semibold">Dist</th>
                                        <th className="p-1.5 sm:p-2 font-semibold">Time</th>
                                        <th className="p-1.5 sm:p-2 font-semibold">Pace</th>
                                        <th className="p-1.5 sm:p-2 font-semibold">Total</th>
                                        <th className="p-1.5 sm:p-2 font-semibold">Elev</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        let cumulativeTime = 0;
                                        let cumulativeDistance = 0;
                                        const milestones = [5000, 10000, 21097.5, 42195]; // 5K, 10K, Half, Full
                                        let nextMilestoneIndex = 0;
                                        const rows: React.ReactElement[] = [];
                                        
                                        (activity.splits_metric || activity.splits_standard || []).forEach((split, index: number) => {
                                            cumulativeTime += split.elapsed_time;
                                            const previousDistance = cumulativeDistance;
                                            cumulativeDistance += split.distance;
                                            
                                            // Check if we passed a milestone in this split
                                            while (nextMilestoneIndex < milestones.length && 
                                                   milestones[nextMilestoneIndex] >= previousDistance && 
                                                   milestones[nextMilestoneIndex] < cumulativeDistance) {
                                                const milestone = milestones[nextMilestoneIndex];
                                                const ratio = (milestone - previousDistance) / split.distance;
                                                const milestoneTime = cumulativeTime - split.elapsed_time + (split.elapsed_time * ratio);
                                                const milestoneName = milestone === 5000 ? '5K' : 
                                                                     milestone === 10000 ? '10K' :
                                                                     milestone === 21097.5 ? 'Half Marathon' : 'Marathon';
                                                
                                                rows.push(
                                                    <tr key={`milestone-${milestone}`} className="border-b bg-primary/10 font-semibold">
                                                        <td className="p-2">🏁</td>
                                                        <td className="p-2">{milestoneName}</td>
                                                        <td className="p-2">-</td>
                                                        <td className="p-2">-</td>
                                                        <td className="p-2 text-primary">{formatTime(Math.floor(milestoneTime))}</td>
                                                        <td className="p-2">-</td>
                                                    </tr>
                                                );
                                                nextMilestoneIndex++;
                                            }
                                            
                                            // Regular split row
                                            const displaySplit = activity.splits_metric ? split.split : Math.round(split.distance / 1000);
                                            const paceInMetersPerSecond = split.distance / split.elapsed_time;
                                            
                                            rows.push(
                                                <tr key={index} className="border-b hover:bg-muted/50">
                                                    <td className="p-2">{displaySplit}</td>
                                                    <td className="p-2">{formatDistance(split.distance)}</td>
                                                    <td className="p-2">{formatTime(split.elapsed_time)}</td>
                                                    <td className="p-2">{formatPace(paceInMetersPerSecond)}</td>
                                                    <td className="p-2 font-semibold">{formatTime(Math.floor(cumulativeTime))}</td>
                                                    <td className="p-2">{split.elevation_difference?.toFixed(0) || 0} m</td>
                                                </tr>
                                            );
                                        });
                                        
                                        return rows;
                                    })()}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}            {activity.laps && activity.laps.length > 1 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">Laps</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto -mx-3 sm:mx-0">
                            <div className="min-w-[500px] px-3 sm:px-0">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="p-1.5 sm:p-2 font-semibold">Lap</th>
                                        <th className="p-1.5 sm:p-2 font-semibold">Dist</th>
                                        <th className="p-1.5 sm:p-2 font-semibold">Time</th>
                                        <th className="p-1.5 sm:p-2 font-semibold">Pace</th>
                                        <th className="p-1.5 sm:p-2 font-semibold">Elev</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activity.laps.map((lap, index: number) => (
                                        <tr key={lap.id || index} className="border-b hover:bg-muted/50">
                                            <td className="p-1.5 sm:p-2">{index + 1}</td>
                                            <td className="p-1.5 sm:p-2">{formatDistance(lap.distance)}</td>
                                            <td className="p-1.5 sm:p-2">{formatTime(lap.elapsed_time)}</td>
                                            <td className="p-1.5 sm:p-2">{formatPace(lap.elapsed_time / lap.distance)}</td>
                                            <td className="p-1.5 sm:p-2">{lap.total_elevation_gain?.toFixed(0) || 0} m</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function StatCard({ title, value }: { title: string; value: string }) {
    return (
        <Card>
            <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">{title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <p className="text-lg sm:text-xl lg:text-2xl font-bold">{value}</p>
            </CardContent>
        </Card>
    );
}