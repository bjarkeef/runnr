import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { startOfWeek, endOfWeek, subWeeks, formatDistanceToNow } from 'date-fns';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const storedTokens = cookieStore.get('runnr_strava_tokens')?.value;

        if (!storedTokens) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const tokens = JSON.parse(storedTokens);
        const stravaId = tokens.athleteId || tokens.athlete?.id;

        if (!stravaId) {
            return NextResponse.json({ error: 'Invalid authentication' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { stravaId: parseInt(stravaId) },
            include: {
                activities: {
                    orderBy: { startDate: 'desc' },
                    take: 1,
                    where: { sportType: 'Run' }
                },
                raceGoals: {
                    orderBy: { date: 'asc' },
                    take: 1,
                    where: { date: { gte: new Date() } }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

        const [thisWeekActivities, lastWeekActivities] = await Promise.all([
            prisma.activity.findMany({
                where: {
                    userId: user.id,
                    sportType: 'Run',
                    startDate: { gte: weekStart, lte: weekEnd }
                }
            }),
            prisma.activity.findMany({
                where: {
                    userId: user.id,
                    sportType: 'Run',
                    startDate: { gte: lastWeekStart, lte: lastWeekEnd }
                }
            })
        ]);

        const thisWeekDistance = thisWeekActivities.reduce((sum, a) => sum + a.distance, 0);
        const lastWeekDistance = lastWeekActivities.reduce((sum, a) => sum + a.distance, 0);

        const latestRun = user.activities[0];
        const nextRace = user.raceGoals[0];

        return NextResponse.json({
            latestRun: latestRun ? {
                name: latestRun.name,
                distance: Math.round(latestRun.distance / 1000 * 10) / 10,
                time: latestRun.movingTime,
                date: latestRun.startDate,
                formattedDate: formatDistanceToNow(new Date(latestRun.startDate), { addSuffix: true })
            } : null,
            weekProgress: {
                distance: Math.round(thisWeekDistance / 1000 * 10) / 10,
                count: thisWeekActivities.length,
                lastWeekDistance: Math.round(lastWeekDistance / 1000 * 10) / 10,
                percentChange: lastWeekDistance > 0 ? Math.round(((thisWeekDistance - lastWeekDistance) / lastWeekDistance) * 100) : null
            },
            nextRace: nextRace ? {
                name: `${nextRace.distance} Race`,
                date: nextRace.date,
                daysUntil: Math.ceil((new Date(nextRace.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            } : null
        });

    } catch (error) {
        console.error('Today Summary API error:', error);
        return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
    }
}
