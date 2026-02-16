import { NextResponse } from 'next/server';
import { getStoredTokens } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface MappedShoe {
  id: string;
  name: string;
  brand_name?: string;
  model_name?: string;
  description?: string;
  distance: number;
  primary: boolean;
  retired: boolean;
}

export async function GET() {
  try {
    const auth = await getStoredTokens();
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { stravaId } = auth;

    // Get user
    const user = await prisma.user.findUnique({
      where: { stravaId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[Gear API] User cuid:', user.id, 'StravaId:', stravaId);

    // Get cached gear from database
    // Try both user.id (cuid) and stravaId.toString() for backward compatibility
    let cachedGear = await prisma.gear.findMany({
      where: { userId: user.id },
      orderBy: [
        { primary: 'desc' },
        { distance: 'desc' }
      ]
    });

    // If no gear found with cuid, try with stravaId string (old format)
    if (cachedGear.length === 0) {
      cachedGear = await prisma.gear.findMany({
        where: { userId: stravaId.toString() },
        orderBy: [
          { primary: 'desc' },
          { distance: 'desc' }
        ]
      });
      
      console.log('[Gear API] Found with stravaId string:', cachedGear.length);
    }

    console.log('[Gear API] Found gear count:', cachedGear.length);

    const shoes: MappedShoe[] = cachedGear.map(gear => ({
      id: gear.id,
      name: gear.name,
      brand_name: gear.brandName ?? undefined,
      model_name: gear.modelName ?? undefined,
      description: gear.description ?? undefined,
      distance: gear.distance,
      primary: gear.primary,
      retired: gear.retired,
    }));

    const response = NextResponse.json({
      shoes,
      totalShoes: shoes.length,
      activeShoes: shoes.filter((s) => !s.retired).length,
    });

    // Cache for 5 minutes
    response.headers.set('Cache-Control', 'private, max-age=300');

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
