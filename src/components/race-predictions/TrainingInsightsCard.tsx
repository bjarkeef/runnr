'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrainingMetrics } from '@/types/race-predictions';

interface TrainingInsightsCardProps {
    trainingMetrics: TrainingMetrics;
}

export function TrainingInsightsCard({ trainingMetrics }: TrainingInsightsCardProps) {
    return (
        <Card>
            <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">💪 Training Insights</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Last 6 months analysis</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center">
                    <p className="text-lg sm:text-xl font-bold text-blue-600">{trainingMetrics.recentRunCount}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Runs</p>
                </div>
                <div className="text-center">
                    <p className="text-lg sm:text-xl font-bold text-green-600">{trainingMetrics.weeklyKilometers.toFixed(1)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">km/week</p>
                </div>
                <div className="text-center">
                    <p className="text-lg sm:text-xl font-bold text-orange-600">
                        {Math.floor(trainingMetrics.avgPace)}:{Math.round((trainingMetrics.avgPace % 1) * 60).toString().padStart(2, '0')}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">min/km</p>
                </div>
                <div className="text-center">
                    <p className="text-lg sm:text-xl font-bold text-purple-600">{trainingMetrics.longestRun.toFixed(1)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Longest (km)</p>
                </div>
            </CardContent>
        </Card>
    );
}
