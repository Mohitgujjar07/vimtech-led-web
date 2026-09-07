import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, timingSafeEqualStr } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password.trim() : '';

    const expectedUser = (process.env.LAB_ADMIN_USERNAME || 'admin').trim();
    const expectedPass = (process.env.LAB_ADMIN_PASSWORD || 'admin123').trim();

    const isUserValid =
      username.length > 0 &&
      timingSafeEqualStr(username.toLowerCase(), expectedUser.toLowerCase());
    const isPassValid =
      password.length > 0 &&
      timingSafeEqualStr(password, expectedPass);

    if (isUserValid && isPassValid) {
      const token = await createSessionToken(expectedUser);
      const response = NextResponse.json({ success: true, message: 'Logged in successfully' });
      response.cookies.set('lab_auth_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      return response;
    }

    return NextResponse.json(
      { error: 'Invalid username or password' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 500 }
    );
  }
}
