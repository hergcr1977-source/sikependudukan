import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // JWT tidak perlu dihapus dari server — cukup hapus cookie
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
