/**
 * Database migration: ensure rtId columns exist in all data tables.
 * Called from page.tsx (server component) before any data is fetched.
 */
import { db } from '@/lib/db';

const MIGRATION_KEY = '__db_migrated_v1';

// In-memory flag to avoid running migration multiple times in the same server process
let migrated = false;

export async function ensureRtIdColumns() {
  // Skip if already migrated in this server instance
  if (migrated) return;
  migrated = true;

  const tables = [
    'Penduduk', 'PendudukSementara', 'Kejadian',
    'LaporanBulanan', 'KasRT', 'PenerimaSembako', 'SembakoSnapshot'
  ];

  for (const table of tables) {
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
        // Add rtId column with DEFAULT 1 (all existing data gets rtId=1 = RT.001)
        await db.$executeRawUnsafe(
          `ALTER TABLE "${table}" ADD COLUMN "rtId" INTEGER NOT NULL DEFAULT 1`
        );
        console.log(`[migrate] Added rtId column to ${table}`);
      }

      // Ensure existing data has rtId set (fix NULLs just in case)
      await db.$executeRawUnsafe(
        `UPDATE "${table}" SET "rtId" = 1 WHERE "rtId" IS NULL`
      );
    } catch (e) {
      console.log(`[migrate] ${table}:`, e);
    }
  }
}

export async function ensureAuthTables() {
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
    console.log('[migrate] Auth tables:', e);
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
}
