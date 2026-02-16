'use client';

import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Predictions, HistoricalPoint } from '@/types/race-predictions';

interface PredictionsGridProps {
    predictions: Predictions;
    historicalData: HistoricalPoint[];
}

export function PredictionsGridComponent({ predictions, historicalData }: PredictionsGridProps) {
    // Calculate trend by comparing predictions over 6-month period
    const calculateTrend = (distanceKey: '_5K' | '_10K' | 'halfMarathon' | 'marathon') => {
        if (!historicalData || historicalData.length < 2) return null;
        
        // Get all valid data points for this distance
        const validPoints = historicalData
            .filter(point => point.predictions[distanceKey] !== null && point.predictions[distanceKey] !== undefined)
            .map(point => ({
                date: new Date(point.date),
                time: point.predictions[distanceKey]!
            }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
        
        if (validPoints.length < 2) return null;
        
        // Compare most recent with 6 months ago (or earliest available)
        const newest = validPoints[validPoints.length - 1];
        const sixMonthsAgo = new Date(newest.date);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        // Find closest point to 6 months ago
        const older = validPoints.reduce((prev, curr) => {
            const prevDiff = Math.abs(prev.date.getTime() - sixMonthsAgo.getTime());
            const currDiff = Math.abs(curr.date.getTime() - sixMonthsAgo.getTime());
            return currDiff < prevDiff ? curr : prev;
        });
        
        // Calculate time difference in days for context
        const daysDiff = Math.round((newest.date.getTime() - older.date.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff < 7) return null; // Need at least a week of difference
        
        const change = older.time - newest.time; // Positive = improvement (faster time)
        const percentChange = (change / older.time) * 100;
        
        if (Math.abs(percentChange) < 0.5) return { trend: 'stable', change: 0, daysDiff };
        if (change > 0) return { trend: 'improving', change: percentChange, daysDiff };
        return { trend: 'declining', change: Math.abs(percentChange), daysDiff };
    };

    const renderPrediction = (
        name: string, 
        distance: string, 
        prediction: Predictions[keyof Predictions], 
        distanceKey: '_5K' | '_10K' | 'halfMarathon' | 'marathon'
    ) => {
        const trend = calculateTrend(distanceKey);
        
        return (
            <Card className="h-full">
                <CardHeader className="pb-2 sm:pb-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                            <CardTitle className="text-sm sm:text-base">{name}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">{distance}</CardDescription>
                        </div>
                        {prediction.available && trend && trend.trend !== 'stable' && (
                            <Badge 
                                variant="outline" 
                                className={`text-xs shrink-0 ${
                                    trend.trend === 'improving' ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20' :
                                    'border-red-500 text-red-600 bg-red-50 dark:bg-red-950/20'
                                }`}
                            >
                                {trend.trend === 'improving' ? '↗️' : '↘️'} {Math.abs(trend.change).toFixed(1)}%
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    {prediction.available && prediction.formattedTime ? (
                        <div>
                            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">{prediction.formattedTime}</p>
                            <p className="text-sm sm:text-base text-muted-foreground mt-1">{prediction.formattedPace}</p>
                            {trend && trend.trend !== 'stable' && (
                                <p className={`text-xs mt-2 ${trend.trend === 'improving' ? 'text-green-600' : 'text-red-600'}`}>
                                    {trend.trend === 'improving' ? '🚀 Improving' : '⚠️ Declining'} over {
                                        trend.daysDiff < 30 ? `${trend.daysDiff} days` :
                                        trend.daysDiff < 60 ? `${Math.round(trend.daysDiff / 30)} month${Math.round(trend.daysDiff / 30) > 1 ? 's' : ''}` :
                                        `${Math.round(trend.daysDiff / 30)} months`
                                    }
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs sm:text-sm text-muted-foreground">{prediction.reason || 'Not enough data'}</p>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div>
            <div className="mb-2 sm:mb-3">
                <h2 className="text-base sm:text-lg font-semibold">⏱️ Current Predictions</h2>
                <p className="text-xs text-muted-foreground mt-1">Based on your last 6 months of training • Trends show 6-month progress</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
                {renderPrediction("5K", "5.0 kilometers", predictions._5K, '_5K')}
                {renderPrediction("10K", "10.0 kilometers", predictions._10K, '_10K')}
                {renderPrediction("Half Marathon", "21.1 kilometers", predictions.halfMarathon, 'halfMarathon')}
                {renderPrediction("Marathon", "42.2 kilometers", predictions.marathon, 'marathon')}
            </div>
        </div>
    );
}

// Memoize to prevent unnecessary re-renders when parent state changes
export const PredictionsGrid = memo(PredictionsGridComponent);
