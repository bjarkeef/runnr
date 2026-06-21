/**
 * Centralized Strava API client.
 *
 * All Strava HTTP traffic (OAuth + REST) should go through this module.
 * Route handlers authenticate via `@/lib/auth`, then call these helpers
 * with an access token — they should not call `api.strava.com` directly.
 */

const STRAVA_CONFIG = {
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
  redirectUri: process.env.STRAVA_REDIRECT_URI,
  scope: 'read,activity:read_all',
};

const OAUTH_URL = 'https://www.strava.com/oauth';
const API_BASE = 'https://www.strava.com/api/v3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export interface StravaGear {
  id: string;
  name: string;
  brand_name?: string;
  model_name?: string;
  description?: string;
  distance: number;
  primary: boolean;
  retired: boolean;
}

export interface StravaAthleteProfile {
  id: number;
  username?: string;
  firstname?: string;
  lastname?: string;
  profile?: string;
  profile_medium?: string;
  city?: string;
  state?: string;
  country?: string;
  sex?: string;
  weight?: number;
  shoes?: StravaGear[];
  [key: string]: unknown;
}

export interface StravaLap {
  id: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  average_speed: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  lap_index: number;
  split?: number;
  [key: string]: unknown;
}

export interface StravaDetailedActivity extends StravaActivity {
  laps?: StravaLap[];
  gear?: StravaGear;
  description?: string;
  calories?: number;
  [key: string]: unknown;
}

export class StravaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
    public readonly body?: string
  ) {
    super(message);
    this.name = 'StravaApiError';
  }
}

// ---------------------------------------------------------------------------
// Low-level request helpers
// ---------------------------------------------------------------------------

async function stravaFetch<T = unknown>(
  endpoint: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const response = await fetch(`${API_BASE}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.text().catch(() => '');
    throw new StravaApiError(
      `Strava API error on ${endpoint}: ${response.status}${errorData ? ` - ${errorData}` : ''}`,
      response.status,
      endpoint,
      errorData
    );
  }

  return response.json() as Promise<T>;
}

async function stravaGet<T = unknown>(endpoint: string, accessToken: string): Promise<T> {
  return stravaFetch<T>(endpoint, accessToken);
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export function getAuthURL(): string {
  const params = new URLSearchParams({
    client_id: STRAVA_CONFIG.clientId!,
    redirect_uri: STRAVA_CONFIG.redirectUri!,
    response_type: 'code',
    scope: STRAVA_CONFIG.scope!,
  });
  return `${OAUTH_URL}/authorize?${params}`;
}

export async function exchangeToken(code: string): Promise<StravaTokens> {
  const response = await fetch(`${OAUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CONFIG.clientId,
      client_secret: STRAVA_CONFIG.clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
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

export async function refreshAccessToken(
  refreshToken: string,
  oldAthleteId?: number
): Promise<StravaTokens> {
  const response = await fetch(`${OAUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CONFIG.clientId,
      client_secret: STRAVA_CONFIG.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
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

// ---------------------------------------------------------------------------
// Athlete
// ---------------------------------------------------------------------------

export async function getAthleteProfile(accessToken: string): Promise<StravaAthleteProfile> {
  return stravaGet<StravaAthleteProfile>('athlete', accessToken);
}

export async function getAthleteStats(accessToken: string, athleteId: number) {
  return stravaGet(`athletes/${athleteId}/stats`, accessToken);
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export async function getActivities(
  accessToken: string,
  page = 1,
  perPage = 50,
  after?: number
): Promise<StravaActivity[]> {
  let endpoint = `athlete/activities?page=${page}&per_page=${perPage}`;
  if (after) endpoint += `&after=${after}`;
  const activities = await stravaGet<StravaActivity[]>(endpoint, accessToken);
  return activities.filter(
    (activity) => activity.type === 'Run' || activity.sport_type === 'Run'
  );
}

export async function getAllActivities(
  accessToken: string,
  maxPages = 100,
  after?: number
): Promise<StravaActivity[]> {
  const allActivities: StravaActivity[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await getActivities(accessToken, page, 200, after);
    if (batch.length === 0) break;
    allActivities.push(...batch);
    if (batch.length < 200) break;
  }
  const seen = new Set<number>();
  return allActivities.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

export async function getActivityDetails(
  accessToken: string,
  activityId: string | number
): Promise<StravaDetailedActivity> {
  return stravaGet<StravaDetailedActivity>(`activities/${activityId}`, accessToken);
}

export async function getActivityLaps(
  accessToken: string,
  activityId: string | number
): Promise<StravaLap[]> {
  return stravaGet<StravaLap[]>(`activities/${activityId}/laps`, accessToken);
}

/**
 * Full activity payload used by the run detail page: activity + laps + gear.
 * Gear fetch failures are non-fatal so the page still renders.
 */
export async function getFullActivity(
  accessToken: string,
  activityId: string | number
): Promise<StravaDetailedActivity> {
  const activity = await getActivityDetails(accessToken, activityId);

  try {
    activity.laps = await getActivityLaps(accessToken, activityId);
  } catch {
    // Laps are optional
  }

  if (activity.gear_id) {
    try {
      activity.gear = await getGear(accessToken, activity.gear_id);
    } catch {
      // Gear is optional
    }
  }

  return activity;
}

// ---------------------------------------------------------------------------
// Gear
// ---------------------------------------------------------------------------

export async function getGear(accessToken: string, gearId: string): Promise<StravaGear> {
  return stravaGet<StravaGear>(`gear/${gearId}`, accessToken);
}

/**
 * Fetch gear and return null on failure (useful for bulk/background caching).
 */
export async function getGearSafe(
  accessToken: string,
  gearId: string
): Promise<StravaGear | null> {
  try {
    return await getGear(accessToken, gearId);
  } catch (error) {
    console.error(`[Strava] Failed to fetch gear ${gearId}:`, error);
    return null;
  }
}
