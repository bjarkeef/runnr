'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/context/UserContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import WeeklyDistance from '@/components/stats/WeeklyDistance';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { formatTime, formatDistance } from '@/lib/utils';
import type { StatsInsights, PersonalRecord } from '@/lib/stats';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';

export default function StatsPage() {
  const { user } = useUser();
  const [stats, setStats] = useState<StatsInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const fetchStats = async () => {
        try {
          setLoading(true);
          const response = await fetch(`/api/stats`);
          if (!response.ok) throw new Error('Failed to fetch stats');
          const data = await response.json();
          setStats(data.stats);
          setError(null);
        } catch {
          setError('Failed to fetch statistics.');
        } finally {
          setLoading(false);
        }
      };
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-8 text-center">
        <p className="text-muted-foreground">Please log in to see your stats.</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="container mx-auto p-8 text-center text-red-500">
        {error || 'Failed to load stats'}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold">📊 Training Stats</h1>
        <p className="text-muted-foreground text-sm">
          Comprehensive analytics of your {stats.runCount} runs
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Distance"
          value={`${stats.totalDistance} km`}
          icon="🏃‍♂️"
          description="Lifetime distance (km)"
        />
        <StatCard
          title="Total Time"
          value={formatTime(stats.totalTime)}
          icon="⏱️"
          description={`${Math.round(stats.totalTime / 3600)} hours spent running`}
        />
        <StatCard
          title="Total Elevation"
          value={`${stats.totalElevation.toLocaleString()} m`}
          icon="⛰️"
          description="Total vertical gain"
        />
        <StatCard
          title="Avg Pace"
          value={`${formatPace(stats.avgPace)}/km`}
          icon="⚡"
          description={`Avg speed: ${(3600 / stats.avgPace).toFixed(1)} km/h`}
        />
      </div>

      {/* Main Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Distance spans all columns */}
        <div className="lg:col-span-3 space-y-6">
          <WeeklyDistance initialData={stats.weeklyProgress} initialRange={'6m'} />
        </div>

        {/* Left Column - Monthly Progress & Distribution */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Activity by Day</CardTitle>
                <CardDescription>Which days you run most</CardDescription>
              </CardHeader>
              <CardContent className="h-48 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.dayOfWeekDistribution} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="day"
                      type="category"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={70}
                    />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {stats.dayOfWeekDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.day === stats.mostActiveDay ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Consistency</CardTitle>
                <CardDescription>Your weekly running habits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-3xl font-bold">{stats.currentStreak}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Weekly Streak</p>
                  </div>
                  <div className="text-3xl">🔥</div>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-3xl font-bold">{stats.longestStreak}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Longest (Weeks)</p>
                  </div>
                  <div className="text-3xl">🏆</div>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-lg font-semibold">{stats.bestMonth.month}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Busiest Month ({stats.bestMonth.distance} km)</p>
                  </div>
                  <div className="text-2xl">📅</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stats.kudos && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Kudos Analytics</CardTitle>
                  <CardDescription>Social engagement on Strava</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-2xl font-bold">{stats.kudos.total}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Total Kudos</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.kudos.avg}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Avg / Run</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.kudos.max}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Max Kudos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {stats.gear && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Gear Overview</CardTitle>
                  <CardDescription>{stats.gear.activeGear} active pairs</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-3">
                    {stats.gear.shoes.filter(s => !s.retired).slice(0, 3).map((shoe, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-base">👟</span>
                          <span className={`${shoe.primary ? 'font-bold' : ''}`}>{shoe.name}</span>
                          {shoe.primary && <Badge variant="outline" className="text-[9px] h-4 py-0">Primary</Badge>}
                        </div>
                        <span className="font-mono text-muted-foreground">{shoe.distance} km</span>
                      </div>
                    ))}
                    {stats.gear.shoes.length > 3 && (
                      <p className="text-[10px] text-center text-muted-foreground pt-1">Explore all gear in the Gear tab</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Column - PRs & Bests (moved down) */}
        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🏅</span>
                Personal Records
              </CardTitle>
              <CardDescription>Your best estimated times</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PRItem label="1 km" pr={stats.prs['1k']} />
              <PRItem label="5K" pr={stats.prs['5k']} />
              <PRItem label="10K" pr={stats.prs['10k']} />
              <PRItem label="Half Marathon" pr={stats.prs.halfMarathon} />
              <PRItem label="Marathon" pr={stats.prs.marathon} />

              <div className="mt-8 pt-4 border-t space-y-3">
                <div className="p-3 bg-muted/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🏃</div>
                    <div>
                      <p className="text-sm font-semibold">Longest Run</p>
                      <p className="text-lg font-bold">{stats.longestRun.distance} km</p>
                      <p className="text-xs text-muted-foreground">Set on {new Date(stats.longestRun.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">⚡</div>
                    <div>
                      <p className="text-sm font-semibold">Fastest Run</p>
                      {stats.fastestRun && stats.fastestRun.time > 0 ? (
                        <>
                          <p className="text-lg font-bold">{formatPace(stats.fastestRun.pace)}</p>
                          <p className="text-xs text-muted-foreground">{stats.fastestRun.distance} km • {new Date(stats.fastestRun.date).toLocaleDateString()}</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not set yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>


    </div>
  );
}

function StatCard({ title, value, icon, description }: { title: string; value: string; icon: string; description: string }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex justify-between items-start mb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <span className="text-xl">{icon}</span>
        </div>
        <p className="text-xl sm:text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function PRItem({ label, pr }: { label: string; pr?: PersonalRecord }) {
  if (!pr) return (
    <div className="flex justify-between items-center py-2 opacity-50">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs">Not set yet</span>
    </div>
  );

  return (
    <div className="flex justify-between items-center py-2 group">
      <div>
        <span className="text-sm font-medium group-hover:text-primary transition-colors">{label}</span>
        <p className="text-[10px] text-muted-foreground">{new Date(pr.date).toLocaleDateString()}</p>
      </div>
      <div className="text-right">
        <span className="text-sm font-bold font-mono">{formatTime(pr.time)}</span>
        <p className="text-[10px] text-muted-foreground">{formatPace(pr.pace)}/km</p>
      </div>
    </div>
  );
}

function formatPace(paceSeconds: number): string {
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
