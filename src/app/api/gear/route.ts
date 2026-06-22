import { NextResponse } from 'next/server';
import { getStoredTokens } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseTone, resolveNarrativeSummary, rebuildGearNarrativesSafe } from '@/lib/gear-narrative';

interface MappedShoe {
  id: string;
  name: string;
  brand_name?: string;
  model_name?: string;
  description?: string;
  distance: number;
  primary: boolean;
  retired: boolean;
  narrativeSummary?: ReturnType<typeof resolveNarrativeSummary>;
}

export async function GET() {
  try {
    const auth = await getStoredTokens();
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { stravaId } = auth;

    const user = await prisma.user.findUnique({
      where: { stravaId },
      select: { id: true, gearNarrativeTone: true, gearNarrativeBeta: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const betaEnabled = user.gearNarrativeBeta ?? false;

    let cachedGear = await prisma.gear.findMany({
      where: { userId: user.id },
      include: { narrative: betaEnabled },
      orderBy: [{ primary: 'desc' }, { distance: 'desc' }],
    });

    if (cachedGear.length === 0) {
      cachedGear = await prisma.gear.findMany({
        where: { userId: stravaId.toString() },
        include: { narrative: betaEnabled },
        orderBy: [{ primary: 'desc' }, { distance: 'desc' }],
      });
    }

    // Lazy rebuild only when beta is on
    if (betaEnabled) {
      const missingNarratives = cachedGear.some((g) => !g.narrative);
      if (cachedGear.length > 0 && missingNarratives) {
        await rebuildGearNarrativesSafe(user.id);
        cachedGear = await prisma.gear.findMany({
          where: { userId: user.id },
          include: { narrative: true },
          orderBy: [{ primary: 'desc' }, { distance: 'desc' }],
        });
      }
    }

    const tone = parseTone(user.gearNarrativeTone);

    const shoes: MappedShoe[] = cachedGear.map((gear) => ({
      id: gear.id,
      name: gear.name,
      brand_name: gear.brandName ?? undefined,
      model_name: gear.modelName ?? undefined,
      description: gear.description ?? undefined,
      distance: gear.distance,
      primary: gear.primary,
      retired: gear.retired,
      narrativeSummary:
        betaEnabled && gear.narrative
          ? resolveNarrativeSummary(gear.narrative, tone)
          : undefined,
    }));

    const response = NextResponse.json({
      shoes,
      totalShoes: shoes.length,
      activeShoes: shoes.filter((s) => !s.retired).length,
      tone,
      gearNarrativeBeta: betaEnabled,
    });

    response.headers.set('Cache-Control', 'private, no-store');

    return response;
  } catch (error) {
    console.error('[Gear API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch gear',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
