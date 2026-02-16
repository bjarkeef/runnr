'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { PacingStrategy } from '@/types/race-predictions';

interface PacingStrategyCardProps {
    pacingStrategy: PacingStrategy;
    selectedStrategy: 'even' | 'negative' | 'positive';
    raceDistance: string;
    onStrategyChange: (strategy: 'even' | 'negative' | 'positive') => void;
}

export function PacingStrategyCard({
    pacingStrategy,
    selectedStrategy,
    raceDistance,
    onStrategyChange
}: PacingStrategyCardProps) {
    return (
        <Card>
            <CardHeader className="pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <CardTitle className="text-base sm:text-lg">🎯 Race Day Pacing Strategy</CardTitle>
                        <CardDescription className="text-xs sm:text-sm mt-1">
                            Kilometer-by-kilometer pace targets for {raceDistance}
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={selectedStrategy}
                            onChange={(e) => onStrategyChange(e.target.value as 'even' | 'negative' | 'positive')}
                            className="text-xs px-2 py-1 rounded-md border border-input bg-background"
                        >
                            <option value="even">Even Split</option>
                            <option value="negative">Negative Split</option>
                            <option value="positive">Positive Split</option>
                        </select>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Strategy Overview */}
                <div className="grid grid-cols-3 gap-3 p-3 bg-muted rounded-lg">
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">Target Time</p>
                        <p className="text-sm sm:text-base font-bold text-green-600">
                            {Math.floor(pacingStrategy.targetTime / 60)}:{(Math.floor(pacingStrategy.targetTime % 60)).toString().padStart(2, '0')}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">Avg Pace</p>
                        <p className="text-sm sm:text-base font-bold">
                            {Math.floor(pacingStrategy.averagePace)}:{Math.round((pacingStrategy.averagePace % 1) * 60).toString().padStart(2, '0')}/km
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">Distance</p>
                        <p className="text-sm sm:text-base font-bold">{pacingStrategy.raceDistance}km</p>
                    </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-2">
                    {pacingStrategy.recommendations.map((rec, idx) => (
                        <p key={idx} className="text-xs sm:text-sm">{rec}</p>
                    ))}
                </div>

                <Separator />

                {/* Split Table */}
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <div className="min-w-[600px] px-3 sm:px-0">
                        <table className="w-full text-left text-xs sm:text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="p-1.5 sm:p-2 font-semibold">KM</th>
                                    <th className="p-1.5 sm:p-2 font-semibold">Pace</th>
                                    <th className="p-1.5 sm:p-2 font-semibold">Split Time</th>
                                    <th className="p-1.5 sm:p-2 font-semibold">Total Time</th>
                                    <th className="p-1.5 sm:p-2 font-semibold">Strategy</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pacingStrategy.splits.map((split) => (
                                    <tr key={split.splitNumber} className="border-b last:border-0 hover:bg-muted/50">
                                        <td className="p-1.5 sm:p-2 font-medium">{split.splitNumber}</td>
                                        <td className="p-1.5 sm:p-2">{split.paceFormatted}</td>
                                        <td className="p-1.5 sm:p-2">{split.splitTimeFormatted}</td>
                                        <td className="p-1.5 sm:p-2 font-medium">{split.cumulativeTimeFormatted}</td>
                                        <td className="p-1.5 sm:p-2 text-muted-foreground">{split.strategy}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Download/Print Hint */}
                <div className="pt-2 text-xs text-muted-foreground text-center">
                    💡 Tip: Screenshot or print this table to bring to your race!
                </div>
            </CardContent>
        </Card>
    );
}
