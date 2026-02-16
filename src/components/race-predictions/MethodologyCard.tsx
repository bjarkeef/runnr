'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function MethodologyCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Prediction Methodology</CardTitle>
                <CardDescription>How we calculate your race predictions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h4 className="font-semibold mb-2">🧮 Core Algorithm</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                        Our predictions use a multi-factor model based on your recent training data:
                    </p>
                    <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                        Predicted Pace = Base Pace × Distance Factor × Training Load × Form Factor
                    </div>
                </div>

                <Separator />

                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <h4 className="font-semibold mb-2">📊 Base Pace Calculation</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Analyzes your best recent performances</li>
                            <li>• Weighted by recency (recent runs matter more)</li>
                            <li>• Outlier filtering using IQR method</li>
                            <li>• Similar distance preference when available</li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-2">⚡ Distance Factor</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Accounts for pace drop-off at longer distances</li>
                            <li>• Formula: ratio^0.06 (based on running research)</li>
                            <li>• Extrapolates from your training paces</li>
                            <li>• More conservative for longer distances</li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-2">🏋️ Training Load Assessment</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Weekly distance vs. optimal training volume</li>
                            <li>• Training consistency over 4 weeks</li>
                            <li>• Recent activity frequency</li>
                            <li>• Adjusts predictions ±5% based on load</li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-2">📈 Form Factor</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Compares recent vs. older performances</li>
                            <li>• Detects improving or declining fitness</li>
                            <li>• ±2% adjustment for form trends</li>
                            <li>• Based on pace progression analysis</li>
                        </ul>
                    </div>
                </div>

                <Separator />

                <div>
                    <h4 className="font-semibold mb-2">⚠️ Important Notes</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Predictions are estimates based on training data</li>
                        <li>• Race day conditions and strategy affect actual performance</li>
                        <li>• Requires consistent training data for accuracy</li>
                        <li>• More accurate for distances you train regularly</li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}
