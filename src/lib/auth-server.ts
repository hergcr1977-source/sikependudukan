import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

// JWT Secret — untuk Vercel serverless, gunakan env variable atau fallback
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'sikependudukan-rt001-rw002-secret-key-2024';
  return new TextEncoder().encode(secret);
}

export interface AuthResult {
  success: true;
  role: string;
  nama: string;
  username: string;
}

interface JWTPayload {
  username: string;
  role: string;
  nama: string;
  exp: number;
}

/**
 * Buat JWT token dan simpan di cookie
 */
export async function createSession(user: { username: string; role: string; nama: string }): Promise<string> {
  const secret = getJWTSecret();
  const token = await new SignJWT({
    username: user.username,
    role: user.role,
    nama: user.nama,
  } as Omit<JWTPayload, 'exp'>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(secret);

  return token;
}

/**
 * Verifikasi session dari cookie dan kembalikan data user.
 * Jika tidak valid, kembalikan null.
 */
export async function getSession(): Promise<AuthResult | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_id')?.value;

    if (!token) return null;

    const secret = getJWTSecret();
    const { payload } = await jwtVerify(token, secret);

    return {
      success: true,
      role: (payload as any).role,
      nama: (payload as any).nama,
      username: (payload as any).username,
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
