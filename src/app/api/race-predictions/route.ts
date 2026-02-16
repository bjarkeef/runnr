import { NextResponse } from 'next/server';
import { refreshAccessToken, StravaTokens, StravaActivity } from '@/lib/strava';
import { calculateRacePredictions } from '@/lib/predictions';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// In-memory cache for expensive historical calculations
interface HistoricalCache {
  data: Array<{date: string; predictions: Record<string, number | null>}>;
  timestamp: number;
  activityCount: number;
}
const historicalCache = new Map<number, HistoricalCache>();
const HISTORICAL_CACHE_TTL = 1800000; // 30 minutes

// Calculate predictions at different points in time to show trends
function calculateHistoricalPredictions(activities: StravaActivity[], athleteId: number) {
  // Check cache first
  const cached = historicalCache.get(athleteId);
  if (cached && 
      Date.now() - cached.timestamp < HISTORICAL_CACHE_TTL && 
      cached.activityCount === activities.length) {
    return cached.data;
  }
  const now = new Date();
  const rawData = [];
  
  // Find the oldest activity to determine how far back we can go
  const oldestActivity = activities.length > 0 
    ? activities.reduce((oldest, a) => 
        new Date(a.start_date) < new Date(oldest.start_date) ? a : oldest
      )
    : null;
  
  const oldestDate = oldestActivity ? new Date(oldestActivity.start_date) : now;
  const maxWeeksBack = Math.min(52, Math.floor((now.getTime() - oldestDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  
  // Go back up to 12 months (or as far as data allows), calculate predictions every 2 weeks for performance
  for (let weeks = 0; weeks <= maxWeeksBack; weeks += 2) {
    const cutoffDate = new Date(now.getTime() - (weeks * 7 * 24 * 60 * 60 * 1000));
    
    // Only use activities from the 24-week window BEFORE the cutoff date (matches the prediction logic)
    const windowStart = new Date(cutoffDate.getTime() - (24 * 7 * 24 * 60 * 60 * 1000));
    const activitiesAtTime = activities.filter(a => {
      const activityDate = new Date(a.start_date);
      return activityDate <= cutoffDate && activityDate >= windowStart;
    });
    
    // Require sufficient data points for reliable predictions
    if (activitiesAtTime.length >= 10) {
      const predictions = calculateRacePredictions(activitiesAtTime);
      
      // Only include predictions that are available and within reasonable bounds
      // Times in minutes: 5K 10-60min, 10K 20-120min, HM 60-300min, M 120-600min
      const dataPoint = {
        date: cutoffDate.toISOString().split('T')[0],
        predictions: {
          _5K: predictions._5K.available && predictions._5K.time && predictions._5K.time > 10 && predictions._5K.time < 60 ? predictions._5K.time : null,
          _10K: predictions._10K.available && predictions._10K.time && predictions._10K.time > 20 && predictions._10K.time < 120 ? predictions._10K.time : null,
          halfMarathon: predictions.halfMarathon.available && predictions.halfMarathon.time && predictions.halfMarathon.time > 60 && predictions.halfMarathon.time < 300 ? predictions.halfMarathon.time : null,
          marathon: predictions.marathon.available && predictions.marathon.time && predictions.marathon.time > 120 && predictions.marathon.time < 600 ? predictions.marathon.time : null
        }
      };
      
      rawData.push(dataPoint);
    }
  }
  
  // Apply outlier filtering to smooth the data
  const filteredData = filterOutliers(rawData);
  const result = filteredData.reverse();
  
  // Cache the result
  historicalCache.set(athleteId, {
    data: result,
    timestamp: Date.now(),
    activityCount: activities.length
  });
  
  return result;
}

// Remove statistical outliers from historical predictions
function filterOutliers(data: Array<{date: string; predictions: Record<string, number | null>}>) {
  if (data.length < 3) return data;
  
  const distances = ['_5K', '_10K', 'halfMarathon', 'marathon'];
  
  distances.forEach(distance => {
    // Collect all valid times for this distance
    const times = data
      .map(d => d.predictions[distance])
      .filter(t => t !== null && t !== undefined)
      .sort((a, b) => a - b);
    
    if (times.length < 3) return;
    
    // Calculate quartiles and IQR for outlier detection
    const q1Index = Math.floor(times.length * 0.25);
    const q3Index = Math.floor(times.length * 0.75);
    const q1 = times[q1Index];
    const q3 = times[q3Index];
    const iqr = q3 - q1;
    
    // Define outlier bounds (1.5 * IQR is standard)
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    // Remove outliers
    data.forEach(dataPoint => {
      const time = dataPoint.predictions[distance];
      if (time !== null && (time < lowerBound || time > upperBound)) {
        dataPoint.predictions[distance] = null;
      }
    });
  });
  
  return data;
}

function getTrainingMetrics(activities: StravaActivity[]) {
  const now = new Date();
  const twentyFourWeeksAgo = new Date(now.getTime() - (24 * 7 * 24 * 60 * 60 * 1000)); // 6 months
  const recentRuns = activities.filter(a => new Date(a.start_date) >= twentyFourWeeksAgo && a.type === 'Run');
  
  const totalDistance = recentRuns.reduce((sum, run) => sum + run.distance, 0) / 1000;
  const totalTime = recentRuns.reduce((sum, run) => sum + run.moving_time, 0) / 60;
  const avgPace = totalTime / totalDistance;
  
  return {
    recentRunCount: recentRuns.length,
    weeklyKilometers: totalDistance / 24, // Divide by 24 weeks instead of 4
    avgPace: avgPace,
    longestRun: Math.max(...recentRuns.map(r => r.distance)) / 1000
  };
}

export async function GET() {
  const cookieStore = await cookies();
  const storedTokens = cookieStore.get('runnr_strava_tokens')?.value;

  if (!storedTokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    let tokens: StravaTokens = JSON.parse(storedTokens);
    const stravaId = tokens.athleteId || tokens.athlete?.id;
    
    if (!stravaId) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 400 });
    }
    
    if (Date.now() > tokens.tokenExpiry) {
      tokens = await refreshAccessToken(tokens.refresh_token, tokens.athleteId);
      
      // Update the cookie with new tokens
      const cookieStore = await cookies();
      cookieStore.set('runnr_strava_tokens', JSON.stringify(tokens), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
      });
    }
    
    // Get user with ONLY fields needed for predictions (optimized query)
    // Fetch 18 months of data to support historical trend analysis (12 months trends + 6 month window)
    const eighteenMonthsAgo = new Date();
    eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
    
    const user = await prisma.user.findUnique({
      where: { stravaId: parseInt(stravaId) },
      select: {
        activities: {
          select: {
            stravaId: true,
            distance: true,
            movingTime: true,
            totalElevationGain: true,
            sportType: true,
            startDate: true,
            averageSpeed: true,
            maxSpeed: true,
          },
          where: {
            sportType: 'Run',
            startDate: {
              gte: eighteenMonthsAgo // 18 months for historical trends
            }
          },
          orderBy: { startDate: 'desc' },
        },
      },
    });
    
    if (!user || user.activities.length === 0) {
      return NextResponse.json({
        error: 'No activities found',
        message: 'Please sync your runs from the Runs page first',
        predictions: {
          _5K: { available: false, time: null, pace: null, reason: 'No activities synced' },
          _10K: { available: false, time: null, pace: null, reason: 'No activities synced' },
          halfMarathon: { available: false, time: null, pace: null, reason: 'No activities synced' },
          marathon: { available: false, time: null, pace: null, reason: 'No activities synced' }
        },
        historicalData: [],
        trainingMetrics: {
          recentRunCount: 0,
          weeklyKilometers: 0,
          avgPace: 0,
          longestRun: 0
        },
        activities: []
      });
    }
    
    // Convert database activities to Strava format (minimal data for predictions)
    const activities: StravaActivity[] = user.activities.map(activity => ({
      id: Number(activity.stravaId),
      name: '', // Not needed for predictions
      distance: activity.distance,
      moving_time: activity.movingTime,
      elapsed_time: activity.movingTime, // Use moving time
      total_elevation_gain: activity.totalElevationGain,
      type: activity.sportType,
      sport_type: activity.sportType,
      start_date: activity.startDate.toISOString(),
      start_date_local: activity.startDate.toISOString(),
      timezone: '',
      utc_offset: 0,
      location_city: null,
      location_state: null,
      location_country: null,
      start_latlng: [0, 0],
      end_latlng: [0, 0],
      average_speed: activity.averageSpeed,
      max_speed: activity.maxSpeed,
      average_heartrate: undefined,
      max_heartrate: undefined,
      map: {
        id: '',
        summary_polyline: '',
        resource_state: 2
      }
    }));
    
    const predictions = calculateRacePredictions(activities);
    
    // Calculate historical predictions for trend analysis (CACHED!)
    const historicalPredictions = calculateHistoricalPredictions(activities, parseInt(stravaId));
    
    const response = NextResponse.json({
      predictions,
      historicalData: historicalPredictions,
      trainingMetrics: getTrainingMetrics(activities),
      activities: activities // Include activities for detailed analysis on client
    });
    
    // Cache predictions for 30 minutes
    response.headers.set('Cache-Control', 'private, max-age=1800');
    
    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to fetch race predictions' }, { status: 500 });
  }
}