import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT - update data kas
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, tanggal, jenis, jumlah, keterangan } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    // Cek data ada
    const existing = await db.$queryRawUnsafe(
      `SELECT * FROM "KasRT" WHERE "id" = $1`,
      Number(id)
    );
    if (!existing || (existing as any[]).length === 0) {
      return NextResponse.json({ error: 'Data kas tidak ditemukan' }, { status: 404 });
    }

    // Bangun query UPDATE dinamis
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (tanggal) {
      setClauses.push(`"tanggal" = $${paramIndex++}`);
      params.push(new Date(tanggal));
    }
    if (jenis) {
      setClauses.push(`"jenis" = $${paramIndex++}`);
      params.push(jenis);
    }
    if (jumlah !== undefined && jumlah !== null) {
      setClauses.push(`"jumlah" = $${paramIndex++}`);
      params.push(Number(jumlah));
    }
    if (keterangan !== undefined) {
      setClauses.push(`"keterangan" = $${paramIndex++}`);
      params.push(keterangan);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
    }

    setClauses.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    params.push(Number(id));

    const sql = `UPDATE "KasRT" SET ${setClauses.join(', ')} WHERE "id" = $${paramIndex} RETURNING *`;
    const result = await db.$queryRawUnsafe(sql, ...params);

    return NextResponse.json((result as any[])[0]);
  } catch (error) {
    console.error('PUT /api/kas-rt/[id] error:', error);
    return NextResponse.json({ error: 'Gagal mengupdate data kas' }, { status: 500 });
  }
}

// DELETE - hapus data kas
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    // Cek data ada
    const existing = await db.$queryRawUnsafe(
      `SELECT * FROM "KasRT" WHERE "id" = $1`,
      Number(id)
    );
    if (!existing || (existing as any[]).length === 0) {
      return NextResponse.json({ error: 'Data kas tidak ditemukan' }, { status: 404 });
    }

    await db.$executeRawUnsafe(`DELETE FROM "KasRT" WHERE "id" = $1`, Number(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/kas-rt/[id] error:', error);
    return NextResponse.json({ error: 'Gagal menghapus data kas' }, { status: 500 });
  }
}
