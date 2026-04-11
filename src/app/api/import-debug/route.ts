import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  ALAMAT_DEFAULT, RT_DEFAULT, RW_DEFAULT,
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
  }

  // Test 3: PendudukSementara
  try {
    const countS = await db.pendudukSementara.count();
    result.tests.sementaraConnection = { status: 'OK', count: countS };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.tests.sementaraConnection = { status: 'FAIL', error: msg };
  }

  return NextResponse.json(result);
}
