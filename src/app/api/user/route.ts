import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAthleteProfile } from '@/lib/strava';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const profile = await getAthleteProfile(auth.tokens.access_token);
    return NextResponse.json(profile);
  } catch {
    // Clear invalid tokens on auth failure
    const cookieStore = await cookies();
    cookieStore.delete('runnr_strava_tokens');
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
}