import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    // Check if username already taken
    const existingUser = await db.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM "AppUser" WHERE username = $1 LIMIT 1`,
      adminUsername
    );
    if (existingUser.length) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    // Create new RukunTetangga record with RETURNING id
    const rtInserted = await db.$queryRawUnsafe<Array<{ id: number }>>(`
      INSERT INTO "RukunTetangga" ("namaRT", "rw", "kelurahan", "kecamatan", "kabupaten", "provinsi", "alamat", "ketuaRT", "aktif", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING "id"
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

    const newRtId = Number(rtInserted[0]?.id);
    if (!newRtId) {
      return NextResponse.json({ error: 'Gagal membuat RT' }, { status: 500 });
    }

    // Create new AppUser (role='admin', rtId=the new RT's id)
    await db.$executeRawUnsafe(`
      INSERT INTO "AppUser" ("username", "password", "nama", "role", "rtId", "aktif", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'admin', $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
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
  } catch (error) {
    console.error('POST /api/admin/register error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal registrasi: ${msg}` }, { status: 500 });
  }
}
