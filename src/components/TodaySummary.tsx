'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTime } from '@/lib/utils';
import Link from 'next/link';

interface SummaryData {
    latestRun: {
        name: string;
        distance: number;
        time: number;
        date: string;
        formattedDate: string;
    } | null;
    weekProgress: {
        distance: number;
        count: number;
        lastWeekDistance: number;
        percentChange: number | null;
    };
    nextRace: {
        name: string;
        date: string;
        daysUntil: number;
    } | null;
}

export function TodaySummary() {
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSummary() {
            try {
                const response = await fetch('/api/today-summary');
                if (response.ok) {
                    const summaryData = await response.json();
                    setData(summaryData);
                }
            } catch (error) {
                console.error('Failed to fetch summary:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchSummary();
    }, []);

    if (loading) {
        return <Skeleton className="h-40 w-full rounded-xl" />;
    }

    if (!data) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Latest Run */}
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium text-primary">Latest Run</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                    {data.latestRun ? (
                        <Link href="/runs" className="group">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-bold">{data.latestRun.distance} km</p>
                                    <p className="text-xs text-muted-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                        {data.latestRun.name}
                                    </p>
                                </div>
                                <p className="text-xs text-muted-foreground mb-1">{data.latestRun.formattedDate}</p>
                            </div>
                        </Link>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No runs recorded yet</p>
                    )}
                </CardContent>
            </Card>

            {/* Week Progress */}
            <Card className="border-muted">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">This Week</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-2xl font-bold">{data.weekProgress.distance} km</p>
                            <p className="text-xs text-muted-foreground">
                                {data.weekProgress.count} {data.weekProgress.count === 1 ? 'run' : 'runs'} completed
                            </p>
                        </div>
                        {data.weekProgress.percentChange !== null && (
                            <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${data.weekProgress.percentChange >= 0
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : 'bg-amber-500/10 text-amber-600'
                                }`}>
                                {data.weekProgress.percentChange >= 0 ? '+' : ''}{data.weekProgress.percentChange}%
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Goal/Next Race */}
            <Card className="border-muted">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Coming Up</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                    {data.nextRace ? (
                        <Link href="/race-predictions" className="group">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-bold">{data.nextRace.daysUntil} days</p>
                                    <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                                        Until your {data.nextRace.name}
                                    </p>
                                </div>
                                <span className="text-xl">🏁</span>
                            </div>
                        </Link>
                    ) : (
                        <Link href="/race-predictions" className="group">
                            <p className="text-sm text-muted-foreground italic group-hover:text-primary transition-colors">
                                Set a race goal to track progress
                            </p>
                        </Link>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
