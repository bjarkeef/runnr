'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatTime } from '@/lib/utils';

interface SettingsData {
    version: string;
    buildDate: string;
    environment: string;
    user: {
        id: string;
        stravaId: number;
        username: string;
        firstname: string;
        lastname: string;
        profile: string;
        memberSince: string;
        lastUpdated: string;
        lastSynced: string | null;
        stats: {
            totalActivities: number;
            totalRaceGoals: number;
            totalTrainingPlans: number;
        };
        activityStats: {
            totalDistance: number;
            totalTime: number;
            totalElevation: number;
            avgDistance: string;
            avgSpeed: string;
            longestRun: string;
            oldestActivity: string | null;
            newestActivity: string | null;
        };
        kudosStats: {
            totalKudos: number;
            avgKudos: string;
            maxKudos: number;
        };
        gearStats: {
            totalGear: number;
            activeGear: number;
            retiredGear: number;
            primaryGear: string | null;
            totalGearDistance: number;
            gear: Array<{
                name: string;
                distance: number;
                primary: boolean;
                retired: boolean;
            }>;
        };
    };
    database: {
        totalUsers: number;
        totalActivities: number;
        totalRaceGoals: number;
        totalTrainingPlans: number;
        totalGear: number;
        userPercentile: {
            activities: string;
        };
    };
    cache: {
        achievementsCacheTTL: string;
        racePredictionsCacheTTL: string;
    };
    system: {
        database: string;
        runtime: string;
        framework: string;
        ai: string;
    };
}

export default function SettingsPage() {
    const { user: contextUser, loading: userLoading } = useUser();
    const [data, setData] = useState<SettingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchSettings() {
            try {
                setLoading(true);
                const response = await fetch('/api/settings');
                if (!response.ok) {
                    throw new Error('Failed to fetch settings');
                }
                const settingsData = await response.json();
                setData(settingsData);
            } catch (err) {
                setError('Failed to load settings');
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        if (contextUser) {
            fetchSettings();
        } else if (!userLoading) {
            setLoading(false);
        }
    }, [contextUser, userLoading]);

    if (userLoading || loading) {
        return (
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-6 w-32" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-20 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (!contextUser) {
        return (
            <div className="container mx-auto p-8">
                <div className="text-center text-muted-foreground">Please log in to access settings.</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="container mx-auto p-8">
                <div className="text-center text-red-600">{error || 'Failed to load settings'}</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold">⚙️ Settings & Stats</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Your account, app info, and database statistics
                </p>
            </div>

            {/* User Profile Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={data.user.profile} alt={data.user.firstname} />
                            <AvatarFallback>{data.user.firstname[0]}{data.user.lastname[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="text-xl">{data.user.firstname} {data.user.lastname}</div>
                            <div className="text-sm text-muted-foreground font-normal">@{data.user.username}</div>
                        </div>
                    </CardTitle>
                    <CardDescription>
                        Member since {new Date(data.user.memberSince).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground">Strava ID</p>
                            <p className="text-sm font-mono">{data.user.stravaId}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">User ID</p>
                            <p className="text-xs font-mono truncate">{data.user.id}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Last Synced</p>
                            <p className="text-sm">
                                {data.user.lastSynced
                                    ? new Date(data.user.lastSynced).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                    : 'Never'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Last Updated</p>
                            <p className="text-sm">
                                {new Date(data.user.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>


            {/* Database Stats */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <span>🗄️ Database Statistics</span>
                        <Badge variant="outline" className="text-xs">Prisma Accelerate</Badge>
                    </CardTitle>
                    <CardDescription>
                        Platform-wide statistics from our database
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-2xl font-bold text-primary">{data.database.totalUsers}</p>
                            <p className="text-xs text-muted-foreground mt-1">Total Users</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-2xl font-bold text-green-600">{data.database.totalActivities.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground mt-1">Total Activities</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-2xl font-bold text-orange-600">{data.database.totalRaceGoals}</p>
                            <p className="text-xs text-muted-foreground mt-1">Race Goals</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-2xl font-bold text-purple-600">{data.database.totalTrainingPlans}</p>
                            <p className="text-xs text-muted-foreground mt-1">Training Plans</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">{data.database.totalGear}</p>
                            <p className="text-xs text-muted-foreground mt-1">Gear Items</p>
                        </div>
                    </div>
                    <Separator className="my-4" />
                    <div className="text-sm text-muted-foreground text-center">
                        You own <span className="font-bold text-primary">{data.database.userPercentile.activities}%</span> of all activities in the database 💪
                    </div>
                </CardContent>
            </Card>

            {/* System Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">💻 System Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 font-mono text-xs">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Framework</span>
                            <span className="font-bold">{data.system.framework}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Runtime</span>
                            <span className="font-bold">{data.system.runtime}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Database</span>
                            <span className="font-bold">{data.system.database}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">AI</span>
                            <span className="font-bold">{data.system.ai}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Version</span>
                            <Badge variant="default">{data.version}</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Build Date</span>
                            <span className="font-bold">{data.buildDate}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Environment</span>
                            <Badge variant={data.environment === 'production' ? 'default' : 'destructive'}>
                                {data.environment}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">⚡ Cache Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 font-mono text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Achievements</span>
                            <Badge variant="outline">{data.cache.achievementsCacheTTL}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Race Predictions</span>
                            <Badge variant="outline">{data.cache.racePredictionsCacheTTL}</Badge>
                        </div>
                        <Separator className="my-2" />
                        <p className="text-xs text-muted-foreground mt-2">
                            Intelligent caching reduces API calls and speeds up your experience 🚀
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Footer Note */}
            <Card className="bg-muted/50">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                        <div className="inline-flex items-center gap-3 bg-muted/40 px-3 py-1 rounded-full backdrop-blur-sm border border-border">
                            <span className="w-3 h-3 flex items-center justify-center rounded-full bg-pink-500 text-white transform-gpu transition-transform duration-300 hover:scale-110">♥</span>
                            <span className="text-xs">Made by <a href="https://www.strava.com/athletes/157697609" target="_blank" rel="noopener noreferrer" className="underline">BEF</a></span>
                        </div>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-xs">v{data.version}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
