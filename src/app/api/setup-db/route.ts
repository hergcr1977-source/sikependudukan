import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getColumns(tableName: string): Promise<string[]> {
  // PostgreSQL table names are case-insensitive; information_schema stores them lowercase
  const result = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName.toLowerCase()}'`
  );
  return result.map(r => r.column_name.toLowerCase());
}

async function ensureColumn(tableName: string, column: string, type: string, defaultValue?: string) {
  try {
    const columns = await getColumns(tableName);
    if (!columns.includes(column.toLowerCase())) {
      const sql = defaultValue
        ? `ALTER TABLE "${tableName}" ADD COLUMN "${column}" ${type} DEFAULT ${defaultValue}`
        : `ALTER TABLE "${tableName}" ADD COLUMN "${column}" ${type}`;
      await db.$executeRawUnsafe(sql);
      return `Added ${tableName}.${column}`;
    }
    return null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Ignore "already exists" errors (race condition)
    if (msg.includes('already exists')) return null;
    return `Error ${tableName}.${column}: ${msg.substring(0, 100)}`;
  }
}

export async function GET() {
  try {
    const results: string[] = [];

    // Penduduk columns
    const pendudukMigrations = [
      ['desil', 'TEXT'],
      ['alamat', 'TEXT', "'KP. CEMPLANG'"],
      ['rt', 'TEXT', "'001'"],
      ['rw', 'TEXT', "'002'"],
      ['kelurahan', 'TEXT', "'SUKAMAJU'"],
      ['kecamatan', 'TEXT', "'CIBUNGBULANG'"],
      ['kabupaten', 'TEXT', "'BOGOR'"],
      ['provinsi', 'TEXT', "'JAWA BARAT'"],
      ['keterangan', 'TEXT'],
      ['namaPanggilan', 'TEXT'],
      ['noHP', 'TEXT'],
      ['bantuan', 'TEXT', "'[]'"],
      ['bpjs', 'TEXT'],
      ['punyaKTP', 'TEXT', "'BELUM'"],
    ] as const;

    for (const [col, type, defaultVal] of pendudukMigrations) {
      const result = await ensureColumn('Penduduk', col, type, defaultVal);
      if (result) results.push(result);
    }

    // PendudukSementara columns
    const sementaraMigrations = [
      ['alamat', 'TEXT', "'KP. CEMPLANG'"],
      ['rt', 'TEXT', "'001'"],
      ['rw', 'TEXT', "'002'"],
      ['kelurahan', 'TEXT', "'SUKAMAJU'"],
      ['kecamatan', 'TEXT', "'CIBUNGBULANG'"],
      ['kabupaten', 'TEXT', "'BOGOR'"],
      ['provinsi', 'TEXT', "'JAWA BARAT'"],
      ['keterangan', 'TEXT'],
      ['bantuan', 'TEXT', "'[]'"],
      ['bpjs', 'TEXT'],
      ['namaPanggilan', 'TEXT'],
      ['noHP', 'TEXT'],
    ] as const;

    for (const [col, type, defaultVal] of sementaraMigrations) {
      const result = await ensureColumn('PendudukSementara', col, type, defaultVal);
      if (result) results.push(result);
    }

    // Drop alamatLengkap columns (no longer used)
    for (const tableName of ['Penduduk', 'PendudukSementara']) {
      try {
        const columns = await getColumns(tableName);
        if (columns.includes('alamatlengkap')) {
          await db.$executeRawUnsafe(`ALTER TABLE "${tableName}" DROP COLUMN "alamatLengkap"`);
          results.push(`Dropped ${tableName}.alamatLengkap`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push(`Warning: Could not drop alamatLengkap from ${tableName}: ${msg.substring(0, 100)}`);
      }
    }

    // LaporanBulanan columns
    const laporanResult = await ensureColumn('LaporanBulanan', 'keterangan', 'TEXT');
    if (laporanResult) results.push(laporanResult);

    // === Add rtId columns to all data tables (multi-RT) ===
    const rtIdTables = [
      'Penduduk', 'PendudukSementara', 'Kejadian',
      'LaporanBulanan', 'KasRT', 'PenerimaSembako', 'SembakoSnapshot'
    ];
    for (const table of rtIdTables) {
      const r = await ensureColumn(table, 'rtId', 'INTEGER', 1);
      if (r) results.push(r);
    }

    // KasRT table - create if not exists
    try {
      const tableCheck = await db.$queryRawUnsafe<Array<{ table_name: string }>>(
        `SELECT table_name FROM information_schema.tables WHERE table_name = 'kasrt'`
      );
      if (tableCheck.length === 0) {
        await db.$executeRawUnsafe(`
          CREATE TABLE "KasRT" (
            "id" SERIAL PRIMARY KEY,
            "tanggal" TIMESTAMP(3) NOT NULL,
            "jenis" TEXT NOT NULL,
            "jumlah" INTEGER NOT NULL,
            "keterangan" TEXT NOT NULL DEFAULT '',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        results.push('Created table KasRT');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('already exists')) {
        results.push(`Error creating KasRT: ${msg.substring(0, 100)}`);
      }
    }

    return NextResponse.json({
      message: 'Database siap.',
      changes: results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      message: 'Migration error',
      error: String(error),
    }, { status: 500 });
  }
}
