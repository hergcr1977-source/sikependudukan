import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireSuperAdmin, isAuthError } from '@/lib/auth-server';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || '/home/z/my-project/db/custom.db';
export const dynamic = 'force-dynamic';

function getDB() {
  return new Database(DB_PATH);
}

// GET /api/admin/users - List all users (excluding password)
export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthError(auth)) return auth;

    const db = getDB();
    try {
      const rows = db.prepare(`
        SELECT u.id, u.username, u.nama, u.role, u.rtId, u.aktif, u.createdAt, u.updatedAt,
          r.namaRT, r.rw
        FROM "AppUser" u
        LEFT JOIN "RukunTetangga" r ON u.rtId = r.id
        ORDER BY u.id
      `).all();

      return NextResponse.json(rows);
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data user' }, { status: 500 });
  }
}

// POST /api/admin/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { username, password, nama, role, rtId } = body;

    if (!username || !password || !nama) {
      return NextResponse.json({ error: 'username, password, dan nama wajib diisi' }, { status: 400 });
    }

    if (!['admin', 'user'].includes(role)) {
      return NextResponse.json({ error: 'role harus admin atau user' }, { status: 400 });
    }

    const db = getDB();
    try {
      // Check username uniqueness
      const existingUser = db.prepare('SELECT id FROM "AppUser" WHERE username = ?').get(username) as any;
      if (existingUser) {
        return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
      }

      // Check rtId exists if provided
      if (rtId) {
        const existingRT = db.prepare('SELECT id FROM "RukunTetangga" WHERE id = ?').get(rtId) as any;
        if (!existingRT) {
          return NextResponse.json({ error: 'RT tidak ditemukan' }, { status: 404 });
        }
      }

      // Insert user
      const result = db.prepare(`
        INSERT INTO "AppUser" (username, password, nama, role, rtId, aktif, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        username,
        password,
        nama,
        role || 'user',
        rtId || null
      );

      // Return created user without password
      const created = db.prepare(`
        SELECT u.id, u.username, u.nama, u.role, u.rtId, u.aktif, u.createdAt, u.updatedAt,
          r.namaRT, r.rw
        FROM "AppUser" u
        LEFT JOIN "RukunTetangga" r ON u.rtId = r.id
        WHERE u.id = ?
      `).get(result.lastInsertRowid);

      return NextResponse.json(created, { status: 201 });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('POST /api/admin/users error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal membuat user: ${msg}` }, { status: 500 });
  }
}
