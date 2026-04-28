import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { ensureAuthTables } from '@/lib/db-migrate';

export const dynamic = 'force-dynamic';

async function authenticateUser(username: string, password: string) {
  try {
    const user = await db.$queryRawUnsafe<Array<any>>(`
      SELECT u."id", u."username", u."password", u."nama", u."role", u."rtId", u."aktif",
        r."namaRT", r."rw", r."kelurahan", r."kecamatan", r."kabupaten", r."provinsi", r."alamat", r."ketuaRT"
      FROM "AppUser" u
      LEFT JOIN "RukunTetangga" r ON u."rtId" = r.id
      WHERE u."username" = $1 AND u."password" = $2 AND u."aktif" = true
    `, username, password);

    if (!user.length) return null;

    const u = user[0];
    const rtInfo = u.rtId ? {
      namaRT: u.namaRT,
      rw: u.rw,
      kelurahan: u.kelurahan,
      kecamatan: u.kecamatan,
      kabupaten: u.kabupaten,
      provinsi: u.provinsi,
      alamat: u.alamat,
      ketuaRT: u.ketuaRT,
    } : null;

    return {
      username: u.username,
      nama: u.nama,
      role: u.role,
      rtId: u.rtId,
      rtInfo,
    };
  } catch (e) {
    console.error('authenticateUser error:', e);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureAuthTables();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const user = await authenticateUser(username, password);

    if (!user) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    const token = await createSession({
      username: user.username,
      role: user.role,
      nama: user.nama,
      rtId: user.rtId,
      rtInfo: user.rtInfo,
    });

    const response = NextResponse.json({
      message: 'Login berhasil',
      role: user.role,
      nama: user.nama,
      rtId: user.rtId,
      rtInfo: user.rtInfo,
    });

    response.cookies.set('session_id', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
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
      rtId: session.rtId,
      rtInfo: session.rtInfo,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ error: 'Gagal memverifikasi sesi' }, { status: 500 });
  }
}
