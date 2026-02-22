import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const storedTokens = cookieStore.get('runnr_strava_tokens')?.value;

    if (!storedTokens) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const parsed = JSON.parse(storedTokens);
    const stravaId = parsed.athleteId || parsed.athlete?.id || parsed.stravaId;

    if (!stravaId) {
      return NextResponse.json(
        { error: 'Invalid token format - athleteId not found' },
        { status: 400 }
      );
    }

    const allRuns = await prisma.activity.findMany({
      where: {
        user: { stravaId: parseInt(stravaId) },
        sportType: 'Run',
      },
      select: { startLatlng: true },
    });
    const locations = allRuns.filter(r => r.startLatlng != null);

    if (!locations || locations.length === 0) {
      return NextResponse.json({ center: null });
    }

    let sumLat = 0;
    let sumLng = 0;
    let count = 0;

    for (const loc of locations) {
      const arr = loc.startLatlng as unknown as number[];
      if (Array.isArray(arr) && arr.length >= 2) {
        sumLat += arr[0];
        sumLng += arr[1];
        count++;
      }
    }

    if (count === 0) {
      return NextResponse.json({ center: null });
    }

    const center = { lat: sumLat / count, lng: sumLng / count };
    return NextResponse.json({ center });
  } catch (error) {
    console.error('Unable to compute run center', error);
    return NextResponse.json({ error: 'Failed to compute run center' }, { status: 500 });
  }
}
