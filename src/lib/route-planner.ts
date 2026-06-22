/**
 * Route planner: generates predictable, on-road loop routes via OpenRouteService.
 *
 * Strategy (in priority order):
 * 1. ORS round_trip — best when supported; uses a fixed seed derived from location+distance
 * 2. Deterministic multi-waypoint loop — evenly spaced bearings, radius sized for target distance
 * 3. Out-and-back — single waypoint at half-distance, then reverse the leg
 *
 * No Math.random() in production paths — same start + distance always yields the same route.
 */

import polyline from '@mapbox/polyline';

const OPENROUTESERVICE_API_KEY = process.env.OPENROUTESERVICE_API_KEY;
const OPENROUTESERVICE_BASE_URL = 'https://api.openrouteservice.org';
const PROFILE = 'foot-walking';

const LOOP_CLOSURE_THRESHOLD_M = 80;
const TARGET_TOLERANCE_M = 250; // accept routes within this of target
const MAX_ORS_CALLS = 6;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoutePlannerInput {
  startLat: number;
  startLng: number;
  targetDistance: number; // meters
  /** Optional: rotate which variant to generate (0, 1, 2…). Defaults to 0 (most northward). */
  variant?: number;
}

export interface PlannedRoute {
  geometry: [number, number][]; // [lat, lng] for Leaflet
  distance: number; // meters
  duration: number; // seconds
  instructions: string[];
  type: 'loop' | 'out-and-back';
  accuracy: number; // fraction of target (1.0 = exact)
}

export interface RoutePlannerResult {
  route: PlannedRoute;
  stats: { distance: number; duration: number };
}

interface ORSRoute {
  geometry: { coordinates: [number, number][]; type?: string } | string;
  summary?: { distance: number; duration: number };
  segments?: Array<{
    distance: number;
    duration: number;
    steps: Array<{ instruction: string; distance: number; duration: number }>;
  }>;
}

interface ORSResponse {
  routes?: ORSRoute[];
  features?: Array<{
    geometry?: ORSRoute['geometry'];
    properties?: {
      summary?: ORSRoute['summary'];
      segments?: ORSRoute['segments'];
    };
  }>;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);
  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfLng * sinHalfLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function computePathDistance(path: [number, number][]): number {
  if (path.length <= 1) return 0;
  let sum = 0;
  for (let i = 1; i < path.length; i++) {
    sum += haversineMeters(path[i - 1], path[i]);
  }
  return sum;
}

function normalizeGeometry(geometry: unknown): [number, number][] {
  if (!geometry) return [];

  if (typeof geometry === 'string') {
    try {
      return polyline.decode(geometry) as [number, number][];
    } catch {
      return [];
    }
  }

  if (typeof geometry === 'object' && geometry !== null) {
    const geom = geometry as { type?: string; coordinates?: unknown };
    if (Array.isArray(geom.coordinates)) {
      // GeoJSON is [lng, lat] — convert to [lat, lng] for Leaflet
      return (geom.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]);
    }
  }

  return [];
}

function extractRoute(data: ORSResponse): ORSRoute | null {
  if (data.routes?.[0]) return data.routes[0];
  // GeoJSON FeatureCollection fallback (some ORS versions return this with format: geojson)
  const feature = data.features?.[0];
  if (feature?.geometry) {
    return {
      geometry: feature.geometry,
      summary: feature.properties?.summary,
      segments: feature.properties?.segments,
    };
  }
  return null;
}

function ensureClosed(path: [number, number][]): [number, number][] {
  if (path.length < 2) return path;
  const first = path[0];
  const last = path[path.length - 1];
  if (haversineMeters(first, last) > LOOP_CLOSURE_THRESHOLD_M) {
    return [...path, first];
  }
  return path;
}

function extractInstructions(route: ORSRoute, extra?: string): string[] {
  const steps = (route.segments ?? []).flatMap(
    (segment) => segment.steps?.map((s) => s.instruction) ?? []
  );
  if (extra) steps.push(extra);
  return steps;
}

/** Deterministic seed from lat/lng/distance/variant — same inputs always produce same seed. */
function routeSeed(lat: number, lng: number, distanceM: number, variant: number): number {
  const key = `${lat.toFixed(5)}:${lng.toFixed(5)}:${Math.round(distanceM)}:${variant}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 1_000_000;
}

// ---------------------------------------------------------------------------
// Waypoint geometry — deterministic circle-ish loops on a map
// ---------------------------------------------------------------------------

/**
 * Place waypoints on a circle around the start point.
 * Radius is derived from target circumference so ORS road distance lands near target.
 * Roads are longer than straight lines, so we undersize the circle slightly (~0.85).
 */
function buildLoopWaypoints(
  startLat: number,
  startLng: number,
  targetDistanceM: number,
  variant: number,
  pointCount: number,
  radiusScale: number
): [number, number][] {
  // Circumference ≈ 2πr; roads add ~15–25% so undersize radius
  const radiusM = Math.max(
    250,
    Math.min((targetDistanceM / (2 * Math.PI)) * radiusScale, 8000)
  );

  // Rotate starting bearing by variant so users can request alternate routes
  const startBearing = (variant * 60) % 360;
  const cosLat = Math.cos(toRad(startLat));

  // ORS expects [lng, lat]
  const coords: [number, number][] = [[startLng, startLat]];

  for (let i = 1; i <= pointCount; i++) {
    const angleDeg = startBearing + (i * 360) / (pointCount + 1);
    const angleRad = toRad(angleDeg);
    const latOffset = (radiusM / 111_000) * Math.cos(angleRad);
    const lngOffset = (radiusM / (111_000 * cosLat)) * Math.sin(angleRad);
    const lat = Math.max(-85, Math.min(85, startLat + latOffset));
    const lng = ((startLng + lngOffset + 180) % 360) - 180;
    coords.push([lng, lat]);
  }

  // Close the loop back to start
  coords.push([startLng, startLat]);
  return coords;
}

function buildOutAndBackWaypoint(
  startLat: number,
  startLng: number,
  halfDistanceM: number,
  variant: number
): [number, number][] {
  const bearing = (variant * 90) % 360; // N, E, S, W by variant
  const cosLat = Math.cos(toRad(startLat));
  const angleRad = toRad(bearing);
  const latOffset = (halfDistanceM / 111_000) * Math.cos(angleRad);
  const lngOffset = (halfDistanceM / (111_000 * cosLat)) * Math.sin(angleRad);
  const lat = Math.max(-85, Math.min(85, startLat + latOffset));
  const lng = ((startLng + lngOffset + 180) % 360) - 180;
  return [
    [startLng, startLat],
    [lng, lat],
  ];
}

// ---------------------------------------------------------------------------
// ORS HTTP
// ---------------------------------------------------------------------------

async function orsDirections(
  coordinates: [number, number][],
  extraBody?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data?: ORSResponse; rateLimited: boolean }> {
  if (!OPENROUTESERVICE_API_KEY) {
    throw new Error('OPENROUTESERVICE_API_KEY not configured');
  }

  const url = `${OPENROUTESERVICE_BASE_URL}/v2/directions/${PROFILE}`;
  const body = {
    coordinates,
    format: 'geojson',
    instructions: true,
    geometry_simplify: false,
    ...extraBody,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: OPENROUTESERVICE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    return { ok: false, status: 429, rateLimited: true };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn('[RoutePlanner] ORS error', res.status, errText.slice(0, 200));
    return { ok: false, status: res.status, rateLimited: false };
  }

  const data = (await res.json()) as ORSResponse;
  return { ok: true, status: 200, data, rateLimited: false };
}

// ---------------------------------------------------------------------------
// Candidate scoring
// ---------------------------------------------------------------------------

interface Candidate {
  geometry: [number, number][];
  distance: number;
  duration: number;
  instructions: string[];
  type: 'loop' | 'out-and-back';
  score: number; // lower is better (distance from target)
}

function scoreCandidate(
  geometry: [number, number][],
  targetDistance: number,
  duration: number,
  instructions: string[],
  type: 'loop' | 'out-and-back'
): Candidate | null {
  if (geometry.length < 3) return null;

  const distance = computePathDistance(geometry);
  if (distance < 100) return null;

  // Loops should roughly close
  if (type === 'loop') {
    const closure = haversineMeters(geometry[0], geometry[geometry.length - 1]);
    if (closure > LOOP_CLOSURE_THRESHOLD_M * 3) return null;
  }

  const score = Math.abs(distance - targetDistance);
  return { geometry, distance, duration, instructions, type, score };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isRoutePlannerConfigured(): boolean {
  return Boolean(OPENROUTESERVICE_API_KEY);
}

export async function generateRoute(input: RoutePlannerInput): Promise<RoutePlannerResult> {
  const { startLat, startLng, targetDistance, variant = 0 } = input;

  if (!OPENROUTESERVICE_API_KEY) {
    throw new RoutePlannerConfigError(
      'Route planning service not configured. Add OPENROUTESERVICE_API_KEY to your environment variables.'
    );
  }

  if (!Number.isFinite(startLat) || !Number.isFinite(startLng) || !Number.isFinite(targetDistance)) {
    throw new RoutePlannerInputError('Invalid start location or target distance');
  }

  if (targetDistance < 500 || targetDistance > 50_000) {
    throw new RoutePlannerInputError('Target distance must be between 0.5 km and 50 km');
  }

  // Holder object avoids TS control-flow narrowing issues with let + nested functions
  const state: { best: Candidate | null; rateLimitHit: boolean; orsCalls: number } = {
    best: null,
    rateLimitHit: false,
    orsCalls: 0,
  };

  const consider = (c: Candidate | null) => {
    if (!c) return;
    if (!state.best || c.score < state.best.score) state.best = c;
  };

  const isGoodEnough = () => Boolean(state.best && state.best.score < TARGET_TOLERANCE_M);

  // --- Strategy 1: ORS round_trip (single call, deterministic seed) ---
  if (state.orsCalls < MAX_ORS_CALLS) {
    state.orsCalls++;
    const seed = routeSeed(startLat, startLng, targetDistance, variant);
    const rt = await orsDirections([[startLng, startLat]], {
      options: {
        round_trip: {
          length: targetDistance,
          points: targetDistance > 15_000 ? 5 : 4,
          seed,
        },
      },
    });

    if (rt.rateLimited) state.rateLimitHit = true;
    else if (rt.ok && rt.data) {
      const route = extractRoute(rt.data);
      if (route) {
        const geom = ensureClosed(normalizeGeometry(route.geometry));
        consider(
          scoreCandidate(
            geom,
            targetDistance,
            route.summary?.duration ?? 0,
            extractInstructions(route),
            'loop'
          )
        );
      }
    }
  }

  // --- Strategy 2: Deterministic multi-waypoint loops (vary radius scale / point count) ---
  // Try a few radius scales so we converge toward target distance without randomness.
  const radiusScales = isGoodEnough() ? [] : [0.82, 0.72, 0.92];
  const pointCounts = [3, 4]; // fewer points = simpler loops on roads

  for (const scale of radiusScales) {
    if (isGoodEnough()) break;
    for (const points of pointCounts) {
      if (state.orsCalls >= MAX_ORS_CALLS) break;
      if (isGoodEnough()) break;

      state.orsCalls++;
      const coords = buildLoopWaypoints(startLat, startLng, targetDistance, variant, points, scale);
      const res = await orsDirections(coords);

      if (res.rateLimited) {
        state.rateLimitHit = true;
        continue;
      }
      if (!res.ok || !res.data) continue;

      const route = extractRoute(res.data);
      if (!route) continue;

      const geom = ensureClosed(normalizeGeometry(route.geometry));
      consider(
        scoreCandidate(
          geom,
          targetDistance,
          route.summary?.duration ?? 0,
          extractInstructions(route),
          'loop'
        )
      );
    }
  }

  // --- Strategy 3: Out-and-back (reliable fallback) ---
  if (!state.best || state.best.score > TARGET_TOLERANCE_M * 2) {
    // Half the target; road distance is longer than straight line so aim slightly under half
    const halfDistances = [targetDistance / 2.2, targetDistance / 2.0, targetDistance / 1.85];

    for (const half of halfDistances) {
      if (state.orsCalls >= MAX_ORS_CALLS) break;
      if (isGoodEnough()) break;

      state.orsCalls++;
      const coords = buildOutAndBackWaypoint(startLat, startLng, half, variant);
      const res = await orsDirections(coords);

      if (res.rateLimited) {
        state.rateLimitHit = true;
        continue;
      }
      if (!res.ok || !res.data) continue;

      const route = extractRoute(res.data);
      if (!route) continue;

      const outbound = normalizeGeometry(route.geometry);
      if (outbound.length < 2) continue;

      // Mirror outbound to create return leg (same road, reverse)
      const inbound = outbound.slice().reverse().slice(1);
      const full = ensureClosed([...outbound, ...inbound]);
      const oneWayDuration = route.summary?.duration ?? 0;

      consider(
        scoreCandidate(
          full,
          targetDistance,
          oneWayDuration * 2,
          extractInstructions(route, 'Turn around and return the same way'),
          'out-and-back'
        )
      );
    }
  }

  if (!state.best) {
    if (state.rateLimitHit) {
      throw new RoutePlannerRateLimitError(
        'Rate limit exceeded while generating routes. Please wait a moment and try again.'
      );
    }
    throw new RoutePlannerNotFoundError(
      'Unable to find a suitable route for the selected distance. Try a different starting location or distance.'
    );
  }

  const winner = state.best;
  const planned: PlannedRoute = {
    geometry: winner.geometry,
    distance: winner.distance,
    duration: winner.duration,
    instructions: winner.instructions,
    type: winner.type,
    accuracy: winner.distance / targetDistance,
  };

  console.log('[RoutePlanner] Generated route', {
    type: planned.type,
    distanceM: Math.round(planned.distance),
    targetM: Math.round(targetDistance),
    accuracy: `${(planned.accuracy * 100).toFixed(1)}%`,
    orsCalls: state.orsCalls,
    variant,
  });

  return {
    route: planned,
    stats: { distance: planned.distance, duration: planned.duration },
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RoutePlannerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutePlannerConfigError';
  }
}

export class RoutePlannerInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutePlannerInputError';
  }
}

export class RoutePlannerRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutePlannerRateLimitError';
  }
}

export class RoutePlannerNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutePlannerNotFoundError';
  }
}
