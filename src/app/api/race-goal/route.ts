import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStoredTokens } from '@/lib/auth';

// GET - Fetch user's current race goal
export async function GET() {
  const auth = await getStoredTokens();
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { tokens, stravaId } = auth;
    
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { stravaId },
      include: {
        raceGoals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          stravaId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.tokenExpiry,
        },
        include: {
          raceGoals: true,
        },
      });
    }

    const raceGoal = user.raceGoals[0] || null;

    return NextResponse.json({ raceGoal });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch race goal' }, { status: 500 });
  }
}

// POST - Create or update race goal
export async function POST(request: Request) {
  const auth = await getStoredTokens();
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { tokens, stravaId } = auth;
    
    const body = await request.json();
    const { date, startDate, distance, runsPerWeek, targetTime, trainingDays } = body;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { stravaId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          stravaId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.tokenExpiry,
        },
      });
    }

    // Create new race goal
    const raceGoal = await prisma.raceGoal.create({
      data: {
        userId: user.id,
        date: new Date(date),
        startDate: startDate ? new Date(startDate) : new Date(),
        distance,
        runsPerWeek,
        targetTime,
        trainingDays: trainingDays ?? null,
      },
    });

    return NextResponse.json({ raceGoal });
  } catch (error) {
    console.error('Error creating race goal:', error);
    return NextResponse.json({ error: 'Failed to create race goal' }, { status: 500 });
  }
}

// DELETE - Remove race goal
export async function DELETE() {
  const auth = await getStoredTokens();
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { stravaId } = auth;
    
    const user = await prisma.user.findUnique({
      where: { stravaId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete all race goals for this user (cascade will delete training plans too)
    await prisma.raceGoal.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting race goal:', error);
    return NextResponse.json({ error: 'Failed to delete race goal' }, { status: 500 });
  }
}
