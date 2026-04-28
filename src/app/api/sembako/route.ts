import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin, requireAuth, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// Helper: ensure PenerimaSembako table exists (auto-create if missing, one-time per instance)
let _sembakoTableEnsured = false;
async function ensureTable() {
  if (_sembakoTableEnsured) return;
  try {
    await db.$queryRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PenerimaSembako" (
        "id" SERIAL PRIMARY KEY,
        "rtId" INTEGER NOT NULL DEFAULT 1,
        "noKK" TEXT NOT NULL,
        "nik" TEXT NOT NULL,
        "namaLengkap" TEXT NOT NULL,
        "jenisKelamin" TEXT NOT NULL,
        "statusKeluarga" TEXT NOT NULL,
        "tanggalLahir" TEXT NOT NULL DEFAULT '',
        "alamat" TEXT NOT NULL DEFAULT 'KP. CEMPLANG',
        "rt" TEXT NOT NULL DEFAULT '001',
        "rw" TEXT NOT NULL DEFAULT '002',
        "keterangan" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e: unknown) {
    // Ignore "already exists" errors
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('already exists')) {
      console.error('Failed to create PenerimaSembako table:', msg);
    }
  }
  _sembakoTableEnsured = true;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthError(auth)) return auth;

    await ensureTable();

    let sql = `SELECT * FROM "PenerimaSembako"`;
    const params: any[] = [];
    if (auth.rtId) {
      sql += ` WHERE "rtId" = $1`;
      params.push(auth.rtId);
    }
    sql += ` ORDER BY "namaLengkap" ASC`;

    const penerima = await db.$queryRawUnsafe<Array<{
      id: number;
      noKK: string;
      nik: string;
      namaLengkap: string;
      jenisKelamin: string;
      statusKeluarga: string;
      tanggalLahir: string;
      alamat: string;
      rt: string;
      rw: string;
      keterangan: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>>(sql, ...params);

    return NextResponse.json(penerima);
  } catch (error) {
    console.error('[Sembako GET] Error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data penerima sembako' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    await ensureTable();

    const body = await request.json();
    const {
      noKK, nik, namaLengkap, jenisKelamin, statusKeluarga,
      tanggalLahir, alamat, rt, rw, keterangan,
    } = body;

    if (!noKK || !nik || !namaLengkap) {
      return NextResponse.json({ error: 'No KK, NIK, dan Nama Lengkap wajib diisi' }, { status: 400 });
    }

    // Check duplicate NIK
    const existing = await db.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM "PenerimaSembako" WHERE "nik" = $1 AND ("rtId" = $2 OR $2 = 0)`,
      nik,
      auth.rtId || 1
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'NIK sudah terdaftar sebagai penerima sembako' }, { status: 400 });
    }

    const result = await db.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO "PenerimaSembako" ("rtId", "noKK", "nik", "namaLengkap", "jenisKelamin", "statusKeluarga", "tanggalLahir", "alamat", "rt", "rw", "keterangan")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      auth.rtId || 1,
      noKK, nik, namaLengkap, jenisKelamin, statusKeluarga, tanggalLahir || '',
      alamat || 'KP. CEMPLANG', rt || '001', rw || '002', keterangan || null
    );

    revalidatePath('/api/sembako');
    return NextResponse.json({ message: 'Penerima sembako berhasil ditambahkan', id: result[0]?.id }, { status: 201 });
  } catch (error) {
    console.error('[Sembako POST] Error:', error);
    return NextResponse.json({ error: 'Gagal menambah penerima sembako' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    await ensureTable();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const deleteAll = searchParams.get('all');

    if (deleteAll === 'true') {
      let countSql = `SELECT COUNT(*)::bigint as count FROM "PenerimaSembako"`;
      const countParams: any[] = [];
      if (auth.rtId) {
        countSql += ` WHERE "rtId" = $1`;
        countParams.push(auth.rtId);
      }
      const countResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(countSql, ...countParams);
      const count = Number(countResult[0]?.count || 0);

      if (auth.rtId) {
        await db.$executeRawUnsafe(`DELETE FROM "PenerimaSembako" WHERE "rtId" = $1`, auth.rtId);
      } else {
        await db.$executeRawUnsafe(`DELETE FROM "PenerimaSembako"`);
      }

      revalidatePath('/api/sembako');
      return NextResponse.json({ message: `Semua data penerima sembako berhasil dihapus (${count} data)` });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
    }

    await db.$executeRawUnsafe(`DELETE FROM "PenerimaSembako" WHERE "id" = $1 AND ("rtId" = $2 OR $2 = 0)`, parseInt(id), auth.rtId || 1);

    revalidatePath('/api/sembako');
    return NextResponse.json({ message: 'Data penerima sembako berhasil dihapus' });
  } catch (error) {
    console.error('[Sembako DELETE] Error:', error);
    return NextResponse.json({ error: 'Gagal menghapus data penerima sembako' }, { status: 500 });
  }
}
