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

  // Step 2: Get actual columns in Penduduk table
  try {
    const cols = await db.$queryRawUnsafe('PRAGMA table_info(Penduduk)');
    result.pendudukColumns = (cols as Array<{ name: string; type: string; notnull: number; dflt_value: any }>).map(c => ({
      name: c.name,
      type: c.type,
      notNull: c.notnull === 1,
      default: c.dflt_value,
    }));
    result.steps.push({ step: 'pragma_penduduk', ok: true, columnCount: result.pendudukColumns.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.steps.push({ step: 'pragma_penduduk', ok: false, error: msg });
    result.errors.push(msg);
  }

  // Step 3: Get actual columns in PendudukSementara table
  try {
    const cols = await db.$queryRawUnsafe('PRAGMA table_info(PendudukSementara)');
    result.sementaraColumns = (cols as Array<{ name: string; type: string; notnull: number; dflt_value: any }>).map(c => ({
      name: c.name,
      type: c.type,
      notNull: c.notnull === 1,
      default: c.dflt_value,
    }));
    result.steps.push({ step: 'pragma_sementara', ok: true, columnCount: result.sementaraColumns.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.steps.push({ step: 'pragma_sementara', ok: false, error: msg });
    result.errors.push(msg);
  }

  // Step 4: Try a minimal insert into Penduduk
  const testNIK = '9999999999999999';
  try {
    // First clean up any previous test
    await db.penduduk.deleteMany({ where: { nik: testNIK } }).catch(() => {});

    const record = await db.penduduk.create({
      data: {
        noKK: '9999999999999999',
        nik: testNIK,
        namaLengkap: 'TEST IMPORT',
        jenisKelamin: 'LAKI-LAKI',
        statusKeluarga: 'KEPALA KELUARGA',
        tempatLahir: 'TEST',
        tanggalLahir: new Date('2000-01-01'),
        agama: 'ISLAM',
        pendidikan: 'SD/SEDERAJAT',
        pekerjaan: 'BELUM/TIDAK BEKERJA',
        statusPerkawinan: 'BELUM MENIKAH',
        kewarganegaraan: 'WNI',
        namaAyah: 'TEST',
        namaIbu: 'TEST',
        namaPanggilan: null,
        noHP: null,
        punyaKTP: 'BELUM',
        bantuan: '[]',
        bpjs: null,
        alamat: 'KP. CEMPLANG',
        rt: '001',
        rw: '002',
        kelurahan: 'SUKAMAJU',
        kecamatan: 'CIBUNGBULANG',
        kabupaten: 'BOGOR',
        provinsi: 'JAWA BARAT',
        alamatLengkap: 'KP. CEMPLANG, RT.001 RW.002, KELURAHAN/DESA SUKAMAJU, KECAMATAN CIBUNGBULANG, KABUPATEN/KOTA BOGOR, PROVINSI JAWA BARAT',
        keterangan: null,
      },
    });

    // Clean up
    await db.penduduk.delete({ where: { id: record.id } });

    result.steps.push({ step: 'insert_penduduk_full', ok: true, testId: record.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.steps.push({ step: 'insert_penduduk_full', ok: false, error: msg });
    result.errors.push('INSERT FAILED: ' + msg);

    // Try minimal insert (required fields only)
    try {
      await db.penduduk.deleteMany({ where: { nik: testNIK } }).catch(() => {});
      const minimal = await db.penduduk.create({
        data: {
          noKK: '9999999999999999',
          nik: testNIK,
          namaLengkap: 'TEST MINIMAL',
          jenisKelamin: 'LAKI-LAKI',
          statusKeluarga: 'KEPALA KELUARGA',
          tempatLahir: 'TEST',
          tanggalLahir: new Date('2000-01-01'),
          agama: 'ISLAM',
          pendidikan: 'SD/SEDERAJAT',
          pekerjaan: 'BELUM/TIDAK BEKERJA',
          statusPerkawinan: 'BELUM MENIKAH',
          kewarganegaraan: 'WNI',
          namaAyah: 'TEST',
          namaIbu: 'TEST',
        },
      });
      await db.penduduk.delete({ where: { id: minimal.id } });
      result.steps.push({ step: 'insert_penduduk_minimal', ok: true, note: 'Minimal insert works but full insert failed. Some columns are missing in DB.' });
    } catch (e2: unknown) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      result.steps.push({ step: 'insert_penduduk_minimal', ok: false, error: msg2 });
      result.errors.push('MINIMAL INSERT ALSO FAILED: ' + msg2);

      // Try with raw SQL
      try {
        await db.$executeRawUnsafe(`INSERT INTO Penduduk (noKK, nik, namaLengkap, jenisKelamin, statusKeluarga, tempatLahir, tanggalLahir, agama, pendidikan, pekerjaan, statusPerkawinan, kewarganegaraan, namaAyah, namaIbu) VALUES ('9999999999999999', '${testNIK}', 'TEST SQL', 'LAKI-LAKI', 'KEPALA KELUARGA', 'TEST', '2000-01-01', 'ISLAM', 'SD/SEDERAJAT', 'BELUM/TIDAK BEKERJA', 'BELUM MENIKAH', 'WNI', 'TEST', 'TEST')`);
        await db.$executeRawUnsafe(`DELETE FROM Penduduk WHERE nik = '${testNIK}'`);
        result.steps.push({ step: 'insert_penduduk_raw_sql', ok: true, note: 'Raw SQL works. Prisma schema may be out of sync.' });
      } catch (e3: unknown) {
        const msg3 = e3 instanceof Error ? e3.message : String(e3);
        result.steps.push({ step: 'insert_penduduk_raw_sql', ok: false, error: msg3 });
        result.errors.push('RAW SQL ALSO FAILED: ' + msg3);
      }
    }
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
    const actualColNames = result.pendudukColumns.map(c => c.name);
    result.missingColumns = expectedPendudukCols.filter(c => !actualColNames.includes(c));
    result.extraColumns = actualColNames.filter(c => !expectedPendudukCols.includes(c));
  }

  return NextResponse.json(result);
}
