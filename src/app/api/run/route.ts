import { NextResponse } from 'next/server';
import { getFullActivity } from '@/lib/strava';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Resolve a URL id to a Strava activity id.
 * Normal links use Strava numeric ids; older narrative highlights may still
 * pass a Prisma cuid — map those via the local Activity row when possible.
 */
async function resolveStravaActivityId(
  rawId: string,
  userId: string
): Promise<string> {
  // Pure digits (optionally huge BigInt strings) → treat as Strava id directly
  if (/^\d+$/.test(rawId)) {
    return rawId;
  }

  // Prisma cuid / other non-numeric: look up by internal Activity.id
  try {
    const row = await prisma.activity.findFirst({
      where: { id: rawId, userId },
      select: { stravaId: true },
    });
    if (row?.stravaId != null) {
      return String(row.stravaId);
    }
  } catch {
    // fall through and try Strava with original id
  }

  return rawId;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get('id');

  if (!activityId) {
    return NextResponse.json({ error: 'Activity ID is required' }, { status: 400 });
  }

  const auth = await getAuthenticatedUser();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const stravaId = await resolveStravaActivityId(activityId, auth.user.id);
    const activity = await getFullActivity(auth.tokens.access_token, stravaId);

    const response = NextResponse.json(activity);
    response.headers.set('Cache-Control', 'private, max-age=600');
    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to fetch detailed activity' }, { status: 500 });
  }
}