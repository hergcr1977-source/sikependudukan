import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, requireAuth, isAuthError } from '@/lib/auth-server';
import { BULAN } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// GET /api/kas-rt/backup - List saved backups
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthError(auth)) return auth;
    const rtId = auth.rtId || 1;

    // Ensure table exists
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "KasSnapshot" (
          "id" SERIAL PRIMARY KEY,
          "rtId" INTEGER NOT NULL DEFAULT 1,
          "bulan" INTEGER NOT NULL DEFAULT 0,
          "tahun" INTEGER NOT NULL,
          "data" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {
      // Table might already exist
    }

    const rows = await db.$queryRawUnsafe<Array<{
      id: number;
      rtId: number;
      bulan: number;
      tahun: number;
      data: string;
      createdAt: Date;
      updatedAt: Date;
    }>>(
      `SELECT "id", "rtId", "bulan", "tahun", "data", "createdAt", "updatedAt" FROM "KasSnapshot" WHERE "rtId" = $1 ORDER BY "tahun" DESC, "bulan" DESC`,
      rtId
    );

    const backups = rows.map(r => {
      let summary = null;
      try {
        summary = JSON.parse(r.data);
      } catch { /* ignore */ }
      return {
        id: r.id,
        bulan: r.bulan,
        tahun: r.tahun,
        label: r.bulan === 0 ? `Tahun ${r.tahun}` : `${BULAN[r.bulan - 1]} ${r.tahun}`,
        summary,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return NextResponse.json(backups);
  } catch (error) {
    console.error('GET /api/kas-rt/backup error:', error);
    return NextResponse.json({ error: 'Gagal mengambil riwayat backup' }, { status: 500 });
  }
}

// POST /api/kas-rt/backup - Save kas data as snapshot
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { bulan, tahun } = body;
    const rtId = auth.rtId || 1;

    if (!bulan || !tahun) {
      return NextResponse.json({ error: 'Bulan dan tahun wajib diisi' }, { status: 400 });
    }

    // Fetch all kas data for the period (or all if bulan=0)
    let sql = 'SELECT * FROM "KasRT" WHERE "rtId" = $1';
    const params: any[] = [rtId];
    let paramIndex = 2;

    if (bulan && parseInt(bulan) !== 0) {
      const startDate = new Date(parseInt(tahun), parseInt(bulan) - 1, 1);
      const endDate = new Date(parseInt(tahun), parseInt(bulan), 0, 23, 59, 59);
      sql += ` AND "tanggal" >= $${paramIndex++} AND "tanggal" <= $${paramIndex++}`;
      params.push(startDate, endDate);
    } else {
      const startDate = new Date(parseInt(tahun), 0, 1);
      const endDate = new Date(parseInt(tahun), 11, 31, 23, 59, 59);
      sql += ` AND "tanggal" >= $${paramIndex++} AND "tanggal" <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    sql += ' ORDER BY "tanggal" ASC';
    const kasData = await db.$queryRawUnsafe(sql, ...params);

    // Calculate summary
    const allKas = kasData as any[];
    const totalPemasukan = allKas.filter((k: any) => k.jenis === 'PEMASUKAN').reduce((s: number, k: any) => s + Number(k.jumlah), 0);
    const totalPengeluaran = allKas.filter((k: any) => k.jenis === 'PENGELUARAN').reduce((s: number, k: any) => s + Number(k.jumlah), 0);
    const saldo = totalPemasukan - totalPengeluaran;

    const backupData = {
      period: { bulan: parseInt(bulan), tahun: parseInt(tahun) },
      totalPemasukan,
      totalPengeluaran,
      saldo,
      jumlahTransaksi: allKas.length,
      transactions: allKas,
      savedAt: new Date().toISOString(),
    };

    // Ensure table exists
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "KasSnapshot" (
          "id" SERIAL PRIMARY KEY,
          "rtId" INTEGER NOT NULL DEFAULT 1,
          "bulan" INTEGER NOT NULL DEFAULT 0,
          "tahun" INTEGER NOT NULL,
          "data" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {
      // Table might already exist
    }

    // Upsert snapshot
    const b = parseInt(bulan);
    const t = parseInt(tahun);

    const existing = await db.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT "id" FROM "KasSnapshot" WHERE "rtId" = $1 AND "bulan" = $2 AND "tahun" = $3`,
      rtId, b, t
    );

    if (existing.length > 0) {
      await db.$executeRawUnsafe(
        `UPDATE "KasSnapshot" SET "data" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2`,
        JSON.stringify(backupData),
        existing[0].id
      );
    } else {
      await db.$executeRawUnsafe(
        `INSERT INTO "KasSnapshot" ("rtId", "bulan", "tahun", "data") VALUES ($1, $2, $3, $4)`,
        rtId, b, t, JSON.stringify(backupData)
      );
    }

    return NextResponse.json({
      success: true,
      message: `Backup kas ${parseInt(bulan) === 0 ? '' : `bulan ${bulan} `}tahun ${tahun} berhasil disimpan`,
      summary: {
        pemasukan: totalPemasukan,
        pengeluaran: totalPengeluaran,
        saldo,
        transaksi: allKas.length,
      },
    });
  } catch (error) {
    console.error('POST /api/kas-rt/backup error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan backup kas' }, { status: 500 });
  }
}

// DELETE /api/kas-rt/backup - Delete a saved backup
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;
    const rtId = auth.rtId || 1;

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');

    if (!id) {
      return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
    }

    // Verify ownership
    const existing = await db.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT "id" FROM "KasSnapshot" WHERE "id" = $1 AND "rtId" = $2`,
      id, rtId
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Backup tidak ditemukan' }, { status: 404 });
    }

    await db.$executeRawUnsafe(`DELETE FROM "KasSnapshot" WHERE "id" = $1`, id);

    return NextResponse.json({ message: 'Backup berhasil dihapus' });
  } catch (error) {
    console.error('DELETE /api/kas-rt/backup error:', error);
    return NextResponse.json({ error: 'Gagal menghapus backup' }, { status: 500 });
  }
}
