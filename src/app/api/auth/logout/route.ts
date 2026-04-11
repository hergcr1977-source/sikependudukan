import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const response = NextResponse.json({ message: 'Logout berhasil' });
    response.cookies.set('session_id', '', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Gagal logout' }, { status: 500 });
  }
}
