import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, requireAuth, isAuthError } from '@/lib/auth-server';

// Helper: pastikan tabel KasRT ada, jika belum buat otomatis (one-time per instance)
let _kasTableEnsured = false;
async function ensureTable() {
  if (_kasTableEnsured) return;
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
    _kasTableEnsured = true;
  } catch (e) {
    _kasTableEnsured = true;
    console.error('ensureTable error:', e);
  }
}

// GET - ambil semua data kas RT
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthError(auth)) return auth;

    await ensureTable();

    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');
    const jenis = searchParams.get('jenis');

    let sql = 'SELECT * FROM "KasRT" WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (auth.rtId) {
      sql += ` AND "rtId" = $${paramIndex++}`;
      params.push(auth.rtId);
    }

    if (bulan && tahun && bulan !== '0') {
      const startDate = new Date(parseInt(tahun), parseInt(bulan) - 1, 1);
      const endDate = new Date(parseInt(tahun), parseInt(bulan), 0, 23, 59, 59);
      sql += ` AND "tanggal" >= $${paramIndex++} AND "tanggal" <= $${paramIndex++}`;
      params.push(startDate, endDate);
    } else if (tahun) {
      const startDate = new Date(parseInt(tahun), 0, 1);
      const endDate = new Date(parseInt(tahun), 11, 31, 23, 59, 59);
      sql += ` AND "tanggal" >= $${paramIndex++} AND "tanggal" <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    if (jenis) {
      sql += ` AND "jenis" = $${paramIndex++}`;
      params.push(jenis);
    }

    sql += ' ORDER BY "tanggal" DESC';

    const data = await db.$queryRawUnsafe(sql, ...params);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/kas-rt error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data kas' }, { status: 500 });
  }
}

// POST - tambah data kas baru
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;
    const body = await request.json();
    const { tanggal, jenis, jumlah, keterangan } = body;

    if (!tanggal || !jenis || !jumlah) {
      return NextResponse.json({ error: 'Tanggal, jenis, dan jumlah wajib diisi' }, { status: 400 });
    }

    if (jenis !== 'PEMASUKAN' && jenis !== 'PENGELUARAN') {
      return NextResponse.json({ error: 'Jenis harus PEMASUKAN atau PENGELUARAN' }, { status: 400 });
    }

    if (jumlah <= 0) {
      return NextResponse.json({ error: 'Jumlah harus lebih dari 0' }, { status: 400 });
    }

    // Pastikan tabel ada
    await ensureTable();

    // Gunakan raw SQL INSERT
    const result = await db.$queryRawUnsafe<any[]>(
      `INSERT INTO "KasRT" ("rtId", "tanggal", "jenis", "jumlah", "keterangan", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      auth.rtId || 1,
      new Date(tanggal),
      jenis,
      Number(jumlah),
      keterangan || ''
    );

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('POST /api/kas-rt error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal menambah data kas: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}
