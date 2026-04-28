/**
 * Database Initialization for Multi-RT support
 * 
 * Menambahkan tabel RukunTetangga dan AppUser,
 * serta kolom rtId ke semua tabel data yang sudah ada.
 * Data yang sudah ada akan otomatis mendapat rtId = 1 (RT.001 RW.002).
 * 
 * Run: npx tsx src/lib/db-init.ts (from sikependudukan-baru directory)
 */

import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || '/home/z/my-project/db/custom.db';

function columnExists(db: Database.Database, table: string, column: string): boolean {
  try {
    const result = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
    return result.some(r => r.name === column);
  } catch {
    return false;
  }
}

function tableExists(db: Database.Database, table: string): boolean {
  try {
    const result = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
    return !!result;
  } catch {
    return false;
  }
}

export function initDatabase(db: Database.Database) {
  console.log('🔄 Initializing multi-RT database...');

  // 1. Create RukunTetangga table
  if (!tableExists(db, 'RukunTetangga')) {
    db.exec(`
      CREATE TABLE "RukunTetangga" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "namaRT" TEXT NOT NULL DEFAULT '001',
        "rw" TEXT NOT NULL DEFAULT '002',
        "kelurahan" TEXT NOT NULL DEFAULT 'SUKAMAJU',
        "kecamatan" TEXT NOT NULL DEFAULT 'CIBUNGBULANG',
        "kabupaten" TEXT NOT NULL DEFAULT 'BOGOR',
        "provinsi" TEXT NOT NULL DEFAULT 'JAWA BARAT',
        "alamat" TEXT NOT NULL DEFAULT 'KP. CEMPLANG',
        "ketuaRT" TEXT,
        "aktif" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Created table RukunTetangga');
  }

  // 2. Create AppUser table
  if (!tableExists(db, 'AppUser')) {
    db.exec(`
      CREATE TABLE "AppUser" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "username" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "nama" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'user',
        "rtId" INTEGER,
        "aktif" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Created table AppUser');
  }

  // 3. Add rtId columns to existing tables
  const tables = [
    'Penduduk', 'PendudukSementara', 'Kejadian',
    'LaporanBulanan', 'KasRT', 'PenerimaSembako', 'SembakoSnapshot'
  ];

  for (const table of tables) {
    if (!tableExists(db, table)) {
      console.log(`  ⏭️ Table ${table} doesn't exist yet, skipping`);
      continue;
    }
    if (!columnExists(db, table, 'rtId')) {
      try {
        db.exec(`ALTER TABLE "${table}" ADD COLUMN "rtId" INTEGER NOT NULL DEFAULT 1`);
        console.log(`  ✅ Added rtId column to ${table}`);
      } catch (e) {
        console.error(`  ❌ Failed to add rtId to ${table}:`, e);
      }
    }
  }

  // 4. Seed initial data: RT.001 RW.002
  const existingRT = db.prepare(`SELECT id FROM "RukunTetangga" WHERE "namaRT" = '001' AND "rw" = '002'`).get() as { id: number } | undefined;

  if (!existingRT) {
    db.exec(`
      INSERT INTO "RukunTetangga" ("namaRT", "rw", "kelurahan", "kecamatan", "kabupaten", "provinsi", "alamat", "ketuaRT", "aktif")
      VALUES ('001', '002', 'SUKAMAJU', 'CIBUNGBULANG', 'BOGOR', 'JAWA BARAT', 'KP. CEMPLANG', 'HERMAN GOZALI', 1)
    `);
    console.log('  ✅ Seeded RT.001 RW.002');
  }

  // Get RT.001 id
  const rt001 = db.prepare(`SELECT id FROM "RukunTetangga" WHERE "namaRT" = '001' AND "rw" = '002'`).get() as { id: number };
  const rt001Id = rt001?.id || 1;

  // 5. Seed herman user (admin for RT.001)
  const existingHerman = db.prepare(`SELECT id FROM "AppUser" WHERE "username" = 'herman'`).get() as { id: number } | undefined;

  if (!existingHerman) {
    db.prepare(`
      INSERT INTO "AppUser" ("username", "password", "nama", "role", "rtId", "aktif")
      VALUES (?, ?, ?, ?, ?, 1)
    `).run('herman', 'H3rm4n77', 'HERMAN GOZALI', 'admin', rt001Id);
    console.log('  ✅ Seeded user herman (admin)');
  }

  // 6. Seed super admin
  const existingSA = db.prepare(`SELECT id FROM "AppUser" WHERE "username" = 'superadmin'`).get() as { id: number } | undefined;

  if (!existingSA) {
    db.prepare(`
      INSERT INTO "AppUser" ("username", "password", "nama", "role", "rtId", "aktif")
      VALUES (?, ?, ?, ?, NULL, 1)
    `).run('superadmin', 'SuperAdmin123!', 'SUPER ADMIN', 'superadmin');
    console.log('  ✅ Seeded user superadmin');
    console.log('  🔑 Super Admin: superadmin / SuperAdmin123!');
  }

  console.log('🎉 Database initialization complete!');
  return rt001Id;
}

// Run directly
if (require.main === module) {
  const db = new Database(DB_PATH, { readonly: false });
  initDatabase(db);
  db.close();
}
