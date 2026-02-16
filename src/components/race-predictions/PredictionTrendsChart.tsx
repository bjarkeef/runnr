'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTimeForChart, formatTimeDisplay } from '@/lib/utils';
import type { HistoricalPoint } from '@/types/race-predictions';

interface PredictionTrendsChartProps {
    historicalData: HistoricalPoint[];
}

export function PredictionTrendsChart({ historicalData }: PredictionTrendsChartProps) {
    const [showDistances, setShowDistances] = useState({
        '5K': true,
        '10K': true,
        'Half Marathon': false,
        'Marathon': false
    });

    // Dynamically import recharts components
    const [chartsLoaded, setChartsLoaded] = useState(false);
    const [chartComponents, setChartComponents] = useState<typeof import('recharts') | null>(null);

    // Load charts on mount
    useState(() => {
        import('recharts').then((module) => {
            setChartComponents(module);
            setChartsLoaded(true);
        });
    });

    const chartData = historicalData
        ?.filter(point => {
            return point.predictions._5K || point.predictions._10K || 
                   point.predictions.halfMarathon || point.predictions.marathon;
        })
        ?.map(point => ({
            date: new Date(point.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }),
            '5K': formatTimeForChart(point.predictions._5K),
            '10K': formatTimeForChart(point.predictions._10K),
            'Half Marathon': formatTimeForChart(point.predictions.halfMarathon),
            'Marathon': formatTimeForChart(point.predictions.marathon)
        })) || [];

    // Calculate dynamic Y-axis domain based on visible data
    const getVisibleDataRange = () => {
        const visibleValues: number[] = [];
        chartData.forEach(point => {
            Object.entries(showDistances).forEach(([distance, visible]) => {
                if (visible) {
                    const value = point[distance as keyof typeof point];
                    if (typeof value === 'number' && value !== null && value !== undefined) {
                        visibleValues.push(value);
                    }
                }
            });
        });
        
        if (visibleValues.length === 0) return ['dataMin', 'dataMax'];
        
        const min = Math.min(...visibleValues);
        const max = Math.max(...visibleValues);
        const padding = (max - min) * 0.1;
        
        return [Math.max(0, min - padding), max + padding];
    };

    if (chartData.length <= 1) {
        return null;
    }

    if (!chartsLoaded || !chartComponents) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base sm:text-lg">📈 Prediction Trends</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Loading chart...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-96 flex items-center justify-center text-muted-foreground">
                        Loading chart...
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = chartComponents;

    return (
        <Card>
            <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">📈 Prediction Trends</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                    How your predictions evolved with training
                </CardDescription>
            </CardHeader>
            
            {/* Chart Controls */}
            <div className="px-3 sm:px-6 pb-3">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-xs font-medium text-muted-foreground mr-1">Show:</span>
                    
                    {/* Quick select buttons */}
                    <button
                        onClick={() => setShowDistances({ '5K': true, '10K': true, 'Half Marathon': true, 'Marathon': true })}
                        className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs text-muted-foreground hover:text-foreground border rounded"
                    >
                        All
                    </button>
                    <button
                        onClick={() => setShowDistances({ '5K': false, '10K': false, 'Half Marathon': false, 'Marathon': false })}
                        className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs text-muted-foreground hover:text-foreground border rounded mr-1 sm:mr-2"
                    >
                        None
                    </button>
                    
                    {/* Distance toggles */}
                    {Object.entries(showDistances).map(([distance, visible]) => {
                        const colors = {
                            '5K': 'hsl(221.2 83.2% 53.3%)',      // Blue - primary
                            '10K': 'hsl(142.1 76.2% 36.3%)',     // Green
                            'Half Marathon': 'hsl(262.1 83.3% 57.8%)', // Purple
                            'Marathon': 'hsl(346.8 77.2% 49.8%)' // Red/Pink
                        };
                        
                        return (
                            <button
                                key={distance}
                                onClick={() => setShowDistances(prev => ({ ...prev, [distance]: !visible }))}
                                className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs rounded-full border transition-all ${
                                    visible 
                                        ? 'text-white border-transparent shadow-sm' 
                                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                                }`}
                                style={visible ? { backgroundColor: colors[distance as keyof typeof colors] } : {}}
                            >
                                {distance}
                            </button>
                        );
                    })}
                </div>
            </div>
            <CardContent className="px-2 sm:px-6">
                <div className="w-full overflow-x-auto">
                    <div className="min-w-[500px]">
                        <ResponsiveContainer width="100%" height={450}>
                            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                <XAxis 
                                    dataKey="date" 
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    stroke="hsl(var(--border))"
                                />
                                <YAxis 
                                    label={{ value: 'Time (min)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } }}
                                    domain={getVisibleDataRange()}
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    stroke="hsl(var(--border))"
                                    tickFormatter={(value: number) => {
                                        const hours = Math.floor(value / 60);
                                        const mins = Math.floor(value % 60);
                                        return hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${mins}m`;
                                    }}
                                />
                                <Tooltip 
                                    labelFormatter={(value: string) => `Date: ${value}`}
                                    formatter={(value) => {
                                        if (value === null || value === undefined) return ['No prediction', ''];
                                        return [formatTimeDisplay(Number(value)), ''];
                                    }}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--popover))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        fontSize: '12px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                    }}
                                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: '4px' }}
                                />
                                <Legend 
                                    wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                                    iconType="line"
                                />
                                {showDistances['5K'] && (
                                    <Line 
                                        type="monotone" 
                                        dataKey="5K" 
                                        stroke="hsl(221.2 83.2% 53.3%)" 
                                        strokeWidth={2.5} 
                                        connectNulls={false}
                                        dot={{ r: 4, fill: 'hsl(221.2 83.2% 53.3%)', strokeWidth: 2, stroke: '#fff' }}
                                        activeDot={{ r: 6 }}
                                    />
                                )}
                                {showDistances['10K'] && (
                                    <Line 
                                        type="monotone" 
                                        dataKey="10K" 
                                        stroke="hsl(142.1 76.2% 36.3%)" 
                                        strokeWidth={2.5} 
                                        connectNulls={false}
                                        dot={{ r: 4, fill: 'hsl(142.1 76.2% 36.3%)', strokeWidth: 2, stroke: '#fff' }}
                                        activeDot={{ r: 6 }}
                                    />
                                )}
                                {showDistances['Half Marathon'] && (
                                    <Line 
                                        type="monotone" 
                                        dataKey="Half Marathon" 
                                        stroke="hsl(262.1 83.3% 57.8%)" 
                                        strokeWidth={2.5} 
                                        connectNulls={false}
                                        dot={{ r: 4, fill: 'hsl(262.1 83.3% 57.8%)', strokeWidth: 2, stroke: '#fff' }}
                                        activeDot={{ r: 6 }}
                                    />
                                )}
                                {showDistances['Marathon'] && (
                                    <Line 
                                        type="monotone" 
                                        dataKey="Marathon" 
                                        stroke="hsl(346.8 77.2% 49.8%)" 
                                        strokeWidth={2.5} 
                                        connectNulls={false}
                                        dot={{ r: 4, fill: 'hsl(346.8 77.2% 49.8%)', strokeWidth: 2, stroke: '#fff' }}
                                        activeDot={{ r: 6 }}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
