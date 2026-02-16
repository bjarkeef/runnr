'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/context/UserContext';
import { Skeleton } from '@/components/ui/skeleton';
import { shouldRegeneratePlan, calculateDetailedMetrics } from '@/lib/training-plan';
import { generatePacingStrategy } from '@/lib/predictions';
import {
    RaceGoalCard,
    TrainingPlanCard,
    PacingStrategyCard,
    PredictionsGrid,
    PredictionTrendsChart,
    TrainingInsightsCard,
    MethodologyCard,
    GlobalPerformance
} from '@/components/race-predictions';
import type {
    ApiResponse,
    RaceGoal,
    TrainingPlan,
    PacingStrategy
} from '@/types/race-predictions';

export default function RacePredictionsPage() {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [planLoading, setPlanLoading] = useState(false);
    const { user } = useUser();

    const [raceGoal, setRaceGoal] = useState<RaceGoal | null>(null);
    const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
    const [pacingStrategy, setPacingStrategy] = useState<PacingStrategy | null>(null);
    const [selectedStrategy, setSelectedStrategy] = useState<'even' | 'negative' | 'positive'>('even');

    // Load race goal from database
    useEffect(() => {
        async function fetchRaceGoal() {
            if (!user) return;
            try {
                const response = await fetch('/api/race-goal');
                if (response.ok) {
                    const { raceGoal: goal } = await response.json();
                    if (goal) {
                        setRaceGoal({
                            date: goal.date,
                            startDate: goal.startDate,
                            distance: goal.distance,
                            runsPerWeek: goal.runsPerWeek,
                            targetTime: goal.targetTime,
                            trainingDays: goal.trainingDays
                        });
                    }
                }
            } catch {
                // Failed to fetch race goal
            }
        }
        fetchRaceGoal();
    }, [user]);

    // Generate/regenerate training plan when needed
    useEffect(() => {
        if (raceGoal && data?.trainingMetrics && data?.predictions && data?.activities) {
            const fetchAndGeneratePlan = async () => {
                try {
                    setPlanLoading(true);
                    const goalResponse = await fetch('/api/race-goal');
                    if (!goalResponse.ok) return;

                    const { raceGoal: dbGoal } = await goalResponse.json();
                    if (!dbGoal) return;

                    const planResponse = await fetch(`/api/training-plan?raceGoalId=${dbGoal.id}`);
                    if (planResponse.ok) {
                        const { trainingPlan: existingPlan } = await planResponse.json();

                        if (existingPlan && !shouldRegeneratePlan(existingPlan.generatedDate)) {
                            setTrainingPlan(existingPlan);
                            return;
                        }
                    }

                    const predictionForDistance = data.predictions[raceGoal.distance === '5K' ? '_5K' :
                        raceGoal.distance === '10K' ? '_10K' :
                            raceGoal.distance === 'Half Marathon' ? 'halfMarathon' : 'marathon'];

                    const detailedMetrics = calculateDetailedMetrics(
                        data.activities,
                        data.trainingMetrics.weeklyKilometers,
                        data.trainingMetrics.avgPace,
                        data.trainingMetrics.longestRun,
                        data.trainingMetrics.recentRunCount
                    );

                    const saveResponse = await fetch('/api/training-plan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            raceGoalId: dbGoal.id,
                            trainingMetrics: detailedMetrics,
                            predictions: predictionForDistance
                        })
                    });

                    if (saveResponse.ok) {
                        const { trainingPlan: newPlan } = await saveResponse.json();
                        setTrainingPlan(newPlan);
                    }
                } catch {
                    // Failed to fetch/generate training plan
                } finally {
                    setPlanLoading(false);
                }
            };

            fetchAndGeneratePlan();
        }
    }, [raceGoal, data]);

    const handleSetGoal = async (goalData: {
        date: string;
        startDate: string;
        distance: '5K' | '10K' | 'Half Marathon' | 'Marathon';
        runsPerWeek: number;
        trainingDays: number[];
        targetTime: string | null;
    }) => {
        try {
            const response = await fetch('/api/race-goal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goalData)
            });

            if (response.ok) {
                const { raceGoal: goal } = await response.json();
                setRaceGoal({
                    date: goal.date,
                    startDate: goal.startDate,
                    distance: goal.distance,
                    runsPerWeek: goal.runsPerWeek,
                    targetTime: goal.targetTime,
                    trainingDays: goal.trainingDays
                });
                setTrainingPlan(null);
            }
        } catch {
            // Failed to save race goal
        }
    };

    const handleClearGoal = async () => {
        try {
            await fetch('/api/race-goal', { method: 'DELETE' });
            setRaceGoal(null);
            setTrainingPlan(null);
        } catch {
            // Failed to delete race goal
        }
    };

    useEffect(() => {
        async function fetchPredictions() {
            try {
                setLoading(true);
                const response = await fetch('/api/race-predictions');
                if (!response.ok) throw new Error('Failed to fetch');
                const responseData = await response.json();
                setData(responseData);
            } catch {
                setData(null);
            } finally {
                setLoading(false);
            }
        }
        if (user) {
            fetchPredictions();
        } else {
            setLoading(false);
        }
    }, [user]);

    // Generate pacing strategy when race goal and prediction are available
    useEffect(() => {
        if (raceGoal && data?.predictions) {
            const distanceKey = raceGoal.distance === '5K' ? '_5K' :
                raceGoal.distance === '10K' ? '_10K' :
                    raceGoal.distance === 'Half Marathon' ? 'halfMarathon' : 'marathon';
            const prediction = data.predictions[distanceKey];

            const raceDistanceKm = {
                '5K': 5,
                '10K': 10,
                'Half Marathon': 21.1,
                'Marathon': 42.2
            }[raceGoal.distance];

            let paceToUse: number | null = null;

            if (raceGoal.targetTime) {
                const timeParts = raceGoal.targetTime.split(':').map(Number);
                let totalMinutes = 0;

                if (timeParts.length === 3) {
                    totalMinutes = timeParts[0] * 60 + timeParts[1] + timeParts[2] / 60;
                } else if (timeParts.length === 2) {
                    totalMinutes = timeParts[0] + timeParts[1] / 60;
                }

                paceToUse = totalMinutes / raceDistanceKm;
            } else if (prediction.available && prediction.pace) {
                paceToUse = prediction.pace;
            }

            if (paceToUse) {
                const strategy = generatePacingStrategy(raceDistanceKm, paceToUse, selectedStrategy);
                setPacingStrategy(strategy);
            } else {
                setPacingStrategy(null);
            }
        } else {
            setPacingStrategy(null);
        }
    }, [raceGoal, data, selectedStrategy]);

    if (loading) {
        return (
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                <Skeleton className="h-8 w-64 mb-6" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="container mx-auto p-8">
                <div className="text-center text-muted-foreground">Please log in to see your race predictions.</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="container mx-auto p-8">
                <div className="text-center text-muted-foreground">Could not load race predictions.</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-3 sm:p-4 lg:p-8 space-y-3 sm:space-y-4 lg:space-y-6 max-w-6xl">
            <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">🎯 Race Predictions</h1>
                <p className="text-muted-foreground text-xs sm:text-sm">
                    AI-powered predictions based on your training
                </p>
            </div>

            <RaceGoalCard
                raceGoal={raceGoal}
                trainingPlan={trainingPlan}
                planLoading={planLoading}
                onSetGoal={handleSetGoal}
                onClearGoal={handleClearGoal}
            />

            {trainingPlan && raceGoal && (
                <TrainingPlanCard raceGoal={raceGoal} trainingPlan={trainingPlan} />
            )}

            {pacingStrategy && raceGoal && (
                <PacingStrategyCard
                    pacingStrategy={pacingStrategy}
                    selectedStrategy={selectedStrategy}
                    raceDistance={raceGoal.distance}
                    onStrategyChange={setSelectedStrategy}
                />
            )}

            <PredictionsGrid
                predictions={data.predictions}
                historicalData={data.historicalData}
            />

            <PredictionTrendsChart historicalData={data.historicalData} />

            <TrainingInsightsCard trainingMetrics={data.trainingMetrics} />

            <GlobalPerformance predictions={data.predictions} />

            <MethodologyCard />
        </div>
    );
}
