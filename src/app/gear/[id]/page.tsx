'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';

interface GearMeta {
  id: string;
  name: string;
  brand_name?: string | null;
  model_name?: string | null;
  description?: string | null;
  distance: number;
  primary: boolean;
  retired: boolean;
}

interface LifePathSeg {
  id: string;
  label: string;
  distanceM: number;
  runCount: number;
  dominantPace: string;
  dominantTerrain: string;
  dominantWeather: string;
}

interface Chapter {
  key: string;
  title: string;
  body: string;
  distanceM: number;
  runCount: number;
}

interface Milestone {
  key: string;
  title: string;
  body: string;
  at: string;
}

interface Narrative {
  nickname: string;
  tagline: string;
  traits: string[];
  runCount: number;
  firstRunAt: string | null;
  lastRunAt: string | null;
  totalDistanceM: number;
  paceBuckets: Record<string, number>;
  terrainBuckets: Record<string, number>;
  weatherBuckets: Record<string, number>;
  timeBuckets: Record<string, number>;
  seasonBuckets: Record<string, number>;
  chapters: Chapter[];
  milestones: Milestone[];
  highlights: Record<string, string | number | undefined>;
  lifePath: LifePathSeg[];
  computedAt: string;
}

const SHOE_MAX_KM = 1000;

const paceColor: Record<string, string> = {
  easy: 'bg-sky-400',
  steady: 'bg-emerald-500',
  tempo: 'bg-amber-500',
  race: 'bg-rose-500',
};

const terrainHeight: Record<string, string> = {
  flat: 'h-6',
  rolling: 'h-9',
  hilly: 'h-12',
  mountain: 'h-16',
};

const weatherGlyph: Record<string, string> = {
  clear: '☀',
  rain: '🌧',
  snow: '❄',
  cold: '🥶',
  hot: '🔥',
  windy: '💨',
  unknown: '·',
};

function BucketBars({
  title,
  data,
  labels,
}: {
  title: string;
  data: Record<string, number>;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(data).filter(([k, v]) => k !== 'hourKm' && typeof v === 'number' && v > 0);
  const total = entries.reduce((s, [, v]) => s + (v as number), 0) || 1;
  if (!entries.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
              <span>{labels[k] ?? k}</span>
              <span>{(v as number).toFixed(0)} km</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-amber-600/80 rounded-full" style={{ width: `${((v as number) / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Named periods with hour ranges (local time). */
const TIME_PERIODS = [
  { key: 'nightKm', label: 'Night', hours: '20–5', color: 'bg-indigo-900/70' },
  { key: 'dawnKm', label: 'Dawn', hours: '5–8', color: 'bg-amber-300/90' },
  { key: 'dayKm', label: 'Day', hours: '8–17', color: 'bg-sky-400/90' },
  { key: 'duskKm', label: 'Dusk', hours: '17–20', color: 'bg-orange-500/90' },
] as const;

function hourBandColor(h: number): string {
  if (h >= 5 && h < 8) return 'bg-amber-300/90';
  if (h >= 8 && h < 17) return 'bg-sky-400/90';
  if (h >= 17 && h < 20) return 'bg-orange-500/90';
  return 'bg-indigo-900/70';
}

function TimeOfDayCard({
  data,
}: {
  data: Record<string, number | number[] | undefined>;
}) {
  const named = TIME_PERIODS.map((p) => ({
    ...p,
    km: typeof data[p.key] === 'number' ? (data[p.key] as number) : 0,
  }));
  const namedTotal = named.reduce((s, p) => s + p.km, 0);

  let hourKm: number[] = Array.isArray(data.hourKm) ? (data.hourKm as number[]) : [];
  if (hourKm.length !== 24) hourKm = Array(24).fill(0);
  const hourMax = Math.max(...hourKm, 0.001);
  const hourTotal = hourKm.reduce((s, v) => s + v, 0);
  const hasHourData = hourTotal > 0;

  if (namedTotal <= 0 && !hasHourData) return null;

  // Tick marks every 3h; labels at 0, 6, 12, 18
  const tickHours = [0, 3, 6, 9, 12, 15, 18, 21];
  const labelHours = new Set([0, 6, 12, 18]);

  return (
    <Card className="sm:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Time of day</CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          Named periods with hour ranges · 24h distance by local start hour
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Named period bars with clock ranges */}
        <div className="space-y-2">
          {named
            .filter((p) => p.km > 0 || namedTotal === 0)
            .map((p) => (
              <div key={p.key}>
                <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                  <span>
                    <span className="font-medium text-foreground">{p.label}</span>
                    <span className="ml-1.5 tabular-nums opacity-80">{p.hours}</span>
                  </span>
                  <span>{p.km.toFixed(0)} km</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${p.color}`}
                    style={{ width: `${namedTotal ? (p.km / namedTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
        </div>

        {/* 24h histogram */}
        {hasHourData && (
          <div className="space-y-1.5 pt-1 border-t border-border/60">
            <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wide">
              <span>By hour (local)</span>
              <span>{hourTotal.toFixed(0)} km total</span>
            </div>
            <div className="flex items-end gap-px h-20">
              {hourKm.map((km, h) => (
                <div
                  key={h}
                  className="flex-1 flex flex-col justify-end min-w-0 group relative"
                  title={`${String(h).padStart(2, '0')}:00 – ${String((h + 1) % 24).padStart(2, '0')}:00 · ${km.toFixed(1)} km`}
                >
                  <div
                    className={`w-full rounded-t-sm ${hourBandColor(h)} ${km === 0 ? 'opacity-20' : ''}`}
                    style={{ height: `${Math.max(km > 0 ? 8 : 2, (km / hourMax) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            {/* Hour scale: ticks + labels */}
            <div className="relative h-5 text-[9px] text-muted-foreground tabular-nums select-none">
              {tickHours.map((h) => (
                <span
                  key={h}
                  className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${((h + 0.5) / 24) * 100}%` }}
                >
                  <span className="w-px h-1.5 bg-muted-foreground/50 mb-0.5" />
                  {labelHours.has(h) ? (
                    <span>{String(h).padStart(2, '0')}</span>
                  ) : (
                    <span className="opacity-0">·</span>
                  )}
                </span>
              ))}
              <span
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                style={{ left: '100%' }}
              >
                <span className="w-px h-1.5 bg-muted-foreground/50 mb-0.5" />
                <span>24</span>
              </span>
            </div>
            {/* Period band legend under clock */}
            <div className="flex h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-900/70" style={{ width: `${(5 / 24) * 100}%` }} title="Night 0–5" />
              <div className="bg-amber-300/90" style={{ width: `${(3 / 24) * 100}%` }} title="Dawn 5–8" />
              <div className="bg-sky-400/90" style={{ width: `${(9 / 24) * 100}%` }} title="Day 8–17" />
              <div className="bg-orange-500/90" style={{ width: `${(3 / 24) * 100}%` }} title="Dusk 17–20" />
              <div className="bg-indigo-900/70" style={{ width: `${(4 / 24) * 100}%` }} title="Night 20–24" />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Night</span>
              <span>Dawn 5–8</span>
              <span>Day 8–17</span>
              <span>Dusk 17–20</span>
              <span>Night</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GearStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [gear, setGear] = useState<GearMeta | null>(null);
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [selectedSeg, setSelectedSeg] = useState<LifePathSeg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [betaBlocked, setBetaBlocked] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setBetaBlocked(false);
        const res = await fetch(`/api/gear/${id}/narrative`);
        if (res.status === 403) {
          setBetaBlocked(true);
          setError(null);
          return;
        }
        if (!res.ok) throw new Error('Failed to load story');
        const data = await res.json();
        setGear(data.gear);
        setNarrative(data.narrative);
        if (data.narrative?.lifePath?.length) {
          setSelectedSeg(data.narrative.lifePath[data.narrative.lifePath.length - 1]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (betaBlocked) {
    return (
      <div className="container mx-auto max-w-3xl p-4 space-y-4">
        <Button variant="ghost" asChild className="-ml-2">
          <Link href="/gear" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            All shoes
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              Gear Stories
              <Badge variant="secondary" className="text-xs font-normal">Beta</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Shoe stories are an opt-in beta feature. Enable them in Settings to view nicknames, life paths, and chapters for this pair.
            </p>
            <Button asChild>
              <Link href="/settings">Enable in Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !gear) {
    return (
      <div className="container mx-auto max-w-3xl p-4 text-center text-red-500">
        {error || 'Not found'}
      </div>
    );
  }

  const km = gear.distance / 1000;
  const remaining = Math.max(0, SHOE_MAX_KM - km);
  const pct = Math.min(100, (km / SHOE_MAX_KM) * 100);

  return (
    <div className="container mx-auto max-w-3xl p-4 space-y-6 pb-12">
      <Button variant="ghost" asChild className="-ml-2">
        <Link href="/gear" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          All shoes
        </Link>
      </Button>

      {/* Hero */}
      <header className="space-y-3 border-b border-border/60 pb-6">
        <div className="flex flex-wrap gap-2">
          {gear.primary && <Badge variant="secondary">Primary</Badge>}
          {gear.retired && <Badge variant="outline">Retired</Badge>}
        </div>
        {narrative ? (
          <>
            <p className="text-sm uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400 font-semibold">
              Shoe story
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 dark:text-stone-50 font-serif">
              {narrative.nickname}
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">{narrative.tagline}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {narrative.traits.map((t) => (
                <Badge key={t} variant="outline" className="font-normal">
                  {t}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground pt-2">
              {gear.name}
              {(gear.brand_name || gear.model_name) && (
                <span>
                  {' '}
                  · {gear.brand_name} {gear.model_name}
                </span>
              )}
              {' · '}
              {narrative.runCount} runs
              {narrative.firstRunAt && narrative.lastRunAt && (
                <span>
                  {' · '}
                  {new Date(narrative.firstRunAt).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
                  {' – '}
                  {new Date(narrative.lastRunAt).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
                </span>
              )}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">{gear.name}</h1>
            <p className="text-muted-foreground">
              No story yet — tag this shoe on runs in Strava, then refresh stories from the gear list.
            </p>
          </>
        )}
      </header>

      {narrative && narrative.lifePath.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Life path
          </h2>
          <p className="text-xs text-muted-foreground">
            Tap a segment — height = terrain, color = pace, glyph = weather
          </p>
          <div
            className="flex items-end gap-1 overflow-x-auto pb-2 pt-4 min-h-[5rem]"
            role="listbox"
            aria-label="Life path segments"
          >
            {narrative.lifePath.map((seg) => {
              const selected = selectedSeg?.id === seg.id;
              return (
                <button
                  key={seg.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setSelectedSeg(seg)}
                  className={`flex flex-col items-center gap-1 min-w-[2.25rem] flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded-sm ${
                    selected ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <span className="text-[10px] leading-none" aria-hidden>
                    {weatherGlyph[seg.dominantWeather] ?? '·'}
                  </span>
                  <div
                    className={`w-full rounded-t-sm ${paceColor[seg.dominantPace] ?? 'bg-muted'} ${
                      terrainHeight[seg.dominantTerrain] ?? 'h-8'
                    } ${selected ? 'ring-2 ring-offset-1 ring-amber-700' : ''}`}
                  />
                  <span className="text-[9px] text-muted-foreground truncate max-w-full px-0.5">
                    {seg.label}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedSeg && (
            <Card className="bg-stone-50/80 dark:bg-stone-900/40 border-amber-900/10">
              <CardContent className="pt-4 text-sm space-y-1">
                <p className="font-semibold text-base">{selectedSeg.label}</p>
                <p className="text-muted-foreground">
                  {(selectedSeg.distanceM / 1000).toFixed(1)} km · {selectedSeg.runCount} runs · pace{' '}
                  {selectedSeg.dominantPace} · terrain {selectedSeg.dominantTerrain}
                  {selectedSeg.dominantWeather !== 'unknown' && ` · ${selectedSeg.dominantWeather}`}
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {narrative && narrative.chapters.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Memoir</h2>
          <div className="space-y-3">
            {narrative.chapters.map((ch) => (
              <Card key={ch.key} className="border-l-4 border-l-amber-700/70">
                <CardHeader className="pb-1">
                  <CardTitle className="text-lg font-serif">{ch.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ch.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {narrative && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BucketBars
            title="Pace personality"
            data={narrative.paceBuckets}
            labels={{ easyKm: 'Easy', steadyKm: 'Steady', tempoKm: 'Tempo', raceKm: 'Race' }}
          />
          <BucketBars
            title="Terrain"
            data={narrative.terrainBuckets}
            labels={{ flatKm: 'Flat', rollingKm: 'Rolling', hillyKm: 'Hilly', mountainKm: 'Mountain' }}
          />
          <BucketBars
            title="Weather"
            data={narrative.weatherBuckets}
            labels={{
              clearKm: 'Clear',
              rainKm: 'Rain',
              snowKm: 'Snow',
              coldKm: 'Cold',
              hotKm: 'Hot',
              windyKm: 'Windy',
            }}
          />
          <TimeOfDayCard data={narrative.timeBuckets} />
        </section>
      )}

      {narrative && narrative.milestones.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Milestones
          </h2>
          <div className="flex flex-wrap gap-2">
            {narrative.milestones.map((m) => (
              <div
                key={`${m.key}-${m.at}`}
                className="rounded-full border px-3 py-1 text-xs bg-background"
                title={m.body}
              >
                <span className="font-medium">{m.title}</span>
                <span className="text-muted-foreground ml-1">
                  {new Date(m.at).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {narrative && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Highlights
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {narrative.highlights.fastestActivityId && (
              <Link href={`/run/${narrative.highlights.fastestActivityId}`} className="rounded-lg border p-3 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground">Fastest</p>
                <p className="font-medium">Open run →</p>
              </Link>
            )}
            {narrative.highlights.longestActivityId && (
              <Link href={`/run/${narrative.highlights.longestActivityId}`} className="rounded-lg border p-3 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground">Longest</p>
                <p className="font-medium">Open run →</p>
              </Link>
            )}
            {narrative.highlights.hilliestActivityId && (
              <Link href={`/run/${narrative.highlights.hilliestActivityId}`} className="rounded-lg border p-3 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground">Hilliest</p>
                <p className="font-medium">Open run →</p>
              </Link>
            )}
            {narrative.highlights.wettestActivityId && (
              <Link href={`/run/${narrative.highlights.wettestActivityId}`} className="rounded-lg border p-3 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground">Wettest</p>
                <p className="font-medium">Open run →</p>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Lifespan footer */}
      <Card className="bg-muted/40">
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm text-muted-foreground">Lifespan</p>
              <p className="text-2xl font-bold">{km.toFixed(0)} km</p>
              <p className="text-sm text-muted-foreground">
                ~{remaining.toFixed(0)} km of adventures left if you retire at {SHOE_MAX_KM} km
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{pct.toFixed(0)}% used</p>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-orange-500' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>600</span>
            <span>800</span>
            <span>1000 km</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}