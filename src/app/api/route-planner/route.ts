import { NextResponse } from 'next/server';
import {
  generateRoute,
  isRoutePlannerConfigured,
  RoutePlannerConfigError,
  RoutePlannerInputError,
  RoutePlannerNotFoundError,
  RoutePlannerRateLimitError,
} from '@/lib/route-planner';

interface RouteRequestBody {
  startLat: number;
  startLng: number;
  targetDistance: number; // meters
  variant?: number;
}

export async function POST(request: Request) {
  try {
    if (!isRoutePlannerConfigured()) {
      return NextResponse.json(
        {
          error:
            'Route planning service not configured. Please add OPENROUTESERVICE_API_KEY to your environment variables. Get a free API key at https://openrouteservice.org/',
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RouteRequestBody;
    const { startLat, startLng, targetDistance, variant } = body;

    if (
      typeof startLat !== 'number' ||
      typeof startLng !== 'number' ||
      typeof targetDistance !== 'number'
    ) {
      return NextResponse.json(
        { error: 'startLat, startLng, and targetDistance are required numbers' },
        { status: 400 }
      );
    }

    const result = await generateRoute({
      startLat,
      startLng,
      targetDistance,
      variant: typeof variant === 'number' ? variant : 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RoutePlannerInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof RoutePlannerConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof RoutePlannerRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof RoutePlannerNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('[RoutePlanner] API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
