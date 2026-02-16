import { NextRequest, NextResponse } from 'next/server';
import { exchangeToken, StravaTokens } from '@/lib/strava';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/?error=access_denied', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=missing_code', request.url));
  }

  try {
    const tokens: StravaTokens = await exchangeToken(code);
    const cookieStore = await cookies();
    cookieStore.set('runnr_strava_tokens', JSON.stringify(tokens), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 365 * 24 * 60 * 60, // 1 year
        path: '/',
      });
    return NextResponse.redirect(new URL('/', request.url));
  } catch (err) {
    console.error('Error during Strava token exchange:', err);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
}