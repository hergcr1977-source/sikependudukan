import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Global session store (shared with auth/route.ts)
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

export interface AuthResult {
  success: true;
  role: string;
  nama: string;
  username: string;
}

/**
 * Verifikasi session dari cookie dan kembalikan data user.
 * Jika tidak valid, kembalikan null.
 */
export async function getSession(): Promise<AuthResult | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    if (!sessionId) return null;

    const sessions = getSessions();
    const session = sessions.get(sessionId);
    if (!session || session.expires < Date.now()) {
      sessions.delete(sessionId);
      return null;
    }

    return {
      success: true,
      role: session.role,
      nama: session.nama,
      username: session.username,
    };
  } catch {
    return null;
  }
}

/**
 * Wajib login (admin atau user). Untuk GET/read endpoints.
 * Jika belum login, kembalikan 401.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }
  return session;
}

/**
 * Wajib admin. Untuk POST/PUT/DELETE endpoints.
 * Jika bukan admin, kembalikan 403.
 */
export async function requireAdmin(): Promise<AuthResult | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Akses ditolak. Hanya admin yang dapat mengubah data.' }, { status: 403 });
  }
  return session;
}

/**
 * Cek apakah result dari requireAuth/requireAdmin adalah error response.
 */
export function isAuthError(result: AuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
