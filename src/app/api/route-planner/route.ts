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

    // For route planning, we'll create a loop route by finding a point at the target distance
    // and then routing back to the start. This creates a round trip.

    // Calculate a target point by adding a small offset to create a reasonable route
    // This is a simplified approach - pick a point roughly 2-4km away in a random direction
    const offsetDistance = Math.max(1000, Math.min(targetDistance / 2, 4000)); // Min 1km, max 4km offset
    const bearing = Math.random() * 360; // Random direction

    // Simple approximation: add small offset to coordinates
    // Approximately 1 degree of latitude = 111km, 1 degree of longitude = 111km * cos(lat)
    const latOffset = (offsetDistance / 111000) * Math.cos(bearing * Math.PI / 180);
    const lngOffset = (offsetDistance / 111000) * Math.sin(bearing * Math.PI / 180);

    const targetLat = startLat + latOffset;
    const targetLng = startLng + lngOffset;

    // Ensure coordinates stay within valid ranges
    const clampedTargetLat = Math.max(-85, Math.min(85, targetLat)); // Avoid poles
    const clampedTargetLng = ((targetLng + 180) % 360) - 180; // Wrap around

    console.log('Route request:', { startLat, startLng, targetDistance });
    console.log('Calculated target:', { targetLat: clampedTargetLat, targetLng: clampedTargetLng });

    // Generate route from start to target and back
    const profile = 'foot-walking'; // Use walking profile for running routes

    const directionsUrl = `${OPENROUTESERVICE_BASE_URL}/v2/directions/${profile}`;

    // Try a simpler approach: just route from start to target first
    const simpleResponse = await fetch(directionsUrl, {
      method: 'POST',
      headers: {
        'Authorization': OPENROUTESERVICE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [startLng, startLat], // Start point
          [clampedTargetLng, clampedTargetLat], // Target point
        ],
        format: 'geojson',
        instructions: true,
        geometry_simplify: false,
        options: {
          avoid_features: [], // Don't avoid any features to be more permissive
        },
      }),
    });

    if (!simpleResponse.ok) {
      const errorData = await simpleResponse.text();
      console.error('OpenRouteService simple route error:', simpleResponse.status, errorData);
      console.error('Simple route coordinates:', { startLng, startLat, clampedTargetLng, clampedTargetLat });

      return NextResponse.json(
        { error: 'Unable to find a route to the target area. Try selecting a different starting location.' },
        { status: 404 }
      );
    }

    const simpleData: any = await simpleResponse.json();

    // Check if we got a valid route response
    if (!simpleData.routes || simpleData.routes.length === 0) {
      console.error('No routes found in response:', JSON.stringify(simpleData, null, 2));
      return NextResponse.json(
        { error: 'Unable to find a route to the target area. Try selecting a different starting location.' },
        { status: 404 }
      );
    }

    const route = simpleData.routes[0];
    if (!route.geometry) {
      console.error('No geometry in route:', JSON.stringify(route, null, 2));
      return NextResponse.json(
        { error: 'Route found but missing geometry data.' },
        { status: 500 }
      );
    }

    // Try to find a route that creates a round trip as close as possible to target distance
    // We'll try different target distances and pick the one that gives the best round trip
    const targetDistances = [
      targetDistance / 2, // Half for out-and-back
      targetDistance / 2.5, // Slightly shorter
      targetDistance / 1.8, // Slightly longer
      targetDistance / 3, // Much shorter
      targetDistance / 1.5, // Much longer
    ];

    let bestRoute = null;
    let bestDifference = Infinity;
    let bestDistance = 0;

    for (const testDistance of targetDistances) {
      // Calculate target point for this test distance (minimum 500m, max 4km)
      const offsetDistance = Math.max(500, Math.min(testDistance * 1000, 4000));
      const bearing = Math.random() * 360;

      const latOffset = (offsetDistance / 111000) * Math.cos(bearing * Math.PI / 180);
      const lngOffset = (offsetDistance / 111000) * Math.sin(bearing * Math.PI / 180);

      const testTargetLat = Math.max(-85, Math.min(85, startLat + latOffset));
      const testTargetLng = ((startLng + lngOffset + 180) % 360) - 180;

      try {
        const testResponse = await fetch(directionsUrl, {
          method: 'POST',
          headers: {
            'Authorization': OPENROUTESERVICE_API_KEY,
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
            const difference = Math.abs(roundTripDistance - targetDistance * 1000);

            if (difference < bestDifference) {
              bestDifference = difference;
              bestRoute = testRoute;
              bestDistance = oneWayDistance;
            }

            // If we found a very close match, use it immediately
            if (difference < 500) { // Within 500m
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error testing distance:', testDistance, error);
      }
    }

    if (!bestRoute) {
      console.error('No valid routes found for any test distance');
      return NextResponse.json(
        { error: 'Unable to find a suitable route for the selected distance. Try a different starting location.' },
        { status: 404 }
      );
    }

    console.log('Best route found:', {
      targetDistance: targetDistance * 1000,
      actualDistance: bestDistance * 2,
      difference: bestDifference
    });

    // Decode the polyline geometry
    const decodedCoordinates = polyline.decode(bestRoute.geometry);

    // Create the round trip route
    const reversedCoordinates = decodedCoordinates.slice().reverse();
    const roundTripGeometry = [...decodedCoordinates, ...reversedCoordinates.slice(1)];

    const routeDuration = bestRoute.summary?.duration || 0;
    const totalDistance = bestDistance * 2;
    const totalDuration = routeDuration * 2;

    const instructions = [
      ...(bestRoute.segments?.flatMap((segment: any) =>
        segment.steps?.map((step: any) => step.instruction) || []
      ) || []),
      'Turn around and return the same way'
    ];

    const finalRoute = {
      geometry: roundTripGeometry,
      distance: totalDistance,
      duration: totalDuration,
      instructions,
    };

    console.log('Route generated successfully:', {
      totalDistance,
      totalDuration,
      geometryPoints: roundTripGeometry.length,
      accuracy: `${((totalDistance / (targetDistance * 1000)) * 100).toFixed(1)}% of target`
    });

    return NextResponse.json({
      route: finalRoute,
      stats: {
        distance: totalDistance,
        duration: totalDuration,
      },
    });

    return NextResponse.json({
      route,
      stats: {
        distance: totalDistance,
        duration: totalDuration,
      },
    });

  } catch (error) {
    console.error('Route planner API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}