/**
 * Database migration: one-time migration runner.
 * Uses global flags so migrations only run ONCE per serverless instance,
 * NOT on every request. This fixes the slow loading issue.
 */
import { db } from '@/lib/db';

// Global flags — migration hanya jalan sekali per server instance (cold start)
let _migrationsDone = false;
let _migrationPromise: Promise<void> | null = null;

export async function ensureRtIdColumns() {
  if (_migrationsDone) return;
  if (_migrationPromise) return _migrationPromise;

  _migrationPromise = _runRtIdMigration();
  return _migrationPromise;
}

async function _runRtIdMigration() {
  try {
    const tables = [
      'Penduduk', 'PendudukSementara', 'Kejadian',
      'LaporanBulanan', 'KasRT', 'PenerimaSembako', 'SembakoSnapshot'
    ];

    // Batch check: satu query untuk cek semua kolom sekaligus
    const existingCols = await db.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.columns
       WHERE column_name = 'rtid'
       AND table_name IN (${tables.map(t => `'${t.toLowerCase()}'`).join(',')})`
    );
    const existingSet = new Set(existingCols.map(r => r.table_name));

    for (const table of tables) {
      if (existingSet.has(table.toLowerCase())) continue;

      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "rtId" INTEGER NOT NULL DEFAULT 1`
        );
        console.log(`[migrate] Added rtId column to ${table}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('already exists') && !msg.includes('duplicate')) {
          console.log(`[migrate] ${table}:`, msg.substring(0, 200));
        }
      }
    }
  } finally {
    _migrationsDone = true;
  }
}

export async function ensureAuthTables() {
  if (_migrationsDone) return;
  if (_migrationPromise) return _migrationPromise;

  _migrationPromise = _runAuthMigration();
  return _migrationPromise;
}

async function _runAuthMigration() {
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

    // Add keterangan column to LaporanBulanan if missing
    await db.$executeRawUnsafe(
      `ALTER TABLE "LaporanBulanan" ADD COLUMN IF NOT EXISTS "keterangan" TEXT`
    );
  } catch (e) {
    console.log('[migrate] Auth tables:', e);
  }

  try {
    // Seed RT.001 RW.002
    const existingRT = await db.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM "RukunTetangga" WHERE "namaRT" = '001' AND "rw" = '002' LIMIT 1`
    );
    let rt001Id = existingRT[0]?.id;
    if (!rt001Id) {
      await db.$executeRawUnsafe(`
        INSERT INTO "RukunTetangga" ("namaRT", "rw", "kelurahan", "kecamatan", "kabupaten", "provinsi", "alamat", "ketuaRT", "aktif")
        VALUES ('001', '002', 'SUKAMAJU', 'CIBUNGBULANG', 'BOGOR', 'JAWA BARAT', 'KP. CEMPLANG', 'HERMAN GOZALI', true)
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
  } finally {
    _migrationsDone = true;
  }
}

/**
 * Run all migrations once — call this once at startup or first API call.
 * Combines both auth tables and rtId columns into a single operation.
 */
export async function runMigrationsOnce() {
  if (_migrationsDone) return;
  if (_migrationPromise) return _migrationPromise;

  _migrationPromise = (async () => {
    try {
      await _runAuthMigration();
    } catch (e) {
      console.error('[migrate] Auth migration error:', e);
    }
    try {
      await _runRtIdMigration();
    } catch (e) {
      console.error('[migrate] rtId migration error:', e);
    }
  })();

  return _migrationPromise;
}
