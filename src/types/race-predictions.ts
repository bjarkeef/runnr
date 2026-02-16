import type { StravaActivity } from '@/lib/strava';
import type { RaceGoal, TrainingPlan } from '@/lib/training-plan';
import type { PacingStrategy } from '@/lib/predictions';

export interface Prediction {
    available: boolean;
    time: number | null;
    pace: number | null;
    reason: string;
    formattedTime?: string;
    formattedPace?: string;
}

export interface Predictions {
    _5K: Prediction;
    _10K: Prediction;
    halfMarathon: Prediction;
    marathon: Prediction;
}

export interface HistoricalPoint {
    date: string;
    predictions: {
        _5K: number | null;
        _10K: number | null;
        halfMarathon: number | null;
        marathon: number | null;
    };
}

export interface TrainingMetrics {
    recentRunCount: number;
    weeklyKilometers: number;
    avgPace: number;
    longestRun: number;
}

export interface ApiResponse {
    predictions: Predictions;
    historicalData: HistoricalPoint[];
    trainingMetrics: TrainingMetrics;
    activities: StravaActivity[];
}

export type { RaceGoal, TrainingPlan, PacingStrategy };
