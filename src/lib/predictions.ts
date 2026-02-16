import { StravaActivity } from "./strava";
import { formatRaceTime, formatPaceFromMinKm } from "./utils";

type Prediction = {
    available: boolean;
    time: number | null;
    pace: number | null;
    reason: string;
    formattedTime?: string;
    formattedPace?: string;
};

function calculateRacePredictions(activities: StravaActivity[]) {
    const now = new Date();
    const twentyFourWeeksAgo = new Date(now.getTime() - (24 * 7 * 24 * 60 * 60 * 1000));
    
    const recentActivities = activities.filter(activity => {
      const activityDate = new Date(activity.start_date);
      return activityDate >= twentyFourWeeksAgo && activity.type === 'Run';
    });

    const minRuns5K = 5;
    const minRuns10K = 10;
    const minRunsLong = 20;

    const predictions: {
        _5K: Prediction;
        _10K: Prediction;
        halfMarathon: Prediction;
        marathon: Prediction;
    } = {
      _5K: { available: false, time: null, pace: null, reason: '' },
      _10K: { available: false, time: null, pace: null, reason: '' },
      halfMarathon: { available: false, time: null, pace: null, reason: '' },
      marathon: { available: false, time: null, pace: null, reason: '' }
    };

    if (recentActivities.length < minRuns5K) {
      const reason = `Need at least ${minRuns5K} runs in the last 24 weeks. Currently have ${recentActivities.length}.`;
      predictions._5K.reason = reason;
      predictions._10K.reason = reason;
      predictions.halfMarathon.reason = reason;
      predictions.marathon.reason = reason;
      return predictions;
    }

    predictions._5K = calculateDistancePrediction(recentActivities, 5);
    predictions._10K = calculateDistancePrediction(recentActivities, 10);
    predictions.halfMarathon = calculateDistancePrediction(recentActivities, 21.1);
    predictions.marathon = calculateDistancePrediction(recentActivities, 42.2);

    if (recentActivities.length >= minRuns5K) predictions._5K.available = true;
    else predictions._5K.reason = `Need ${minRuns5K} runs for 5K prediction`;

    if (recentActivities.length >= minRuns10K) predictions._10K.available = true;
    else predictions._10K.reason = `Need ${minRuns10K} runs for 10K prediction`;

    if (recentActivities.length >= minRunsLong) {
      predictions.halfMarathon.available = true;
      predictions.marathon.available = true;
    } else {
      predictions.halfMarathon.reason = `Need ${minRunsLong} runs for half marathon prediction`;
      predictions.marathon.reason = `Need ${minRunsLong} runs for marathon prediction`;
    }

    return predictions;
}

function calculateDistancePrediction(activities: StravaActivity[], distanceKm: number): Prediction {
    const trainingLoad = analyzeTrainingLoad(activities);
    const similarDistances = getSimilarDistanceRange(distanceKm);
    const similarRuns = activities.filter(activity => 
      activity.distance >= similarDistances.min * 1000 && 
      activity.distance <= similarDistances.max * 1000 &&
      activity.moving_time > 0
    );

    let predictedPace = null;

    if (similarRuns.length > 0) {
      const bestRun = similarRuns.reduce((best, current) => 
        (current.moving_time / (current.distance / 1000)) < (best.moving_time / (best.distance / 1000)) 
          ? current : best
      );
      predictedPace = (bestRun.moving_time / 60) / (bestRun.distance / 1000);
    } else {
      predictedPace = estimatePaceFromTraining(activities, distanceKm);
    }

    if (!predictedPace) {
      return { available: false, time: null, pace: null, reason: 'Insufficient data for prediction' };
    }

    const trainingAdjustment = 1 + (trainingLoad.trainingStress - 0.5) * 0.05;
    predictedPace = predictedPace * trainingAdjustment;

    const formAdjustment = trainingLoad.formTrend === 1 ? 0.98 : trainingLoad.formTrend === -1 ? 1.02 : 1.0;
    predictedPace = predictedPace * formAdjustment;

    const predictedTime = predictedPace * distanceKm;
    const timeFormatted = formatRaceTime(predictedTime);

    return {
      available: true,
      time: predictedTime,
      pace: predictedPace,
      reason: '',
      formattedTime: timeFormatted,
      formattedPace: formatPaceFromMinKm(predictedPace),
    };
}

function getSimilarDistanceRange(targetDistance: number) {
    if (targetDistance <= 5) return { min: targetDistance * 0.8, max: targetDistance * 1.2 };
    if (targetDistance <= 10) return { min: targetDistance * 0.7, max: targetDistance * 1.3 };
    if (targetDistance <= 21.1) return { min: targetDistance * 0.6, max: targetDistance * 1.4 };
    return { min: targetDistance * 0.5, max: targetDistance * 1.5 };
}

function estimatePaceFromTraining(activities: StravaActivity[], targetDistance: number) {
    const validRuns = activities
      .filter(activity => activity.distance > 1000 && activity.moving_time > 0 && activity.distance < 50000)
      .map(activity => ({
        distance: activity.distance / 1000,
        pace: (activity.moving_time / 60) / (activity.distance / 1000),
        time: activity.moving_time,
        date: new Date(activity.start_date),
        daysAgo: Math.floor((new Date().getTime() - new Date(activity.start_date).getTime()) / (1000 * 60 * 60 * 24))
      }))
      .filter(run => run.pace > 2.5 && run.pace < 12)
      .sort((a, b) => a.daysAgo - b.daysAgo);

    if (validRuns.length === 0) return null;

    const weightedRuns = validRuns.map(run => {
      const ageWeight = Math.max(0.3, 1 - (run.daysAgo / 90) * 0.7);
      return { ...run, weight: ageWeight, weightedPace: run.pace * ageWeight };
    });

    const paces = weightedRuns.map(r => r.pace).sort((a, b) => a - b);
    const q1 = paces[Math.floor(paces.length * 0.25)];
    const q3 = paces[Math.floor(paces.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const filteredRuns = weightedRuns.filter(run => run.pace >= lowerBound && run.pace <= upperBound);
    if (filteredRuns.length === 0) filteredRuns.push(...weightedRuns.slice(0, 5));

    const bestRun = filteredRuns.reduce((best, current) => current.pace < best.pace ? current : best);
    
    const adjustmentFactor = getDistanceAdjustmentFactor(bestRun.distance, targetDistance);
    return bestRun.pace * adjustmentFactor;
}

function getDistanceAdjustmentFactor(fromDistance: number, toDistance: number) {
    // Riegel formula: T2 = T1 * (D2/D1)^1.06
    // For pace: P2 = P1 * (D2/D1)^0.06 (since pace = time/distance)
    // A runner slows down ~6% for each doubling of distance
    const ratio = toDistance / fromDistance;
    
    // Use 0.06 exponent for pace adjustment (derived from Riegel's 1.06 for time)
    // But also add a fatigue factor for longer extrapolations
    const baseAdjustment = Math.pow(ratio, 0.06);
    
    // Add extra fatigue factor when extrapolating to much longer distances
    // (going from 5K to marathon is harder than formula suggests)
    const extrapolationPenalty = ratio > 4 ? 1 + (Math.log(ratio) - Math.log(4)) * 0.02 : 1;
    
    return baseAdjustment * extrapolationPenalty;
}

function analyzeTrainingLoad(activities: StravaActivity[]) {
    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - (28 * 24 * 60 * 60 * 1000));
    const twelveWeeksAgo = new Date(now.getTime() - (84 * 24 * 60 * 60 * 1000));
    
    const recentRuns = activities.filter(activity => new Date(activity.start_date) >= fourWeeksAgo && activity.type === 'Run');
    const longerTermRuns = activities.filter(activity => new Date(activity.start_date) >= twelveWeeksAgo && activity.type === 'Run');

    const weeklyKilometers = recentRuns.reduce((total, run) => total + run.distance / 1000, 0) / 4;
    
    const totalWeeks = 4;
    const weeksWithRuns = new Set();
    recentRuns.forEach(run => {
      const weekStart = new Date(run.start_date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weeksWithRuns.add(weekStart.getTime());
    });
    const trainingFrequency = weeksWithRuns.size / totalWeeks;

    const sortedByDate = longerTermRuns.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()).slice(-10);

    let formTrend = 0;
    if (sortedByDate.length >= 6) {
      const firstHalf = sortedByDate.slice(0, Math.floor(sortedByDate.length / 2));
      const secondHalf = sortedByDate.slice(Math.floor(sortedByDate.length / 2));
      
      const firstHalfAvgPace = firstHalf.reduce((sum, run) => sum + ((run.moving_time / 60) / (run.distance / 1000)), 0) / firstHalf.length;
      const secondHalfAvgPace = secondHalf.reduce((sum, run) => sum + ((run.moving_time / 60) / (run.distance / 1000)), 0) / secondHalf.length;
      
      const improvement = (firstHalfAvgPace - secondHalfAvgPace) / firstHalfAvgPace;
      if (improvement > 0.05) formTrend = 1;
      else if (improvement < -0.05) formTrend = -1;
    }

    const avgWeeklyVolume = weeklyKilometers;
    const consistencyBonus = trainingFrequency * 0.2;
    const formBonus = formTrend * 0.1;
    
    const trainingStress = Math.min(1.0, (avgWeeklyVolume / 30) + consistencyBonus + formBonus);

    return { weeklyKilometers, trainingFrequency, formTrend, trainingStress, recentRunCount: recentRuns.length };
}

// Pacing Strategy Generator for Race Day
export interface PacingSplit {
    splitNumber: number;
    distance: number; // km
    targetPace: number; // min/km
    targetTime: number; // minutes for this split
    cumulativeDistance: number;
    cumulativeTime: number;
    paceFormatted: string;
    splitTimeFormatted: string;
    cumulativeTimeFormatted: string;
    strategy: string; // e.g., "Even pace", "Start conservative", "Push harder"
}

export interface PacingStrategy {
    raceDistance: number; // km
    targetTime: number; // total minutes
    averagePace: number; // min/km
    strategy: 'even' | 'negative' | 'positive'; // even split, negative split, positive split
    splits: PacingSplit[];
    recommendations: string[];
}

export function generatePacingStrategy(
    raceDistanceKm: number,
    predictedPace: number, // min/km
    strategy: 'even' | 'negative' | 'positive' = 'even'
): PacingStrategy {
    const targetTime = predictedPace * raceDistanceKm;
    const splits: PacingSplit[] = [];
    
    // Generate 1km splits
    let cumulativeDistance = 0;
    let cumulativeTime = 0;
    
    for (let i = 1; i <= Math.ceil(raceDistanceKm); i++) {
        const splitDistance = i <= Math.floor(raceDistanceKm) ? 1 : raceDistanceKm % 1;
        
        let targetPace = predictedPace;
        let strategyNote = "Even pace";
        
        if (strategy === 'negative') {
            // Negative split: Start 2-3% slower, finish 2-3% faster
            const progressRatio = i / Math.ceil(raceDistanceKm);
            if (progressRatio <= 0.5) {
                // First half: 2% slower
                targetPace = predictedPace * 1.02;
                strategyNote = "Start conservative";
            } else {
                // Second half: 2% faster
                targetPace = predictedPace * 0.98;
                strategyNote = "Push harder";
            }
        } else if (strategy === 'positive') {
            // Positive split: Start faster, slow down (NOT recommended but shown)
            const progressRatio = i / Math.ceil(raceDistanceKm);
            if (progressRatio <= 0.5) {
                targetPace = predictedPace * 0.98;
                strategyNote = "Fast start";
            } else {
                targetPace = predictedPace * 1.02;
                strategyNote = "Maintain effort";
            }
        }
        
        // Add fatigue factor for longer races (marathon especially)
        if (raceDistanceKm >= 21.1) {
            const fatigueRatio = i / Math.ceil(raceDistanceKm);
            if (fatigueRatio > 0.75) {
                // Last 25%: Add 1-2% for fatigue
                const fatigueFactor = 1 + (fatigueRatio - 0.75) * 0.04; // Up to 1% slower
                targetPace *= fatigueFactor;
                if (strategy === 'even') {
                    strategyNote = "Manage fatigue";
                }
            }
        }
        
        const splitTime = targetPace * splitDistance;
        cumulativeDistance += splitDistance;
        cumulativeTime += splitTime;
        
        splits.push({
            splitNumber: i,
            distance: splitDistance,
            targetPace,
            targetTime: splitTime,
            cumulativeDistance,
            cumulativeTime,
            paceFormatted: formatPaceFromMinKm(targetPace),
            splitTimeFormatted: formatRaceTime(splitTime),
            cumulativeTimeFormatted: formatRaceTime(cumulativeTime),
            strategy: strategyNote
        });
    }
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (strategy === 'even') {
        recommendations.push('🎯 Even pacing is the most efficient strategy for most runners');
        recommendations.push('⏱️ Focus on maintaining consistent effort throughout');
    } else if (strategy === 'negative') {
        recommendations.push('🚀 Negative split strategy: Start controlled, finish strong');
        recommendations.push('💪 Save energy early to push harder in the second half');
    } else {
        recommendations.push('⚠️ Positive split (not recommended): High injury/burnout risk');
        recommendations.push('🏃 Only use if you know your fitness can handle it');
    }
    
    if (raceDistanceKm >= 21.1) {
        recommendations.push('🥤 Plan hydration every 5km for optimal performance');
        recommendations.push('🍌 Consider fuel (gel/chews) around 45-60 minutes in');
    }
    
    if (raceDistanceKm >= 10) {
        recommendations.push('🧠 Mental checkpoint: Focus on form and breathing at halfway point');
    }
    
    recommendations.push('📱 Use your watch/app to track pace but focus on effort feel');
    recommendations.push('💨 Start behind the pack to avoid going out too fast');
    
    return {
        raceDistance: raceDistanceKm,
        targetTime,
        averagePace: predictedPace,
        strategy,
        splits,
        recommendations
    };
}

export { calculateRacePredictions };
