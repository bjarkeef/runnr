import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStoredTokens } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await getStoredTokens();
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { stravaId } = auth;

    const allRuns = await prisma.activity.findMany({
      where: {
        user: { stravaId },
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
