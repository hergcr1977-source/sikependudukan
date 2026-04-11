import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toUpperCase } from '@/lib/utils-kependudukan';
import {
  ALAMAT_LENGKAP_DEFAULT, ALAMAT_DEFAULT, RT_DEFAULT, RW_DEFAULT,
  KELURAHAN_DEFAULT, KECAMATAN_DEFAULT, KABUPATEN_DEFAULT, PROVINSI_DEFAULT,
} from '@/lib/constants';

export const maxDuration = 30;

// Endpoint diagnostik untuk mengecek koneksi DB dan schema
// Akses: GET /api/import-debug
export async function GET() {
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  // Test 1: Koneksi DB
  try {
    const count = await db.penduduk.count();
    result.tests.dbConnection = { status: 'OK', pendudukCount: count };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.tests.dbConnection = { status: 'FAIL', error: msg };
    return NextResponse.json(result, { status: 500 });
  }

  // Test 2: Coba insert 1 record test (lalu hapus)
  const testNIK = '9999999999999999';
  const testNoKK = '9999999999999999';
  try {
    const created = await db.penduduk.create({
      data: {
        noKK: testNoKK,
        nik: testNIK,
        namaLengkap: 'TEST IMPORT DIAGNOSTIC',
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
        alamat: ALAMAT_DEFAULT,
        rt: RT_DEFAULT,
        rw: RW_DEFAULT,
        kelurahan: KELURAHAN_DEFAULT,
        kecamatan: KECAMATAN_DEFAULT,
        kabupaten: KABUPATEN_DEFAULT,
        provinsi: PROVINSI_DEFAULT,
        alamatLengkap: ALAMAT_LENGKAP_DEFAULT,
        keterangan: null,
      },
    });
    await db.penduduk.delete({ where: { id: created.id } });
    result.tests.insertTest = {
      status: 'OK',
      message: 'Insert + Delete test record berhasil',
      recordId: created.id,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.tests.insertTest = { status: 'FAIL', error: msg };

    // Jika gagal karena alamatLengkap, coba tanpa alamatLengkap
    try {
      const created2 = await db.penduduk.create({
        data: {
          noKK: testNoKK,
          nik: testNIK,
          namaLengkap: 'TEST IMPORT DIAG',
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
          punyaKTP: 'BELUM',
          bantuan: '[]',
        },
      });
      await db.penduduk.delete({ where: { id: created2.id } });
      result.tests.insertMinimal = {
        status: 'OK',
        message: 'Insert minimal (tanpa alamatLengkap dll) berhasil - ada kolom yang hilang di DB!',
      };
    } catch (e2: unknown) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      result.tests.insertMinimal = { status: 'FAIL', error: msg2 };
    }
  }

  // Test 3: Cek kolom yang ada di tabel Penduduk via Prisma introspection
  try {
    // Coba akses berbagai field untuk cek apakah kolomnya ada
    const sample = await db.penduduk.findFirst({
      select: {
        id: true, noKK: true, nik: true, namaLengkap: true,
        alamatLengkap: true, desil: true, bpjs: true, bantuan: true,
        namaPanggilan: true, noHP: true, punyaKTP: true,
        alamat: true, rt: true, rw: true, kelurahan: true,
        kecamatan: true, kabupaten: true, provinsi: true, keterangan: true,
      },
    });
    result.tests.schemaCheck = {
      status: sample ? 'OK (all columns exist)' : 'OK (table empty, schema assumed correct)',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.tests.schemaCheck = { status: 'FAIL', error: msg };
  }

  // Test 4: PendudukSementara
  try {
    const countS = await db.pendudukSementara.count();
    result.tests.sementaraConnection = { status: 'OK', count: countS };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.tests.sementaraConnection = { status: 'FAIL', error: msg };
  }

  return NextResponse.json(result);
}
