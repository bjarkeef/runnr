import { NextResponse } from 'next/server';
import { getStoredTokens } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseTone, resolveNarrativeFull, rebuildGearNarrativesSafe } from '@/lib/gear-narrative';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gearId } = await context.params;
    const auth = await getStoredTokens();
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { stravaId: auth.stravaId },
      select: { id: true, gearNarrativeTone: true, gearNarrativeBeta: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.gearNarrativeBeta) {
      return NextResponse.json(
        {
          error: 'Gear narrative beta is not enabled',
          code: 'GEAR_NARRATIVE_BETA_DISABLED',
        },
        { status: 403 }
      );
    }

    let gear = await prisma.gear.findFirst({
      where: { id: gearId, userId: user.id },
      include: { narrative: true },
    });

    if (!gear) {
      return NextResponse.json({ error: 'Gear not found' }, { status: 404 });
    }

    if (!gear.narrative) {
      await rebuildGearNarrativesSafe(user.id);
      gear = await prisma.gear.findFirst({
        where: { id: gearId, userId: user.id },
        include: { narrative: true },
      });
    }

    if (!gear) {
      return NextResponse.json({ error: 'Gear not found' }, { status: 404 });
    }

    const tone = parseTone(user.gearNarrativeTone);
    const narrative = gear.narrative
      ? resolveNarrativeFull(gear.narrative, tone)
      : null;

    return NextResponse.json({
      gear: {
        id: gear.id,
        name: gear.name,
        brand_name: gear.brandName,
        model_name: gear.modelName,
        description: gear.description,
        distance: gear.distance,
        primary: gear.primary,
        retired: gear.retired,
      },
      narrative,
      tone,
      gearNarrativeBeta: true,
    });
  } catch (error) {
    console.error('[Gear Narrative API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gear narrative' },
      { status: 500 }
    );
  }
}