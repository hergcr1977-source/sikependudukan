import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession } from '@/lib/auth-server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Ensure auth tables exist in PostgreSQL (self-healing on first request)
async function ensureAuthTables() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RukunTetangga" (
        "id" SERIAL PRIMARY KEY,
        "namaRT" TEXT NOT NULL DEFAULT '001',
        "rw" TEXT NOT NULL DEFAULT '002',
        "kelurahan" TEXT NOT NULL DEFAULT 'SUKAMAJU',
        "kecamatan" TEXT NOT NULL DEFAULT 'CIBUNGBULANG',
        "kabupaten" TEXT NOT NULL DEFAULT 'BOGOR',
        "provinsi" TEXT NOT NULL DEFAULT 'JAWA BARAT',
        "alamat" TEXT NOT NULL DEFAULT 'KP. CEMPLANG',
        "ketuaRT" TEXT,
        "aktif" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AppUser" (
        "id" SERIAL PRIMARY KEY,
        "username" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "nama" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'user',
        "rtId" INTEGER,
        "aktif" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.log('Auth tables may already exist:', e);
  }

  // Seed RT.001 RW.002
  const existingRT = await db.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM "RukunTetangga" WHERE "namaRT" = '001' AND "rw" = '002' LIMIT 1`
  );
  let rt001Id = existingRT[0]?.id;
  if (!rt001Id) {
    await db.$executeRawUnsafe(`
      INSERT INTO "RukunTetangga" ("namaRT", "rw", "kelurahan", "kecamatan", "kabupaten", "provinsi", "alamat", "ketuaRT", "aktif")
      VALUES ('001', '002', 'SUKAMAJU', 'CIBUNGBULANG', 'BOGOR', 'JAWA BARAT', 'KP. CEMPLANG', 'HERMAN GOZALI', true)
      RETURNING "id"
    `);
    const inserted = await db.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM "RukunTetangga" WHERE "namaRT" = '001' AND "rw" = '002' LIMIT 1`
    );
    rt001Id = inserted[0]?.id;
  }

  // Seed herman user
  const existingHerman = await db.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM "AppUser" WHERE "username" = 'herman' LIMIT 1`
  );
  if (!existingHerman.length && rt001Id) {
    await db.$executeRawUnsafe(`
      INSERT INTO "AppUser" ("username", "password", "nama", "role", "rtId", "aktif")
      VALUES ('herman', 'H3rm4n77', 'HERMAN GOZALI', 'admin', ${rt001Id}, true)
    `);
  }

  // If herman exists but has no rtId, update it
  if (existingHerman.length && rt001Id) {
    const hermanData = await db.$queryRawUnsafe<Array<{ rtId: number | null }>>(
      `SELECT "rtId" FROM "AppUser" WHERE "username" = 'herman' LIMIT 1`
    );
    if (hermanData.length && hermanData[0].rtId === null) {
      await db.$executeRawUnsafe(
        `UPDATE "AppUser" SET "rtId" = $1 WHERE "username" = 'herman'`,
        rt001Id
      );
    }
  }

  // Seed superadmin
  const existingSA = await db.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM "AppUser" WHERE "username" = 'superadmin' LIMIT 1`
  );
  if (!existingSA.length) {
    await db.$executeRawUnsafe(`
      INSERT INTO "AppUser" ("username", "password", "nama", "role", "rtId", "aktif")
      VALUES ('superadmin', 'SuperAdmin123!', 'SUPER ADMIN', 'superadmin', NULL, true)
    `);
  }

  // === Add rtId column to ALL data tables (multi-RT migration) ===
  const dataTables = [
    'Penduduk', 'PendudukSementara', 'Kejadian',
    'LaporanBulanan', 'KasRT', 'PenerimaSembako', 'SembakoSnapshot'
  ];

  for (const table of dataTables) {
    try {
      // Check if table exists
      const tableCheck = await db.$queryRawUnsafe<Array<{ table_name: string }>>(
        `SELECT table_name FROM information_schema.tables WHERE table_name = $1`,
        table.toLowerCase()
      );
      if (!tableCheck.length) continue;

      // Check if rtId column exists
      const colCheck = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'rtid'`,
        table.toLowerCase()
      );

      if (!colCheck.length) {
        // Add rtId column with DEFAULT 1
        await db.$executeRawUnsafe(
          `ALTER TABLE "${table}" ADD COLUMN "rtId" INTEGER NOT NULL DEFAULT 1`
        );
        console.log(`Added rtId column to ${table}`);
      }

      // Ensure existing data has rtId set (fix NULLs)
      await db.$executeRawUnsafe(
        `UPDATE "${table}" SET "rtId" = 1 WHERE "rtId" IS NULL`
      );
    } catch (e) {
      console.log(`rtId migration for ${table}:`, e);
    }
  }

  // Also add rtId column to KasRT if it was created by setup-db (without rtId)
  try {
    const kasColCheck = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'kasrt' AND column_name = 'rtid'`
    );
    if (!kasColCheck.length) {
      await db.$executeRawUnsafe(
        `ALTER TABLE "KasRT" ADD COLUMN IF NOT EXISTS "rtId" INTEGER NOT NULL DEFAULT 1`
      );
      console.log('Added rtId column to KasRT');
    }
  } catch (e) {
    console.log('KasRT rtId migration:', e);
  }
}

async function authenticateUser(username: string, password: string) {
  try {
    const user = await db.$queryRawUnsafe<Array<any>>(`
      SELECT u."id", u."username", u."password", u."nama", u."role", u."rtId", u."aktif",
        r."namaRT", r."rw", r."kelurahan", r."kecamatan", r."kabupaten", r."provinsi", r."alamat", r."ketuaRT"
      FROM "AppUser" u
      LEFT JOIN "RukunTetangga" r ON u."rtId" = r.id
      WHERE u."username" = $1 AND u."password" = $2 AND u."aktif" = true
    `, username, password);

    if (!user.length) return null;

    const u = user[0];
    const rtInfo = u.rtId ? {
      namaRT: u.namaRT,
      rw: u.rw,
      kelurahan: u.kelurahan,
      kecamatan: u.kecamatan,
      kabupaten: u.kabupaten,
      provinsi: u.provinsi,
      alamat: u.alamat,
      ketuaRT: u.ketuaRT,
    } : null;

    return {
      username: u.username,
      nama: u.nama,
      role: u.role,
      rtId: u.rtId,
      rtInfo,
    };
  } catch (e) {
    console.error('authenticateUser error:', e);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureAuthTables();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const user = await authenticateUser(username, password);

    if (!user) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    const token = await createSession({
      username: user.username,
      role: user.role,
      nama: user.nama,
      rtId: user.rtId,
      rtInfo: user.rtInfo,
    });

    const response = NextResponse.json({
      message: 'Login berhasil',
      role: user.role,
      nama: user.nama,
      rtId: user.rtId,
      rtInfo: user.rtInfo,
    });

    response.cookies.set('session_id', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Gagal login' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 });
    }

    return NextResponse.json({
      role: session.role,
      nama: session.nama,
      username: session.username,
      rtId: session.rtId,
      rtInfo: session.rtInfo,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ error: 'Gagal memverifikasi sesi' }, { status: 500 });
  }
}
