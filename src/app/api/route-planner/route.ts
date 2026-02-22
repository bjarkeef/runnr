import { NextResponse } from 'next/server';
import polyline from '@mapbox/polyline';

const OPENROUTESERVICE_API_KEY = process.env.OPENROUTESERVICE_API_KEY;
const OPENROUTESERVICE_BASE_URL = 'https://api.openrouteservice.org';

interface RouteRequest {
  startLat: number;
  startLng: number;
  targetDistance: number; // in meters
}

interface ORSRoute {
  geometry: {
    coordinates: [number, number][];
  };
  properties: {
    segments: Array<{
      distance: number;
      duration: number;
      steps: Array<{
        instruction: string;
        distance: number;
        duration: number;
      }>;
    }>;
  };
}

export async function POST(request: Request) {
  try {
    const { startLat, startLng, targetDistance }: RouteRequest = await request.json();

    if (!OPENROUTESERVICE_API_KEY) {
      return NextResponse.json(
        { error: 'Route planning service not configured. Please add OPENROUTESERVICE_API_KEY to your environment variables. Get a free API key at https://openrouteservice.org/' },
        { status: 500 }
      );
    }

    // we'll generate loops manually by picking a pair of waypoints around the start.
    // the OpenRouteService instance we're running against currently doesn't support
    // the `round_trip` helper (see 400 errors in logs), so we fall back to this approach.

    const profile = 'foot-walking'; // Use walking profile for running routes
    const directionsUrl = `${OPENROUTESERVICE_BASE_URL}/v2/directions/${profile}`;

    console.log('Route request:', { startLat, startLng, targetDistance });

    let bestRoute: any = null;
    let bestDifference = Infinity;
    let bestDistance = 0;
    let isOutAndBack = false;

    // generate random loop candidates
    async function attemptManualLoop(testTarget: number) {
      const bearing1 = Math.random() * 360;
      const bearing2 = (bearing1 + 120 + Math.random() * 120) % 360;
      const radius = Math.max(500, Math.min(testTarget / 3, 4000));

      function pointFor(bearing: number) {
        const latOffset = (radius / 111000) * Math.cos(bearing * Math.PI / 180);
        const lngOffset = (radius / 111000) * Math.sin(bearing * Math.PI / 180);
        const lat = Math.max(-85, Math.min(85, startLat + latOffset));
        const lng = ((startLng + lngOffset + 180) % 360) - 180;
        return [lng, lat] as [number, number];
      }

      const p1 = pointFor(bearing1);
      const p2 = pointFor(bearing2);
      const coords = [[startLng, startLat], p1, p2, [startLng, startLat]];

      const body: any = {
        coordinates: coords,
        format: 'geojson',
        instructions: true,
        geometry_simplify: false,
        options: { avoid_features: [] },
      };

      const res = await fetch(directionsUrl, {
        method: 'POST',
        headers: {
          Authorization: OPENROUTESERVICE_API_KEY as string,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      return res;
    }

    const testLengths = [targetDistance, targetDistance * 1.1, targetDistance * 0.9];
    for (let attempt = 0; attempt < 5; attempt++) {
      for (const len of testLengths) {
        try {
          const res = await attemptManualLoop(len);
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.warn('manual loop request failed', { attempt, len, status: res.status, body });
            continue;
          }
          const data: any = await res.json();
          if (data.routes && data.routes.length > 0) {
            const candidate = data.routes[0];
            const distance = candidate.summary?.distance || 0;
            const diff = Math.abs(distance - targetDistance);
            if (diff < bestDifference) {
              bestDifference = diff;
              bestRoute = candidate;
              isOutAndBack = false;
            }
            if (diff < 200) break;
          }
        } catch (e) {
          console.error('error in manual loop attempt', attempt, len, e);
        }
      }
      if (bestRoute && bestDifference < 200) break;
    }

    // if we didn't manage to get a suitable loop, fall back to old out-and-back search
    if (!bestRoute) {
      const targetDistances = [
        targetDistance / 2,
        targetDistance / 2.5,
        targetDistance / 1.8,
        targetDistance / 3,
        targetDistance / 1.5,
      ];

      for (const testDistance of targetDistances) {
        // testDistance is already in meters; clamp between 500m and 4000m for the random offset
        const offsetDistance = Math.max(500, Math.min(testDistance, 4000));
        const bearing = Math.random() * 360;
        const latOffset = (offsetDistance / 111000) * Math.cos(bearing * Math.PI / 180);
        const lngOffset = (offsetDistance / 111000) * Math.sin(bearing * Math.PI / 180);
        const testTargetLat = Math.max(-85, Math.min(85, startLat + latOffset));
        const testTargetLng = ((startLng + lngOffset + 180) % 360) - 180;

        try {
          const testResponse = await fetch(directionsUrl, {
            method: 'POST',
            headers: {
              'Authorization': OPENROUTESERVICE_API_KEY as string as string,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              coordinates: [
                [startLng, startLat],
                [testTargetLng, testTargetLat],
              ],
              format: 'geojson',
              instructions: true,
              geometry_simplify: false,
              options: {
                avoid_features: [],
              },
            }),
          });

          if (testResponse.ok) {
            const testData: any = await testResponse.json();
            if (testData.routes && testData.routes.length > 0) {
              const testRoute = testData.routes[0];
              const oneWayDistance = testRoute.summary?.distance || 0;
              const roundTripDistance = oneWayDistance * 2;
              const difference = Math.abs(roundTripDistance - targetDistance);

              if (difference < bestDifference) {
                bestDifference = difference;
                bestRoute = testRoute;
                bestDistance = oneWayDistance;
                isOutAndBack = true;
              }

              if (difference < 200) {
                break;
              }
            }
          }
        } catch (error) {
          console.error('Error testing distance:', testDistance, error);
        }
      }

      if (!bestRoute) {
        console.error('No valid routes found for any strategy');
        return NextResponse.json(
          { error: 'Unable to find a suitable route for the selected distance. Try a different starting location.' },
          { status: 404 }
        );
      }
    }

    // bestRoute is now defined (either loop or out-and-back)

    // log summary info
    console.log('Best route found:', {
      targetDistance,
      actualDistance: isOutAndBack ? bestDistance * 2 : bestRoute.summary?.distance,
      difference: bestDifference,
      type: isOutAndBack ? 'out-and-back' : 'loop',
    });

    // Decode the polyline geometry
    const decodedCoordinates = polyline.decode(bestRoute.geometry);

    let finalRoute;
    let stats;

    if (isOutAndBack) {
      const reversedCoordinates = decodedCoordinates.slice().reverse();
      let loopGeom = [...decodedCoordinates, ...reversedCoordinates.slice(1)];
      // ensure the loop explicitly ends where it started
      const first = loopGeom[0];
      const last = loopGeom[loopGeom.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        loopGeom = [...loopGeom, first];
      }
      const routeDuration = bestRoute.summary?.duration || 0;
      const totalDistance = bestDistance * 2;
      const totalDuration = routeDuration * 2;
      const instructions = [
        ...(bestRoute.segments?.flatMap((segment: any) =>
          segment.steps?.map((step: any) => step.instruction) || []
        ) || []),
        'Turn around and return the same way'
      ];

      finalRoute = {
        geometry: loopGeom,
        distance: totalDistance,
        duration: totalDuration,
        instructions,
      };
      stats = { distance: totalDistance, duration: totalDuration };
    } else {
      // direct loop returned from ORS
      const routeDistance = bestRoute.summary?.distance || 0;
      const routeDuration = bestRoute.summary?.duration || 0;
      const instructions =
        bestRoute.segments?.flatMap((segment: any) =>
          segment.steps?.map((step: any) => step.instruction) || []
        ) || [];
      finalRoute = {
        geometry: decodedCoordinates,
        distance: routeDistance,
        duration: routeDuration,
        instructions,
      };
      stats = { distance: routeDistance, duration: routeDuration };
    }

    console.log('Route generated successfully:', {
      distance: stats.distance,
      duration: stats.duration,
      accuracy: `${((stats.distance / targetDistance) * 100).toFixed(1)}% of target`,
      type: isOutAndBack ? 'out-and-back' : 'loop'
    });

    return NextResponse.json({
      route: finalRoute,
      stats,
    });

  } catch (error) {
    console.error('Route planner API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}