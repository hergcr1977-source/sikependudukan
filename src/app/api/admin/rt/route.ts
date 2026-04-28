import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// GET /api/admin/rt - List all RTs
export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthError(auth)) return auth;

    const rows = await db.$queryRawUnsafe<Array<any>>(`
      SELECT r.*,
        (SELECT COUNT(*)::int FROM "Penduduk" WHERE "rtId" = r.id) as "totalPenduduk",
        (SELECT COUNT(*)::int FROM "AppUser" WHERE "rtId" = r.id AND aktif = true) as "totalUsers"
      FROM "RukunTetangga" r
      ORDER BY r.id
    `);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/admin/rt error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data RT' }, { status: 500 });
  }
}

// POST /api/admin/rt - Create new RT
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { namaRT, rw, kelurahan, kecamatan, kabupaten, provinsi, alamat, ketuaRT } = body;

    if (!namaRT || !rw) {
      return NextResponse.json({ error: 'namaRT dan rw wajib diisi' }, { status: 400 });
    }

    const inserted = await db.$queryRawUnsafe<Array<any>>(`
      INSERT INTO "RukunTetangga" ("namaRT", "rw", "kelurahan", "kecamatan", "kabupaten", "provinsi", "alamat", "ketuaRT", "aktif", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `,
      namaRT,
      rw,
      kelurahan || 'SUKAMAJU',
      kecamatan || 'CIBUNGBULANG',
      kabupaten || 'BOGOR',
      provinsi || 'JAWA BARAT',
      alamat || 'KP. CEMPLANG',
      ketuaRT || null
    );

    return NextResponse.json(inserted[0] || {}, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/rt error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal membuat RT: ${msg}` }, { status: 500 });
  }
}
