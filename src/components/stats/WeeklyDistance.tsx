'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';

type WeekEntry = { week: string; distance: number; count: number; percentChange: number | null };

export default function WeeklyDistance({ initialData, initialRange = '6m' }: { initialData: WeekEntry[]; initialRange?: '6m' | '12m' | 'all' }) {
  const [range, setRange] = useState<'6m'|'12m'|'all'>(initialRange);
  const [data, setData] = useState<WeekEntry[]>(initialData || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // initialize with provided data
    setData(initialData || []);
  }, [initialData]);

  useEffect(() => {
    let canceled = false;
    const fetchWeekly = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stats?range=${range}&only=weekly`);
        if (!res.ok) throw new Error('Failed to fetch weekly');
        const json = await res.json();
        if (!canceled && json.weeklyProgress) {
          setData(json.weeklyProgress);
        }
      } catch {
        // ignore, keep existing
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    fetchWeekly();
    return () => { canceled = true; };
  }, [range]);

  if (loading && (!data || data.length === 0)) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">Weekly Distance</CardTitle>
              <CardDescription>Loading...</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              {(['6m','12m','all'] as const).map(r => (
                <Button key={r} size="sm" variant={range === r ? 'secondary' : 'ghost'} onClick={() => setRange(r)} className="h-7 px-2 text-[10px]" />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-64 pt-4">
          <div className="h-full flex items-center justify-center"><Skeleton className="h-48 w-full" /></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Weekly Distance</CardTitle>
            <CardDescription>
              Training load {range === '6m' ? 'over the last 6 months' : range === '12m' ? 'over the last 12 months' : 'since you started'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-start">
            {(['6m', '12m', 'all'] as const).map((r) => (
              <Button
                key={r}
                variant={range === r ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 px-2 text-[10px] ${range === r ? 'bg-white shadow-xs' : ''}`}
                onClick={() => setRange(r)}
              >
                {r === '6m' ? '6 Months' : r === '12m' ? '12 Months' : 'All Time'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-64 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={data.length > 40 ? 4 : data.length > 20 ? 2 : 1}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              unit=" km"
            />
            <Tooltip
              cursor={{ fill: '#F3F4F6' }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload as WeekEntry;
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg">
                      <p className="text-xs font-bold mb-1">{label} week</p>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm">{d.distance} km</span>
                        {d.percentChange !== null && (
                          <Badge
                            variant={d.percentChange >= 0 ? "secondary" : "destructive"}
                            className={`text-[10px] py-0 h-4 ${d.percentChange >= 0 ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}`}
                          >
                            {d.percentChange >= 0 ? '+' : ''}{d.percentChange}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{d.count} runs</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="distance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.percentChange && entry.percentChange > 0 ? 'hsl(var(--primary))' : undefined} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
