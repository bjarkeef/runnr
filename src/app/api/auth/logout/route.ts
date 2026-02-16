import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete('runnr_strava_tokens');
  
  // Get the origin from the request to properly redirect
  const origin = request.nextUrl.origin;
  return NextResponse.redirect(new URL('/', origin));
}