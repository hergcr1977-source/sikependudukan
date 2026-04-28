import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSession, getSession } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { initDatabase } from '@/lib/db-init';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || '/home/z/my-project/db/custom.db';

// Ensure DB is initialized on first login
function ensureDB() {
  const sqlite = new Database(DB_PATH, { readonly: false });
  try {
    initDatabase(sqlite);
  } finally {
    sqlite.close();
  }
}

function getRTInfo(rtId: number) {
  const sqlite = new Database(DB_PATH, { readonly: true });
  try {
    const rt = sqlite.prepare(`SELECT * FROM "RukunTetangga" WHERE id = ?`).get(rtId) as any;
    if (!rt) return null;
    return {
      namaRT: rt.namaRT,
      rw: rt.rw,
      kelurahan: rt.kelurahan,
      kecamatan: rt.kecamatan,
      kabupaten: rt.kabupaten,
      provinsi: rt.provinsi,
      alamat: rt.alamat,
      ketuaRT: rt.ketuaRT,
    };
  } finally {
    sqlite.close();
  }
}

function authenticateUser(username: string, password: string) {
  const sqlite = new Database(DB_PATH, { readonly: true });
  try {
    const user = sqlite.prepare(
      `SELECT u.*, r.namaRT, r.rw, r.kelurahan, r.kecamatan, r.kabupaten, r.provinsi, r.alamat, r.ketuaRT
       FROM "AppUser" u
       LEFT JOIN "RukunTetangga" r ON u."rtId" = r.id
       WHERE u.username = ? AND u.password = ? AND u.aktif = 1`
    ).get(username, password) as any;

    if (!user) return null;

    const rtInfo = user.rtId ? {
      namaRT: user.namaRT,
      rw: user.rw,
      kelurahan: user.kelurahan,
      kecamatan: user.kecamatan,
      kabupaten: user.kabupaten,
      provinsi: user.provinsi,
      alamat: user.alamat,
      ketuaRT: user.ketuaRT,
    } : null;

    return {
      username: user.username,
      nama: user.nama,
      role: user.role,
      rtId: user.rtId,
      rtInfo,
    };
  } finally {
    sqlite.close();
  }
}

export async function POST(request: NextRequest) {
  try {
    // Ensure DB tables exist
    ensureDB();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const user = authenticateUser(username, password);

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
      secure: false,
      sameSite: 'lax',
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
      rtId: session.rtId,
      rtInfo: session.rtInfo,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal memverifikasi sesi' }, { status: 500 });
  }
}
