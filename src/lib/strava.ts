const STRAVA_CONFIG = {
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
  redirectUri: process.env.STRAVA_REDIRECT_URI,
  scope: 'read,activity:read_all'
};

export interface StravaTokens {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: Record<string, unknown> & {
    shoes?: Array<{
      id: string;
      name: string;
      primary: boolean;
      distance: number;
      brand_name?: string;
      model_name?: string;
      description?: string;
      retired?: boolean;
    }>;
  };
  athleteId: number;
  tokenExpiry: number;
}

export interface StravaActivity {
    id: number;
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    total_elevation_gain: number;
    type: string;
    sport_type: string;
    workout_type?: number;
    start_date: string;
    start_date_local: string;
    timezone: string;
    utc_offset: number;
    location_city: string | null;
    location_state: string | null;
    location_country: string | null;
    start_latlng: [number, number];
    end_latlng: [number, number];
    average_speed: number;
    max_speed: number;
    average_heartrate?: number;
    max_heartrate?: number;
    kudos_count?: number;
    gear_id?: string;
    map: {
        id: string;
        summary_polyline: string;
        resource_state: number;
    };
}

const baseURL = 'https://www.strava.com/api/v3';

export function getAuthURL(): string {
  const params = new URLSearchParams({
    client_id: STRAVA_CONFIG.clientId!,
    redirect_uri: STRAVA_CONFIG.redirectUri!,
    response_type: 'code',
    scope: STRAVA_CONFIG.scope!,
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

export async function exchangeToken(code: string): Promise<StravaTokens> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CONFIG.clientId,
      client_secret: STRAVA_CONFIG.clientSecret,
      code: code,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    token_type: data.token_type,
    expires_at: data.expires_at,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    athlete: data.athlete,
    athleteId: data.athlete.id,
    tokenExpiry: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshAccessToken(refreshToken: string, oldAthleteId?: number): Promise<StravaTokens> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CONFIG.clientId,
        client_secret: STRAVA_CONFIG.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();

    // Strava doesn't return athlete object on refresh, so preserve the old athleteId
    const athleteId = data.athlete?.id || oldAthleteId || 0;

    return {
        token_type: data.token_type,
        expires_at: data.expires_at,
        expires_in: data.expires_in,
        refresh_token: data.refresh_token,
        access_token: data.access_token,
        athlete: data.athlete,
        athleteId,
        tokenExpiry: Date.now() + data.expires_in * 1000,
    };
}

async function get<T = unknown>(endpoint: string, accessToken: string): Promise<T> {
    const response = await fetch(`${baseURL}/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Strava API error on ${endpoint}: ${response.status} - ${errorData}`);
    }

    return response.json();
}

export async function getActivities(accessToken: string, page = 1, perPage = 50, after?: number): Promise<StravaActivity[]> {
    let endpoint = `athlete/activities?page=${page}&per_page=${perPage}`;
    if (after) endpoint += `&after=${after}`;
    const activities = await get<StravaActivity[]>(endpoint, accessToken);
    return activities.filter((activity: StravaActivity) => activity.type === 'Run' || activity.sport_type === 'Run');
}

export async function getAllActivities(accessToken: string, maxPages = 100): Promise<StravaActivity[]> {
    let allActivities: StravaActivity[] = [];
    for (let page = 1; page <= maxPages; page++) {
        const batch = await getActivities(accessToken, page, 200);
        if (batch.length === 0) {
            break;
        }
        allActivities = allActivities.concat(batch);
    }
    const seen = new Set();
    return allActivities.filter(a => {
        if (seen.has(a.id)) {
            return false;
        }
        seen.add(a.id);
        return true;
    });
}

export async function getActivityDetails(accessToken: string, activityId: string) {
    return get(`activities/${activityId}`, accessToken);
}

export async function getAthleteProfile(accessToken: string) {
    return get('athlete', accessToken);
}

export async function getAthleteStats(accessToken: string, athleteId: number) {
    return get(`athletes/${athleteId}/stats`, accessToken);
}

export async function getDetailedActivity(accessToken: string, activityId: string): Promise<unknown> {
    return get(`activities/${activityId}`, accessToken);
}