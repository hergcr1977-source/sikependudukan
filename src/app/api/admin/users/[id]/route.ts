import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

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
    const { username, nama, role, rtId, aktif, password } = body;

    // Check user exists
    const existing = await db.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "AppUser" WHERE id = $1`,
      userId
    );
    if (!existing.length) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Cannot change superadmin role or deactivate superadmin
    if (existing[0].role === 'superadmin' && (aktif === false || (role !== undefined && role !== 'superadmin'))) {
      return NextResponse.json({ error: 'Tidak dapat mengubah akun superadmin' }, { status: 403 });
    }

    // Build dynamic UPDATE
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (username !== undefined && username !== '') {
      // Check username uniqueness (exclude current user)
      const dup = await db.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id FROM "AppUser" WHERE username = $1 AND id != $2 LIMIT 1`,
        username, userId
      );
      if (dup.length) {
        return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
      }
      updates.push(`username = $${paramIndex}`); values.push(username); paramIndex++;
    }

    if (nama !== undefined) { updates.push(`nama = $${paramIndex}`); values.push(nama); paramIndex++; }
    if (role !== undefined) {
      if (!['admin', 'user', 'superadmin'].includes(role)) {
        return NextResponse.json({ error: 'role harus admin, user, atau superadmin' }, { status: 400 });
      }
      updates.push(`role = $${paramIndex}`); values.push(role); paramIndex++;
    }
    if (rtId !== undefined) {
      if (rtId !== null) {
        const existingRT = await db.$queryRawUnsafe<Array<{ id: number }>>(
          `SELECT id FROM "RukunTetangga" WHERE id = $1 LIMIT 1`,
          rtId
        );
        if (!existingRT.length) {
          return NextResponse.json({ error: 'RT tidak ditemukan' }, { status: 404 });
        }
      }
      updates.push(`"rtId" = $${paramIndex}`); values.push(rtId); paramIndex++;
    }
    if (aktif !== undefined) { updates.push(`aktif = $${paramIndex}`); values.push(aktif ? true : false); paramIndex++; }
    if (password !== undefined && password !== '') {
      updates.push(`password = $${paramIndex}`); values.push(password); paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
    }

    updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    values.push(userId);

    await db.$executeRawUnsafe(
      `UPDATE "AppUser" SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      ...values
    );

    // Return updated user without password
    const updated = await db.$queryRawUnsafe<Array<any>>(`
      SELECT u.id, u.username, u.nama, u.role, u."rtId", u.aktif, u."createdAt", u."updatedAt",
        r."namaRT", r.rw
      FROM "AppUser" u
      LEFT JOIN "RukunTetangga" r ON u."rtId" = r.id
      WHERE u.id = $1
    `, userId);

    return NextResponse.json(updated[0] || {});
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

    // Check user exists
    const existing = await db.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "AppUser" WHERE id = $1`,
      userId
    );
    if (!existing.length) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Cannot deactivate superadmin
    if (existing[0].role === 'superadmin') {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun superadmin' }, { status: 403 });
    }

    await db.$executeRawUnsafe(
      `UPDATE "AppUser" SET aktif = false, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
      userId
    );

    return NextResponse.json({ message: 'User berhasil dinonaktifkan' });
  } catch (error) {
    console.error('DELETE /api/admin/users/[id] error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal menonaktifkan user: ${msg}` }, { status: 500 });
  }
}
