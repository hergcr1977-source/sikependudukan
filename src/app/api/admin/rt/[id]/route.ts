import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireSuperAdmin, isAuthError } from '@/lib/auth-server';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || '/home/z/my-project/db/custom.db';
export const dynamic = 'force-dynamic';

function getDB() {
  return new Database(DB_PATH);
}

// PUT /api/admin/rt/[id] - Update RT
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const rtId = parseInt(id, 10);
    if (isNaN(rtId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const { namaRT, rw, kelurahan, kecamatan, kabupaten, provinsi, alamat, ketuaRT, aktif } = body;

    const db = getDB();
    try {
      // Check RT exists
      const existing = db.prepare('SELECT * FROM "RukunTetangga" WHERE id = ?').get(rtId) as any;
      if (!existing) {
        return NextResponse.json({ error: 'RT tidak ditemukan' }, { status: 404 });
      }

      // Build dynamic UPDATE
      const updates: string[] = [];
      const values: any[] = [];

      if (namaRT !== undefined) { updates.push('namaRT = ?'); values.push(namaRT); }
      if (rw !== undefined) { updates.push('rw = ?'); values.push(rw); }
      if (kelurahan !== undefined) { updates.push('kelurahan = ?'); values.push(kelurahan); }
      if (kecamatan !== undefined) { updates.push('kecamatan = ?'); values.push(kecamatan); }
      if (kabupaten !== undefined) { updates.push('kabupaten = ?'); values.push(kabupaten); }
      if (provinsi !== undefined) { updates.push('provinsi = ?'); values.push(provinsi); }
      if (alamat !== undefined) { updates.push('alamat = ?'); values.push(alamat); }
      if (ketuaRT !== undefined) { updates.push('ketuaRT = ?'); values.push(ketuaRT); }
      if (aktif !== undefined) { updates.push('aktif = ?'); values.push(aktif ? 1 : 0); }

      if (updates.length === 0) {
        return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
      }

      updates.push('updatedAt = CURRENT_TIMESTAMP');
      values.push(rtId);

      db.prepare(`UPDATE "RukunTetangga" SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      const updated = db.prepare('SELECT * FROM "RukunTetangga" WHERE id = ?').get(rtId);
      return NextResponse.json(updated);
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('PUT /api/admin/rt/[id] error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal mengupdate RT: ${msg}` }, { status: 500 });
  }
}

// DELETE /api/admin/rt/[id] - Soft delete RT (set aktif=0)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const rtId = parseInt(id, 10);
    if (isNaN(rtId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const db = getDB();
    try {
      // Check RT exists
      const existing = db.prepare('SELECT * FROM "RukunTetangga" WHERE id = ?').get(rtId) as any;
      if (!existing) {
        return NextResponse.json({ error: 'RT tidak ditemukan' }, { status: 404 });
      }

      // Soft delete the RT
      db.prepare('UPDATE "RukunTetangga" SET aktif = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(rtId);

      // Soft delete all users of that RT
      const userResult = db.prepare('UPDATE "AppUser" SET aktif = 0, updatedAt = CURRENT_TIMESTAMP WHERE rtId = ? AND aktif = 1').run(rtId);

      return NextResponse.json({
        message: `RT berhasil dinonaktifkan. ${userResult.changes} user juga dinonaktifkan.`,
        deactivatedUsers: userResult.changes,
      });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('DELETE /api/admin/rt/[id] error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal menghapus RT: ${msg}` }, { status: 500 });
  }
}
