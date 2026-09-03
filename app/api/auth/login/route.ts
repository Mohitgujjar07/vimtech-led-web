import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const expectedUser = (process.env.LAB_ADMIN_USERNAME || 'admin').trim();
    const expectedPass = (process.env.LAB_ADMIN_PASSWORD || 'admin123').trim();

    if (
      username &&
      password &&
      username.trim().toLowerCase() === expectedUser.toLowerCase() &&
      password.trim() === expectedPass
    ) {
      const response = NextResponse.json({ success: true, message: 'Logged in successfully' });
      response.cookies.set('lab_auth_session', 'authenticated', {
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
