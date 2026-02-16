import { NextResponse } from 'next/server';
import { getAthleteProfile, refreshAccessToken, StravaTokens } from '@/lib/strava';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const storedTokens = cookieStore.get('runnr_strava_tokens')?.value;

  if (!storedTokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    let tokens: StravaTokens = JSON.parse(storedTokens);

    if (Date.now() > tokens.tokenExpiry) {
      tokens = await refreshAccessToken(tokens.refresh_token, tokens.athleteId);
      cookieStore.set('runnr_strava_tokens', JSON.stringify(tokens), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
      });
    }

    const profile = await getAthleteProfile(tokens.access_token);
    return NextResponse.json(profile);
  } catch {
    // Clear invalid tokens
    cookieStore.delete('runnr_strava_tokens');
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
}