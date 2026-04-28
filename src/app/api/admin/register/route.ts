import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || '/home/z/my-project/db/custom.db';
export const dynamic = 'force-dynamic';

function getDB() {
  return new Database(DB_PATH);
}

// POST /api/admin/register - Public registration for new RT (NO auth required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      namaRT,
      rw,
      kelurahan,
      kecamatan,
      kabupaten,
      provinsi,
      alamat,
      ketuaRT,
      adminUsername,
      adminPassword,
      adminNama,
    } = body;

    // Validate required fields
    if (!namaRT || !rw || !adminUsername || !adminPassword || !adminNama) {
      return NextResponse.json(
        { error: 'namaRT, rw, adminUsername, adminPassword, dan adminNama wajib diisi' },
        { status: 400 }
      );
    }

    if (adminPassword.length < 4) {
      return NextResponse.json(
        { error: 'Password admin minimal 4 karakter' },
        { status: 400 }
      );
    }

    const db = getDB();
    try {
      // Check if username already taken
      const existingUser = db.prepare('SELECT id FROM "AppUser" WHERE username = ?').get(adminUsername) as any;
      if (existingUser) {
        return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
      }

      // Create new RukunTetangga record
      const rtResult = db.prepare(`
        INSERT INTO "RukunTetangga" (namaRT, rw, kelurahan, kecamatan, kabupaten, provinsi, alamat, ketuaRT, aktif, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        namaRT,
        rw,
        kelurahan || 'SUKAMAJU',
        kecamatan || 'CIBUNGBULANG',
        kabupaten || 'BOGOR',
        provinsi || 'JAWA BARAT',
        alamat || 'KP. CEMPLANG',
        ketuaRT || null
      );

      const newRtId = Number(rtResult.lastInsertRowid);

      // Create new AppUser (role='admin', rtId=the new RT's id)
      db.prepare(`
        INSERT INTO "AppUser" (username, password, nama, role, rtId, aktif, createdAt, updatedAt)
        VALUES (?, ?, ?, 'admin', ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        adminUsername,
        adminPassword,
        adminNama,
        newRtId
      );

      return NextResponse.json(
        {
          message: 'Registrasi berhasil! RT dan admin berhasil dibuat.',
          rtId: newRtId,
          adminUsername: adminUsername,
        },
        { status: 201 }
      );
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('POST /api/admin/register error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal registrasi: ${msg}` }, { status: 500 });
  }
}
