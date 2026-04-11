import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Global session store
interface SessionData {
  username: string;
  role: string;
  nama: string;
  expires: number;
}

declare global {
  var _sessions: Map<string, SessionData> | undefined;
}

export function getSessions(): Map<string, SessionData> {
  if (!globalThis._sessions) {
    globalThis._sessions = new Map();
  }
  return globalThis._sessions;
}

// Cleanup expired sessions every 10 minutes
if (typeof globalThis._sessionCleanupInit === 'undefined') {
  globalThis._sessionCleanupInit = true;
  setInterval(() => {
    const sessions = getSessions();
    const now = Date.now();
    for (const [key, val] of sessions) {
      if (val.expires < now) sessions.delete(key);
    }
  }, 10 * 60 * 1000);
}

// User database
const USERS = [
  { username: 'herman', password: 'H3rm4n77', role: 'admin', nama: 'HERMAN GOZALI' },
  { username: 'user', password: 'user1234', role: 'user', nama: 'Pengguna' },
];

function generateSessionId(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

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

    const sessions = getSessions();
    const sessionId = generateSessionId();
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    sessions.set(sessionId, {
      username: user.username,
      role: user.role,
      nama: user.nama,
      expires,
    });

    const response = NextResponse.json({
      message: 'Login berhasil',
      role: user.role,
      nama: user.nama,
    });

    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
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
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 });
    }

    const sessions = getSessions();
    const session = sessions.get(sessionId);
    if (!session || session.expires < Date.now()) {
      sessions.delete(sessionId);
      return NextResponse.json({ error: 'Sesi expired' }, { status: 401 });
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
