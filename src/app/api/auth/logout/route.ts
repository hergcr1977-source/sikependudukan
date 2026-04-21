import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessions } from '@/lib/auth-server';

export async function POST() {
  try {
    // Hapus session dari server
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    if (sessionId) {
      const sessions = getSessions();
      sessions.delete(sessionId);
    }

    // Hapus cookie
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
