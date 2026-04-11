import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const maxDuration = 30;

export async function GET() {
  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: [],
    errors: [],
  };

  // Step 1: Test DB connection
  try {
    const count = await db.penduduk.count();
    result.steps.push({ step: 'db_connection', ok: true, pendudukCount: count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.steps.push({ step: 'db_connection', ok: false, error: msg });
    result.errors.push(msg);
    return NextResponse.json(result, { status: 500 });
  }

  // Step 2: Get actual columns using PostgreSQL information_schema
  try {
    const cols = await db.$queryRawUnsafe(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'penduduk' ORDER BY ordinal_position`
    );
    result.pendudukColumns = (cols as Array<{ column_name: string; data_type: string; is_nullable: string; column_default: any }>).map(c => ({
      name: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable === 'YES',
      default: c.column_default,
    }));
    result.steps.push({ step: 'info_penduduk', ok: true, columnCount: result.pendudukColumns.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.steps.push({ step: 'info_penduduk', ok: false, error: msg });
    result.errors.push(msg);
  }

  // Step 3: Get actual columns in PendudukSementara table
  try {
    const cols = await db.$queryRawUnsafe(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'penduduksementara' ORDER BY ordinal_position`
    );
    result.sementaraColumns = (cols as Array<{ column_name: string; data_type: string; is_nullable: string; column_default: any }>).map(c => ({
      name: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable === 'YES',
      default: c.column_default,
    }));
    result.steps.push({ step: 'info_sementara', ok: true, columnCount: result.sementaraColumns.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.steps.push({ step: 'info_sementara', ok: false, error: msg });
    result.errors.push(msg);
  }

  // Step 4: Try a minimal test insert into Penduduk
  const testNIK = '9999999999999999';
  try {
    await db.$executeRawUnsafe(`DELETE FROM "Penduduk" WHERE "nik" = '${testNIK}'`);

    await db.$executeRawUnsafe(
      `INSERT INTO "Penduduk" ("noKK", "nik", "namaLengkap", "jenisKelamin", "statusKeluarga", "tempatLahir", "tanggalLahir", "agama", "pendidikan", "pekerjaan", "statusPerkawinan", "kewarganegaraan", "namaAyah", "namaIbu") VALUES ('9999999999999999', '${testNIK}', 'TEST IMPORT', 'LAKI-LAKI', 'KEPALA KELUARGA', 'TEST', '2000-01-01', 'ISLAM', 'SD/SEDERAJAT', 'BELUM/TIDAK BEKERJA', 'BELUM MENIKAH', 'WNI', 'TEST', 'TEST')`
    );

    await db.$executeRawUnsafe(`DELETE FROM "Penduduk" WHERE "nik" = '${testNIK}'`);
    result.steps.push({ step: 'test_insert_minimal', ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.steps.push({ step: 'test_insert_minimal', ok: false, error: msg });
    result.errors.push('INSERT FAILED: ' + msg);
  }

  // Step 5: Compare expected vs actual columns
  const expectedPendudukCols = [
    'id', 'noKK', 'nik', 'namaLengkap', 'jenisKelamin', 'statusKeluarga',
    'tempatLahir', 'tanggalLahir', 'agama', 'pendidikan', 'pekerjaan',
    'statusPerkawinan', 'kewarganegaraan', 'namaAyah', 'namaIbu', 'namaPanggilan',
    'noHP', 'punyaKTP', 'bantuan', 'bpjs', 'desil',
    'alamat', 'rt', 'rw', 'kelurahan', 'kecamatan', 'kabupaten', 'provinsi',
    'alamatLengkap', 'keterangan', 'createdAt', 'updatedAt'
  ];
  if (result.pendudukColumns) {
    const actualColNames = result.pendudukColumns.map(c => c.name.toLowerCase());
    result.missingColumns = expectedPendudukCols.filter(c => !actualColNames.includes(c.toLowerCase()));
    result.extraColumns = actualColNames.filter(c => !expectedPendudukCols.includes(c));
  }

  return NextResponse.json(result);
}
