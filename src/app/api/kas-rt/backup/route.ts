import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, requireAuth, isAuthError } from '@/lib/auth-server';
import { BULAN } from '@/lib/constants';

export const dynamic = 'force-dynamic';

function errorMsg(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

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
    return NextResponse.json({ error: `Gagal mengambil riwayat backup: ${errorMsg(error)}` }, { status: 500 });
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

    if (bulan === undefined || bulan === null || !tahun) {
      return NextResponse.json({ error: 'Bulan dan tahun wajib diisi' }, { status: 400 });
    }

    // Step 1: Pastikan tabel KasRT ada
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "KasRT" (
          "id" SERIAL PRIMARY KEY,
          "rtId" INTEGER NOT NULL DEFAULT 1,
          "tanggal" TIMESTAMP(3) NOT NULL,
          "jenis" TEXT NOT NULL,
          "jumlah" INTEGER NOT NULL,
          "keterangan" TEXT NOT NULL DEFAULT '',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (createErr) {
      console.error('Create KasRT table error (non-fatal):', createErr);
    }

    // Step 2: Fetch kas data
    const b = parseInt(bulan);
    const t = parseInt(tahun);
    let sql = 'SELECT * FROM "KasRT" WHERE "rtId" = $1';
    const params: any[] = [rtId];
    let paramIndex = 2;

    if (b !== 0) {
      const startDate = new Date(t, b - 1, 1);
      const endDate = new Date(t, b, 0, 23, 59, 59);
      sql += ` AND "tanggal" >= $${paramIndex++} AND "tanggal" <= $${paramIndex++}`;
      params.push(startDate, endDate);
    } else {
      const startDate = new Date(t, 0, 1);
      const endDate = new Date(t, 11, 31, 23, 59, 59);
      sql += ` AND "tanggal" >= $${paramIndex++} AND "tanggal" <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    sql += ' ORDER BY "tanggal" ASC';
    const kasData = await db.$queryRawUnsafe(sql, ...params);

    // Step 3: Calculate summary
    const allKas = kasData as any[];
    const totalPemasukan = allKas.filter((k: any) => k.jenis === 'PEMASUKAN').reduce((s: number, k: any) => s + Number(k.jumlah), 0);
    const totalPengeluaran = allKas.filter((k: any) => k.jenis === 'PENGELUARAN').reduce((s: number, k: any) => s + Number(k.jumlah), 0);
    const saldo = totalPemasukan - totalPengeluaran;

    const backupData = {
      period: { bulan: b, tahun: t },
      totalPemasukan,
      totalPengeluaran,
      saldo,
      jumlahTransaksi: allKas.length,
      transactions: allKas,
      savedAt: new Date().toISOString(),
    };

    // Step 4: Pastikan tabel KasSnapshot ada
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
    } catch (createErr) {
      console.error('Create KasSnapshot table error (non-fatal):', createErr);
    }

    // Step 5: Upsert snapshot
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
      message: `Backup kas ${b === 0 ? '' : `bulan ${bulan} `}tahun ${tahun} berhasil disimpan`,
      summary: {
        pemasukan: totalPemasukan,
        pengeluaran: totalPengeluaran,
        saldo,
        transaksi: allKas.length,
      },
    });
  } catch (error) {
    console.error('POST /api/kas-rt/backup error:', error);
    return NextResponse.json({ error: `Gagal menyimpan backup: ${errorMsg(error)}` }, { status: 500 });
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
    return NextResponse.json({ error: `Gagal menghapus backup: ${errorMsg(error)}` }, { status: 500 });
  }
}
