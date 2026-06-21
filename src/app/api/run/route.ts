import { NextResponse } from 'next/server';
import { getFullActivity } from '@/lib/strava';
import { getAuthenticatedUser } from '@/lib/auth';

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
    const activity = await getFullActivity(auth.tokens.access_token, activityId);

    const response = NextResponse.json(activity);
    response.headers.set('Cache-Control', 'private, max-age=600');
    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to fetch detailed activity' }, { status: 500 });
  }
}