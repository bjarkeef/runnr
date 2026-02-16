import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { refreshAccessToken, type StravaTokens } from '@/lib/strava';

export interface AuthResult {
  success: true;
  tokens: StravaTokens;
  stravaId: number;
  user: {
    id: string;
    stravaId: number;
  };
}

export interface AuthError {
  success: false;
  response: NextResponse;
}

/**
 * Validates and refreshes Strava tokens, returning user info or an error response.
 * Use this at the start of any API route that requires authentication.
 */
export async function getAuthenticatedUser(): Promise<AuthResult | AuthError> {
  const cookieStore = await cookies();
  const storedTokens = cookieStore.get('runnr_strava_tokens')?.value;

  if (!storedTokens) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
    };
  }

  try {
    let tokens: StravaTokens = JSON.parse(storedTokens);
    const stravaId = tokens.athleteId || tokens.athlete?.id;

    if (!stravaId) {
      return {
        success: false,
        response: NextResponse.json({ error: 'Invalid authentication' }, { status: 400 }),
      };
    }

    // Refresh token if expired
    if (Date.now() > tokens.tokenExpiry) {
      tokens = await refreshAccessToken(tokens.refresh_token, tokens.athleteId);

      // Update the cookie with new tokens
      const cookieStore = await cookies();
      cookieStore.set('runnr_strava_tokens', JSON.stringify(tokens), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { stravaId: parseInt(stravaId.toString()) },
      select: { id: true, stravaId: true },
    });

    if (!user) {
      return {
        success: false,
        response: NextResponse.json({ error: 'User not found' }, { status: 404 }),
      };
    }

    return {
      success: true,
      tokens,
      stravaId: parseInt(stravaId.toString()),
      user,
    };
  } catch {
    return {
      success: false,
      response: NextResponse.json({ error: 'Authentication failed' }, { status: 401 }),
    };
  }
}

/**
 * Simple token extraction without database lookup.
 * Use when you only need the tokens, not full user validation.
 */
export async function getStoredTokens(): Promise<{ tokens: StravaTokens; stravaId: number } | null> {
  const cookieStore = await cookies();
  const storedTokens = cookieStore.get('runnr_strava_tokens')?.value;

  if (!storedTokens) return null;

  try {
    const tokens: StravaTokens = JSON.parse(storedTokens);
    const stravaId = tokens.athleteId || tokens.athlete?.id;
    
    if (!stravaId) return null;

    return { tokens, stravaId: parseInt(stravaId.toString()) };
  } catch {
    return null;
  }
}
