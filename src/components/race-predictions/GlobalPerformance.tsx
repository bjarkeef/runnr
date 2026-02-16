'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Prediction } from '@/types/race-predictions';

interface GlobalPerformanceProps {
    predictions: {
        _5K: Prediction;
        _10K: Prediction;
        halfMarathon: Prediction;
        marathon: Prediction;
    };
}

export function GlobalPerformance({ predictions }: GlobalPerformanceProps) {
    const formatTime = (timeInMinutes: number | null | undefined) => {
        if (timeInMinutes === null || timeInMinutes === undefined) return 'Run more to unlock';
        const hours = Math.floor(timeInMinutes / 60);
        const mins = Math.floor(timeInMinutes % 60);
        const seconds = Math.round((timeInMinutes % 1) * 60);

        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${mins}:${seconds.toString().padStart(2, '0')}`;
    };

    const userTimes = {
        fiveK: formatTime(predictions._5K?.time),
        half: formatTime(predictions.halfMarathon?.time),
        marathon: formatTime(predictions.marathon?.time),
    };
    return (
        <Card className="border-muted">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <span>🌍</span>
                    <span>Global Performance</span>
                    <Badge variant="outline" className="ml-2 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                        2024 Data
                    </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                    Compare your performance to recreational runners worldwide and in Europe
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                        <div className="text-sm font-medium mb-2">5K Average</div>
                        <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">🌍 Global: 34m (M) / 40m (F)</div>
                            <div className="text-xs text-muted-foreground">🇪🇺 Europe: 32m (M) / 38m (F)</div>
                            <div className="text-xs text-muted-foreground">🇩🇰 DK Top 10%: &lt;22m</div>
                        </div>
                        <div className="text-sm mt-2 text-emerald-600 dark:text-emerald-400 font-medium">
                            You: {userTimes.fiveK}
                        </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                        <div className="text-sm font-medium mb-2">Half Marathon</div>
                        <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">🌍 Global: 1:48 (M) / 2:15 (F)</div>
                            <div className="text-xs text-muted-foreground">🇪🇺 Europe: 1:45 (M) / 2:05 (F)</div>
                            <div className="text-xs text-muted-foreground">🇩🇰 DK Top 10%: &lt;1:31</div>
                        </div>
                        <div className="text-sm mt-2 text-emerald-600 dark:text-emerald-400 font-medium">
                            You: {userTimes.half}
                        </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                        <div className="text-sm font-medium mb-2">Marathon</div>
                        <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">🌍 Global: 4:24 (M) / 4:51 (F)</div>
                            <div className="text-xs text-muted-foreground">🇪🇺 Europe: 4:07 (avg)</div>
                            <div className="text-xs text-muted-foreground">🇩🇰 DK Top 10%: &lt;3:24</div>
                        </div>
                        <div className="text-sm mt-2 text-emerald-600 dark:text-emerald-400 font-medium">
                            You: {userTimes.marathon}
                        </div>
                    </div>
                </div>

                {/* Regional Context */}
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">🇩🇰 Denmark & Scandinavia</div>
                    <div className="text-xs text-muted-foreground space-y-1">
                        <p>• Denmark ranks #6 in half marathon performance globally</p>
                        <p>• Scandinavian runners average 10Ks in ~50 min (faster than global avg)</p>
                        <p>• Half marathon is the most popular distance in Europe</p>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                    📊 Data: RunRepeat 2019-2024 studies (107.9M+ race results), US Marathons 2025 Report
                </p>
            </CardContent>
        </Card>
    );
}
