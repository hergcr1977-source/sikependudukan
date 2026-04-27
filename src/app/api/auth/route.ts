import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSession, getSession } from '@/lib/auth-server';

// User database
const USERS = [
  { username: 'herman', password: 'H3rm4n77', role: 'admin', nama: 'HERMAN GOZALI' },
  { username: 'user', password: 'user1234', role: 'user', nama: 'Pengguna' },
];

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const user = USERS.find(
      u => u.username === username && u.password === password
    );

    if (!user) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    // Buat JWT token (disimpan di cookie, tidak perlu server-side session)
    const token = await createSession({
      username: user.username,
      role: user.role,
      nama: user.nama,
    });

    const response = NextResponse.json({
      message: 'Login berhasil',
      role: user.role,
      nama: user.nama,
    });

    response.cookies.set('session_id', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      // TANPA maxAge = session cookie → otomatis hilang saat browser ditutup
      path: '/',
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal login' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 });
    }

    return NextResponse.json({
      role: session.role,
      nama: session.nama,
      username: session.username,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal memverifikasi sesi' }, { status: 500 });
  }
}
