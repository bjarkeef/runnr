import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStoredTokens } from '@/lib/auth';
import { generateTrainingPlan, type TrainingPlan as GeneratedPlan } from '@/lib/training-plan';

// Helper to save training plan to database
async function saveTrainingPlan(userId: string, raceGoalId: string, plan: GeneratedPlan) {
  // Delete existing training plans for this race goal
  await prisma.trainingPlan.deleteMany({
    where: { raceGoalId },
  });

  // Create new training plan
  const trainingPlan = await prisma.trainingPlan.create({
    data: {
      userId,
      raceGoalId,
      weeksUntilRace: plan.weeksUntilRace,
      currentFitness: plan.currentFitness,
      estimatedRaceTime: plan.estimatedRaceTime,
      recommendations: plan.recommendations,
      generatedDate: new Date(plan.generatedDate),
      weeklyPlans: {
        create: plan.plan.map(week => ({
          weekNumber: week.weekNumber,
          weekStartDate: new Date(week.weekStartDate),
          focus: week.focus,
          totalKilometers: week.totalKilometers,
          notes: week.notes,
          workouts: {
            create: week.workouts.map(workout => ({
              day: workout.day,
              type: workout.type,
              distance: workout.distance || null,
              description: workout.description,
              intensity: workout.intensity,
            })),
          },
        })),
      },
    },
    include: {
      weeklyPlans: {
        include: {
          workouts: true,
        },
        orderBy: {
          weekNumber: 'asc',
        },
      },
    },
  });

  return trainingPlan;
}

// GET - Fetch user's current training plan
export async function GET(request: Request) {
  const auth = await getStoredTokens();
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { stravaId } = auth;
    
    const { searchParams } = new URL(request.url);
    const raceGoalId = searchParams.get('raceGoalId');

    if (!raceGoalId) {
      return NextResponse.json({ error: 'Race goal ID required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { stravaId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get existing training plan
    const existingPlan = await prisma.trainingPlan.findFirst({
      where: {
        userId: user.id,
        raceGoalId,
      },
      include: {
        raceGoal: true,
        weeklyPlans: {
          include: {
            workouts: true,
          },
          orderBy: {
            weekNumber: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!existingPlan) {
      return NextResponse.json({ trainingPlan: null });
    }

    // Format to match frontend expectations
    const trainingDays = existingPlan.raceGoal.trainingDays as number[] | null;
    
    const formattedPlan = {
      raceGoal: {
        date: existingPlan.raceGoal.date.toISOString(),
        startDate: existingPlan.raceGoal.startDate ? existingPlan.raceGoal.startDate.toISOString() : undefined,
        distance: existingPlan.raceGoal.distance,
        runsPerWeek: existingPlan.raceGoal.runsPerWeek,
        targetTime: existingPlan.raceGoal.targetTime,
        trainingDays: trainingDays ?? undefined,
      },
      weeksUntilRace: existingPlan.weeksUntilRace,
      currentFitness: existingPlan.currentFitness,
      estimatedRaceTime: existingPlan.estimatedRaceTime,
      recommendations: existingPlan.recommendations,
      generatedDate: existingPlan.generatedDate.toISOString().split('T')[0],
      plan: existingPlan.weeklyPlans.map((week) => ({
        weekNumber: week.weekNumber,
        weekStartDate: week.weekStartDate.toISOString().split('T')[0],
        focus: week.focus,
        totalKilometers: week.totalKilometers,
        notes: week.notes,
        workouts: week.workouts.map((workout) => ({
          day: workout.day,
          type: workout.type,
          distance: workout.distance,
          description: workout.description,
          intensity: workout.intensity,
        })),
      })),
    };

    return NextResponse.json({ trainingPlan: formattedPlan });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch training plan' }, { status: 500 });
  }
}

// POST - Generate and save training plan
export async function POST(request: Request) {
  const auth = await getStoredTokens();
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { stravaId } = auth;
    
    const body = await request.json();
    const { raceGoalId, trainingMetrics, predictions } = body;

    const user = await prisma.user.findUnique({
      where: { stravaId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get race goal
    const raceGoal = await prisma.raceGoal.findUnique({
      where: { id: raceGoalId },
    });

    if (!raceGoal || raceGoal.userId !== user.id) {
      return NextResponse.json({ error: 'Race goal not found' }, { status: 404 });
    }

    // Generate training plan
    const trainingDays = raceGoal.trainingDays as number[] | null;
    
    const goalForGeneration = {
      date: raceGoal.date.toISOString(),
      startDate: raceGoal.startDate ? raceGoal.startDate.toISOString() : undefined,
      distance: raceGoal.distance as '5K' | '10K' | 'Half Marathon' | 'Marathon',
      runsPerWeek: raceGoal.runsPerWeek,
      targetTime: raceGoal.targetTime || undefined,
      trainingDays: trainingDays ?? undefined,
    };

    const generatedPlan = generateTrainingPlan(goalForGeneration, trainingMetrics, predictions);

    // Save to database
    const savedPlan = await saveTrainingPlan(user.id, raceGoalId, generatedPlan);

    // Format response
    const formattedPlan = {
      raceGoal: goalForGeneration,
      weeksUntilRace: savedPlan.weeksUntilRace,
      currentFitness: savedPlan.currentFitness,
      estimatedRaceTime: savedPlan.estimatedRaceTime,
      recommendations: savedPlan.recommendations,
      generatedDate: savedPlan.generatedDate.toISOString().split('T')[0],
      plan: savedPlan.weeklyPlans.map((week) => ({
        weekNumber: week.weekNumber,
        weekStartDate: week.weekStartDate.toISOString().split('T')[0],
        focus: week.focus,
        totalKilometers: week.totalKilometers,
        notes: week.notes,
        workouts: week.workouts.map((workout) => ({
          day: workout.day,
          type: workout.type,
          distance: workout.distance,
          description: workout.description,
          intensity: workout.intensity,
        })),
      })),
    };

    return NextResponse.json({ trainingPlan: formattedPlan });
  } catch {
    return NextResponse.json({ error: 'Failed to generate training plan' }, { status: 500 });
  }
}
