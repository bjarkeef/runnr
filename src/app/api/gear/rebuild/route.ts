import { NextResponse } from 'next/server';
import { getStoredTokens } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rebuildGearNarratives } from '@/lib/gear-narrative';

export async function POST() {
  try {
    const auth = await getStoredTokens();
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { stravaId: auth.stravaId },
      select: { id: true, gearNarrativeBeta: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.gearNarrativeBeta) {
      return NextResponse.json(
        {
          error: 'Enable Gear Stories beta in Settings first',
          code: 'GEAR_NARRATIVE_BETA_DISABLED',
        },
        { status: 403 }
      );
    }

    const result = await rebuildGearNarratives(user.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Gear Rebuild] Error:', error);
    return NextResponse.json(
      { error: 'Failed to rebuild narratives' },
      { status: 500 }
    );
  }
}
