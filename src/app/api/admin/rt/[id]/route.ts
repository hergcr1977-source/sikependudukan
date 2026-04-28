import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

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

    // Check RT exists
    const existing = await db.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "RukunTetangga" WHERE id = $1`,
      rtId
    );
    if (!existing.length) {
      return NextResponse.json({ error: 'RT tidak ditemukan' }, { status: 404 });
    }

    // Build dynamic UPDATE
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (namaRT !== undefined) { updates.push(`"namaRT" = $${paramIndex}`); values.push(namaRT); paramIndex++; }
    if (rw !== undefined) { updates.push(`rw = $${paramIndex}`); values.push(rw); paramIndex++; }
    if (kelurahan !== undefined) { updates.push(`kelurahan = $${paramIndex}`); values.push(kelurahan); paramIndex++; }
    if (kecamatan !== undefined) { updates.push(`kecamatan = $${paramIndex}`); values.push(kecamatan); paramIndex++; }
    if (kabupaten !== undefined) { updates.push(`kabupaten = $${paramIndex}`); values.push(kabupaten); paramIndex++; }
    if (provinsi !== undefined) { updates.push(`provinsi = $${paramIndex}`); values.push(provinsi); paramIndex++; }
    if (alamat !== undefined) { updates.push(`alamat = $${paramIndex}`); values.push(alamat); paramIndex++; }
    if (ketuaRT !== undefined) { updates.push(`"ketuaRT" = $${paramIndex}`); values.push(ketuaRT); paramIndex++; }
    if (aktif !== undefined) { updates.push(`aktif = $${paramIndex}`); values.push(aktif ? true : false); paramIndex++; }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
    }

    updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    values.push(rtId);

    await db.$executeRawUnsafe(
      `UPDATE "RukunTetangga" SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      ...values
    );

    const updated = await db.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "RukunTetangga" WHERE id = $1`,
      rtId
    );
    return NextResponse.json(updated[0] || {});
  } catch (error) {
    console.error('PUT /api/admin/rt/[id] error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal mengupdate RT: ${msg}` }, { status: 500 });
  }
}

// DELETE /api/admin/rt/[id] - Soft delete RT (set aktif=false)
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

    // Check RT exists
    const existing = await db.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "RukunTetangga" WHERE id = $1`,
      rtId
    );
    if (!existing.length) {
      return NextResponse.json({ error: 'RT tidak ditemukan' }, { status: 404 });
    }

    // Soft delete the RT
    await db.$executeRawUnsafe(
      `UPDATE "RukunTetangga" SET aktif = false, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
      rtId
    );

    // Soft delete all active users of that RT
    const userResult = await db.$executeRawUnsafe(
      `UPDATE "AppUser" SET aktif = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "rtId" = $1 AND aktif = true`,
      rtId
    );

    return NextResponse.json({
      message: `RT berhasil dinonaktifkan. ${userResult} user juga dinonaktifkan.`,
      deactivatedUsers: Number(userResult),
    });
  } catch (error) {
    console.error('DELETE /api/admin/rt/[id] error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal menghapus RT: ${msg}` }, { status: 500 });
  }
}
