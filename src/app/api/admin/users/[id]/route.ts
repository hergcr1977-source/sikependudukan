import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireSuperAdmin, isAuthError } from '@/lib/auth-server';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || '/home/z/my-project/db/custom.db';
export const dynamic = 'force-dynamic';

function getDB() {
  return new Database(DB_PATH);
}

// PUT /api/admin/users/[id] - Update user (including reset password)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const { nama, role, rtId, aktif, password } = body;

    const db = getDB();
    try {
      // Check user exists
      const existing = db.prepare('SELECT * FROM "AppUser" WHERE id = ?').get(userId) as any;
      if (!existing) {
        return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
      }

      // Cannot deactivate superadmin
      if (existing.role === 'superadmin' && aktif === 0) {
        return NextResponse.json({ error: 'Tidak dapat menonaktifkan akun superadmin' }, { status: 403 });
      }

      // Build dynamic UPDATE
      const updates: string[] = [];
      const values: any[] = [];

      if (nama !== undefined) { updates.push('nama = ?'); values.push(nama); }
      if (role !== undefined) {
        if (!['admin', 'user', 'superadmin'].includes(role)) {
          return NextResponse.json({ error: 'role harus admin, user, atau superadmin' }, { status: 400 });
        }
        updates.push('role = ?');
        values.push(role);
      }
      if (rtId !== undefined) {
        if (rtId !== null) {
          const existingRT = db.prepare('SELECT id FROM "RukunTetangga" WHERE id = ?').get(rtId) as any;
          if (!existingRT) {
            return NextResponse.json({ error: 'RT tidak ditemukan' }, { status: 404 });
          }
        }
        updates.push('rtId = ?');
        values.push(rtId);
      }
      if (aktif !== undefined) { updates.push('aktif = ?'); values.push(aktif ? 1 : 0); }
      if (password !== undefined && password !== '') {
        updates.push('password = ?');
        values.push(password);
      }

      if (updates.length === 0) {
        return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
      }

      updates.push('updatedAt = CURRENT_TIMESTAMP');
      values.push(userId);

      db.prepare(`UPDATE "AppUser" SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      // Return updated user without password
      const updated = db.prepare(`
        SELECT u.id, u.username, u.nama, u.role, u.rtId, u.aktif, u.createdAt, u.updatedAt,
          r.namaRT, r.rw
        FROM "AppUser" u
        LEFT JOIN "RukunTetangga" r ON u.rtId = r.id
        WHERE u.id = ?
      `).get(userId);

      return NextResponse.json(updated);
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('PUT /api/admin/users/[id] error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal mengupdate user: ${msg}` }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] - Deactivate user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const db = getDB();
    try {
      // Check user exists
      const existing = db.prepare('SELECT * FROM "AppUser" WHERE id = ?').get(userId) as any;
      if (!existing) {
        return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
      }

      // Cannot deactivate superadmin
      if (existing.role === 'superadmin') {
        return NextResponse.json({ error: 'Tidak dapat menghapus akun superadmin' }, { status: 403 });
      }

      db.prepare('UPDATE "AppUser" SET aktif = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(userId);

      return NextResponse.json({ message: 'User berhasil dinonaktifkan' });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('DELETE /api/admin/users/[id] error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal menonaktifkan user: ${msg}` }, { status: 500 });
  }
}
