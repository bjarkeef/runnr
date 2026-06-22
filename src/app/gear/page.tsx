'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BookOpen } from 'lucide-react';

interface LifePathSeg {
  id: string;
  label: string;
  distanceM: number;
  dominantPace: string;
  dominantTerrain: string;
  dominantWeather: string;
}

interface NarrativeSummary {
  nickname: string;
  tagline: string;
  topTrait: string | null;
  runCount: number;
  archetypeKey: string;
  nicknameKey: string;
  lifePathPreview?: LifePathSeg[];
}

interface Shoe {
  id: string;
  name: string;
  brand_name?: string;
  model_name?: string;
  description?: string;
  distance: number;
  primary: boolean;
  retired: boolean;
  narrativeSummary?: NarrativeSummary;
}

const SHOE_WARNING_KM = 600;
const SHOE_DANGER_KM = 800;
const SHOE_MAX_KM = 1000;

function getShoeHealth(distanceMeters: number): {
  status: 'good' | 'warning' | 'danger' | 'replace';
  percentage: number;
  color: string;
  message: string;
} {
  const km = distanceMeters / 1000;
  const percentage = Math.min((km / SHOE_MAX_KM) * 100, 100);

  if (km >= SHOE_DANGER_KM) {
    return { status: 'replace', percentage, color: 'bg-red-500', message: 'Time to replace!' };
  } else if (km >= SHOE_WARNING_KM) {
    return { status: 'danger', percentage, color: 'bg-orange-500', message: 'Monitor closely' };
  } else if (km >= SHOE_WARNING_KM * 0.75) {
    return { status: 'warning', percentage, color: 'bg-yellow-500', message: 'Getting worn' };
  }
  return { status: 'good', percentage, color: 'bg-green-500', message: 'Good condition' };
}

const paceColor: Record<string, string> = {
  easy: 'bg-sky-400/80',
  steady: 'bg-emerald-500/80',
  tempo: 'bg-amber-500/80',
  race: 'bg-rose-500/80',
};

function MiniLifePath({ segments }: { segments?: LifePathSeg[] }) {
  if (!segments?.length) return null;
  return (
    <div className="flex h-2 w-full gap-0.5 rounded-full overflow-hidden" aria-hidden>
      {segments.map((s) => (
        <div
          key={s.id}
          className={`flex-1 min-w-[4px] ${paceColor[s.dominantPace] ?? 'bg-muted-foreground/40'}`}
          title={s.label}
        />
      ))}
    </div>
  );
}

export default function GearPage() {
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [betaEnabled, setBetaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  const fetchGear = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gear');
      if (!response.ok) throw new Error('Failed to fetch gear');
      const data = await response.json();
      setShoes(data.shoes || []);
      setBetaEnabled(Boolean(data.gearNarrativeBeta));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gear');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGear();
  }, []);

  const handleRebuild = async () => {
    try {
      setRebuilding(true);
      await fetch('/api/gear/rebuild', { method: 'POST' });
      await fetchGear();
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl p-4">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-4xl p-4">
        <div className="text-center text-red-500">{error}</div>
      </div>
    );
  }

  const activeShoes = shoes.filter((s) => !s.retired);
  const retiredShoes = shoes.filter((s) => s.retired);
  const totalDistance = shoes.reduce((sum, s) => sum + s.distance, 0) / 1000;

  return (
    <div className="container mx-auto max-w-4xl p-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" asChild className="-ml-2">
          <Link href="/runs" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Runs</span>
          </Link>
        </Button>
        {betaEnabled && (
          <Button variant="outline" size="sm" onClick={handleRebuild} disabled={rebuilding}>
            {rebuilding ? 'Rebuilding stories…' : 'Refresh stories'}
          </Button>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <span className="text-3xl">👟</span>
          My Running Shoes
        </h1>
        <p className="text-muted-foreground mt-1">
          {betaEnabled
            ? "Distance, lifespan, and each shoe's journey — open a story to go beyond the progress bar"
            : 'Track your shoe distance (km) and know when it is time to replace them'}
        </p>
      </div>

      {!betaEnabled && (
        <Card className="border-dashed border-amber-700/40 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1 text-sm">
              <p className="font-medium flex items-center gap-2">
                Gear Stories <Badge variant="secondary" className="text-xs">Beta</Badge>
              </p>
              <p className="text-muted-foreground">
                Shoe nicknames, life paths, weather, and memoir chapters are an opt-in beta. Enable them in Settings when you want to try it.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link href="/settings">Open Settings</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{activeShoes.length}</p>
            <p className="text-sm text-muted-foreground">Active Shoes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{retiredShoes.length}</p>
            <p className="text-sm text-muted-foreground">Retired</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{totalDistance.toFixed(0)}</p>
            <p className="text-sm text-muted-foreground">Total km</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">
              {
                activeShoes.filter((s) => {
                  const st = getShoeHealth(s.distance).status;
                  return st === 'replace' || st === 'danger';
                }).length
              }
            </p>
            <p className="text-sm text-muted-foreground">Need Attention</p>
          </CardContent>
        </Card>
      </div>

      {shoes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="text-4xl mb-4 block">👟</span>
            <p className="text-lg font-medium">No shoes found</p>
            <p className="text-muted-foreground mt-2">
              Add your running shoes in Strava and tag them on runs to build their story
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeShoes.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Active Shoes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeShoes.map((shoe) => {
                  const health = getShoeHealth(shoe.distance);
                  const km = shoe.distance / 1000;
                  const ns = betaEnabled ? shoe.narrativeSummary : undefined;
                  const cardInner = (
                      <Card
                        className={`relative overflow-hidden h-full ${
                          betaEnabled ? 'transition-shadow group-hover:shadow-md' : ''
                        } ${
                          health.status === 'replace'
                            ? 'border-red-500'
                            : health.status === 'danger'
                              ? 'border-orange-500'
                              : ''
                        }`}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {ns?.nickname && (
                                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
                                  {ns.nickname}
                                </p>
                              )}
                              <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                                {shoe.name}
                                {shoe.primary && (
                                  <Badge variant="secondary" className="text-xs">
                                    Primary
                                  </Badge>
                                )}
                              </CardTitle>
                              {(shoe.brand_name || shoe.model_name) && (
                                <CardDescription>
                                  {shoe.brand_name} {shoe.model_name}
                                </CardDescription>
                              )}
                              {ns?.tagline && (
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                  {ns.tagline}
                                </p>
                              )}
                            </div>
                            <div
                              className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${
                                health.status === 'good'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : health.status === 'warning'
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                    : health.status === 'danger'
                                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                              }`}
                            >
                              {health.message}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {betaEnabled && <MiniLifePath segments={ns?.lifePathPreview} />}
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-3xl font-bold">{km.toFixed(0)} km</p>
                              <p className="text-sm text-muted-foreground">
                                {(SHOE_MAX_KM - km).toFixed(0)} km remaining
                                {ns ? ` · ${ns.runCount} runs` : ''}
                              </p>
                            </div>
                            {betaEnabled && (
                              <span className="text-sm text-primary flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                <BookOpen className="h-4 w-4" />
                                Open story
                              </span>
                            )}
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${health.color}`}
                              style={{ width: `${Math.min(health.percentage, 100)}%` }}
                            />
                          </div>
                          {!betaEnabled && shoe.description && (
                            <p className="text-sm text-muted-foreground italic pt-2 border-t">
                              {shoe.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                  );

                  return betaEnabled ? (
                    <Link key={shoe.id} href={`/gear/${shoe.id}`} className="block group">
                      {cardInner}
                    </Link>
                  ) : (
                    <div key={shoe.id}>{cardInner}</div>
                  );
                })}
              </div>
            </div>
          )}

          {retiredShoes.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">Retired Shoes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {retiredShoes.map((shoe) => {
                  const retiredCard = (
                    <Card className={`h-full ${betaEnabled ? 'opacity-75 group-hover:opacity-100' : 'opacity-60'}`}>
                      <CardHeader className="pb-2">
                        {betaEnabled && shoe.narrativeSummary?.nickname && (
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                            {shoe.narrativeSummary.nickname}
                          </p>
                        )}
                        <CardTitle className="text-lg flex items-center gap-2">
                          {shoe.name}
                          <Badge variant="outline" className="text-xs">
                            Retired
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{(shoe.distance / 1000).toFixed(0)} km</p>
                        <p className="text-sm text-muted-foreground">
                          {betaEnabled ? 'View their full story' : 'Total distance'}
                        </p>
                      </CardContent>
                    </Card>
                  );
                  return betaEnabled ? (
                    <Link key={shoe.id} href={`/gear/${shoe.id}`} className="block group">
                      {retiredCard}
                    </Link>
                  ) : (
                    <div key={shoe.id}>{retiredCard}</div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <span className="text-2xl">💡</span>
            <div className="space-y-2 text-sm">
              <p className="font-medium">When to replace your running shoes:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>
                  <span className="text-green-600 font-medium">0-600 km</span> - Shoes are in good
                  condition
                </li>
                <li>
                  <span className="text-yellow-600 font-medium">600-800 km</span> - Start monitoring
                  for wear
                </li>
                <li>
                  <span className="text-orange-600 font-medium">800-1000 km</span> - Consider
                  replacing soon
                </li>
                <li>
                  <span className="text-red-600 font-medium">1000+ km</span> - Time to replace to
                  prevent injury
                </li>
              </ul>
              {betaEnabled && (
                <p className="text-muted-foreground pt-2">
                  Stories use pace, terrain, seasons, and weather (Open-Meteo) from your tagged runs.
                  Change story tone in Settings.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}