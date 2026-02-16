import { NextResponse } from 'next/server';
import { getDetailedActivity, refreshAccessToken, StravaTokens } from '@/lib/strava';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get('id');

  if (!activityId) {
    return NextResponse.json({ error: 'Activity ID is required' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const storedTokens = cookieStore.get('runnr_strava_tokens')?.value;

  if (!storedTokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    let tokens: StravaTokens = JSON.parse(storedTokens);

    if (Date.now() > tokens.tokenExpiry) {
      tokens = await refreshAccessToken(tokens.refresh_token, tokens.athleteId);
      cookieStore.set('runnr_strava_tokens', JSON.stringify(tokens), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
      });
    }

    const activity = await getDetailedActivity(tokens.access_token, activityId);

    // Fetch laps data
    const lapsResponse = await fetch(`https://www.strava.com/api/v3/activities/${activityId}/laps`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (lapsResponse.ok) {
      const laps = await lapsResponse.json();
      activity.laps = laps;
    }

    // Fetch gear data if available
    if (activity.gear_id) {
      try {
        const gearResponse = await fetch(`https://www.strava.com/api/v3/gear/${activity.gear_id}`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (gearResponse.ok) {
          const gear = await gearResponse.json();
          activity.gear = gear;
        }
      } catch {
        // Gear fetch failed - continue without it
      }
    }
    
    // Cache detailed run data for 10 minutes
    const response = NextResponse.json(activity);
    response.headers.set('Cache-Control', 'private, max-age=600');

    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to fetch detailed activity' }, { status: 500 });
  }
}