import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// GET /api/admin/users - List all users (excluding password)
export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthError(auth)) return auth;

    const rows = await db.$queryRawUnsafe<Array<any>>(`
      SELECT u.id, u.username, u.nama, u.role, u."rtId", u.aktif, u."createdAt", u."updatedAt",
        r."namaRT", r.rw
      FROM "AppUser" u
      LEFT JOIN "RukunTetangga" r ON u."rtId" = r.id
      ORDER BY u.id
    `);

    return NextResponse.json(rows);
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

    // Check username uniqueness
    const existingUser = await db.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM "AppUser" WHERE username = $1 LIMIT 1`,
      username
    );
    if (existingUser.length) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    // Check rtId exists if provided
    if (rtId) {
      const existingRT = await db.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id FROM "RukunTetangga" WHERE id = $1 LIMIT 1`,
        rtId
      );
      if (!existingRT.length) {
        return NextResponse.json({ error: 'RT tidak ditemukan' }, { status: 404 });
      }
    }

    // Insert user with RETURNING id
    const inserted = await db.$queryRawUnsafe<Array<{ id: number }>>(`
      INSERT INTO "AppUser" ("username", "password", "nama", "role", "rtId", "aktif", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING "id"
    `,
      username,
      password,
      nama,
      role || 'user',
      rtId || null
    );

    const newId = inserted[0]?.id;

    // Return created user without password
    const created = await db.$queryRawUnsafe<Array<any>>(`
      SELECT u.id, u.username, u.nama, u.role, u."rtId", u.aktif, u."createdAt", u."updatedAt",
        r."namaRT", r.rw
      FROM "AppUser" u
      LEFT JOIN "RukunTetangga" r ON u."rtId" = r.id
      WHERE u.id = $1
    `, newId);

    return NextResponse.json(created[0] || {}, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/users error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal membuat user: ${msg}` }, { status: 500 });
  }
}
