import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getColumns(tableName: string): Promise<string[]> {
  const result = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName.toLowerCase()}' ORDER BY ordinal_position`
  );
  return result.map(r => r.column_name);
}

async function addColumnIfMissing(tableName: string, column: string, type: string, defaultValue?: string) {
  const columns = await getColumns(tableName);
  if (!columns.includes(column.toLowerCase())) {
    const sql = defaultValue
      ? `ALTER TABLE "${tableName}" ADD COLUMN "${column}" ${type} DEFAULT ${defaultValue}`
      : `ALTER TABLE "${tableName}" ADD COLUMN "${column}" ${type}`;
    await db.$executeRawUnsafe(sql);
    return true;
  }
  return false;
}

export async function GET() {
  try {
    const added: string[] = [];

    // Ensure all tables exist by running prisma db push via raw SQL
    // Penduduk table columns
    const pendudukCols = [
      ['desil', 'TEXT'],
      ['alamatLengkap', 'TEXT'],
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

    for (const col of pendudukCols) {
      const added_col = await addColumnIfMissing('Penduduk', col[0], col[1], col[2]);
      if (added_col) added.push(`Penduduk.${col[0]}`);
    }

    // PendudukSementara table columns
    try {
      const sementaraCols = [
        ['alamatLengkap', 'TEXT'],
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

      for (const col of sementaraCols) {
        const added_col = await addColumnIfMissing('PendudukSementara', col[0], col[1], col[2]);
        if (added_col) added.push(`PendudukSementara.${col[0]}`);
      }
    } catch (e) {
      // PendudukSementara table might not exist yet
      console.warn('PendudukSementara migration skipped:', e);
    }

    // LaporanBulanan table
    try {
      await addColumnIfMissing('LaporanBulanan', 'keterangan', 'TEXT');
    } catch (e) {
      console.warn('LaporanBulanan migration skipped:', e);
    }

    return NextResponse.json({
      message: 'Database siap.',
      addedColumns: added,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      message: 'Migration error',
      error: String(error),
    }, { status: 500 });
  }
}
