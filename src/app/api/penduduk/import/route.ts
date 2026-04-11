import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toUpperCase, validateNIK } from '@/lib/utils-kependudukan';
import { ALAMAT_LENGKAP_DEFAULT } from '@/lib/constants';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });
    }

    // Pastikan kolom alamatLengkap ada di database
    try {
      const cols = await db.$queryRawUnsafe('PRAGMA table_info(Penduduk)');
      const colNames = (cols as Array<{ name: string }>).map(c => c.name);
      if (!colNames.includes('alamatLengkap')) {
        await db.$executeRawUnsafe('ALTER TABLE Penduduk ADD COLUMN alamatLengkap TEXT;');
      }
    } catch { /* abaikan jika gagal */ }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as string[][];

    // Pre-fetch semua NIK yang sudah ada (sekali query, bukan per-baris)
    const existingNIKs = new Set(
      (await db.penduduk.findMany({ select: { nik: true } })).map(p => p.nik)
    );

    let currentNoKK = '';
    let errors: string[] = [];

    // XLSX column mapping (data starts from Col B = index 0):
    // [0] NO. KK, [1] Nama Lengkap, [2] NIK, [3] Jenis Kelamin,
    // [4] Status Keluarga, [5] Tempat Lahir, [6] Tanggal Lahir,
    // [7] Agama, [8] Pendidikan, [9] Pekerjaan,
    // [10] Status Perkawinan, [11] Kewarganegaraan,
    // [12] Nama Ayah, [13] Nama Ibu, [14] Nama Panggilan, [15] Keterangan, [16] BPJS
    const COL_NO_KK = 0;
    const COL_NAMA = 1;
    const COL_NIK = 2;
    const COL_JENIS_KELAMIN = 3;
    const COL_STATUS_KELUARGA = 4;
    const COL_TEMPAT_LAHIR = 5;
    const COL_TGL_LAHIR = 6;
    const COL_AGAMA = 7;
    const COL_PENDIDIKAN = 8;
    const COL_PEKERJAAN = 9;
    const COL_STATUS_KAWIN = 10;
    const COL_WARGANEGARA = 11;
    const COL_NAMA_AYAH = 12;
    const COL_NAMA_IBU = 13;
    const COL_PANGGILAN = 14;
    const COL_KETERANGAN = 15;
    const COL_BPJS = 16;

    // Siapkan semua data valid terlebih dahulu
    const recordsToInsert: Array<{
      noKK: string; nik: string; namaLengkap: string; jenisKelamin: string;
      statusKeluarga: string; tempatLahir: string; tanggalLahir: Date;
      agama: string; pendidikan: string; pekerjaan: string; statusPerkawinan: string;
      kewarganegaraan: string; namaAyah: string; namaIbu: string;
      namaPanggilan: string | null; keterangan: string | null;
      punyaKTP: string; bantuan: string; bpjs: string | null; alamatLengkap: string;
    }> = [];

    // Skip header rows (index 0 = header, index 1 = sub-header Ayah/Ibu)
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 5) continue;

      const noKKRaw = row[COL_NO_KK] || '';
      const namaLengkap = (row[COL_NAMA] || '').trim();
      const nik = (row[COL_NIK] || '').trim();
      const jenisKelamin = (row[COL_JENIS_KELAMIN] || '').trim();
      const statusKeluarga = (row[COL_STATUS_KELUARGA] || '').trim();
      const tempatLahir = (row[COL_TEMPAT_LAHIR] || '').trim();
      const tanggalLahirRaw = (row[COL_TGL_LAHIR] || '').trim();
      const agama = (row[COL_AGAMA] || '').trim();
      const pendidikan = (row[COL_PENDIDIKAN] || '').trim();
      const pekerjaan = (row[COL_PEKERJAAN] || '').trim();
      const statusPerkawinan = (row[COL_STATUS_KAWIN] || '').trim();
      const kewarganegaraan = (row[COL_WARGANEGARA] || 'WNI').trim();
      const namaAyah = (row[COL_NAMA_AYAH] || '').trim();
      const namaIbu = (row[COL_NAMA_IBU] || '').trim();
      const namaPanggilan = (row[COL_PANGGILAN] || '').trim();
      const keterangan = (row[COL_KETERANGAN] || '').trim();
      const bpjs = (row[COL_BPJS] || '').trim();

      // Skip empty rows or rows without name
      if (!namaLengkap) continue;

      // Skip rows that are only status-related data (e.g., only WNI in column)
      if (!nik && !statusKeluarga && !tempatLahir) continue;

      // If NO KK is present, update current family
      if (noKKRaw) {
        currentNoKK = noKKRaw.trim();
      }

      if (!currentNoKK || !nik) {
        if (namaLengkap) {
          errors.push(`Baris ${i + 1}: Data tidak lengkap - ${namaLengkap} (NoKK: ${currentNoKK || 'kosong'}, NIK: ${nik || 'kosong'})`);
        }
        continue;
      }

      if (!validateNIK(nik)) {
        errors.push(`Baris ${i + 1}: NIK tidak valid (${nik}) - ${namaLengkap}`);
        continue;
      }

      // Cek duplikat NIK dari cache (sangat cepat, tanpa query DB)
      if (existingNIKs.has(nik)) {
        errors.push(`Baris ${i + 1}: NIK ${nik} sudah ada (${namaLengkap})`);
        continue;
      }

      // Parse tanggal lahir - XLSX with cellDates:true + raw:false returns formatted strings
      let tanggalLahirStr = tanggalLahirRaw;
      if (tanggalLahirRaw && tanggalLahirRaw.includes('/')) {
        // Handle MM/DD/YY or MM/DD/YYYY format
        const parts = tanggalLahirRaw.split('/');
        if (parts.length === 3) {
          const month = parseInt(parts[0]) - 1;
          const day = parseInt(parts[1]);
          let year = parseInt(parts[2]);
          // Convert 2-digit year: if > current century's 2-digit year assume 1900s
          if (year < 100) {
            const currentCentury2Digit = new Date().getFullYear() % 100;
            year = year > currentCentury2Digit ? 1900 + year : 2000 + year;
          }
          const date = new Date(year, month, day);
          tanggalLahirStr = date.toISOString().split('T')[0];
        }
      } else if (tanggalLahirRaw && !isNaN(Number(tanggalLahirRaw))) {
        // Fallback: convert Excel serial number to date
        const serialDate = parseInt(tanggalLahirRaw);
        const epoch = new Date(1899, 11, 30);
        const date = new Date(epoch.getTime() + serialDate * 86400000);
        tanggalLahirStr = date.toISOString().split('T')[0];
      }

      if (!tanggalLahirStr) {
        errors.push(`Baris ${i + 1}: Tanggal lahir tidak valid - ${namaLengkap}`);
        continue;
      }

      // Tandai NIK sudah diproses agar tidak duplikat dalam batch ini
      existingNIKs.add(nik);

      recordsToInsert.push({
        noKK: currentNoKK,
        nik,
        namaLengkap: toUpperCase(namaLengkap),
        jenisKelamin: toUpperCase(jenisKelamin),
        statusKeluarga: toUpperCase(statusKeluarga),
        tempatLahir: toUpperCase(tempatLahir),
        tanggalLahir: new Date(tanggalLahirStr),
        agama: toUpperCase(agama),
        pendidikan: toUpperCase(pendidikan),
        pekerjaan: toUpperCase(pekerjaan),
        statusPerkawinan: toUpperCase(statusPerkawinan),
        kewarganegaraan: toUpperCase(kewarganegaraan),
        namaAyah: toUpperCase(namaAyah),
        namaIbu: toUpperCase(namaIbu),
        namaPanggilan: namaPanggilan ? toUpperCase(namaPanggilan) : null,
        keterangan: keterangan ? keterangan : null,
        punyaKTP: 'BELUM',
        bantuan: '[]',
        bpjs: bpjs ? bpjs.toUpperCase() : null,
        alamatLengkap: ALAMAT_LENGKAP_DEFAULT,
      });
    }

    // Batch insert menggunakan transaction (jauh lebih cepat dari insert satu per satu)
    let imported = 0;
    if (recordsToInsert.length > 0) {
      const BATCH_SIZE = 50;
      for (let batchStart = 0; batchStart < recordsToInsert.length; batchStart += BATCH_SIZE) {
        const batch = recordsToInsert.slice(batchStart, batchStart + BATCH_SIZE);
        await db.$transaction(
          batch.map(r => db.penduduk.create({ data: r }))
        );
        imported += batch.length;
      }
    }

    return NextResponse.json({
      message: `Berhasil mengimpor ${imported} data penduduk`,
      imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Gagal mengimpor data: ' + String(error) }, { status: 500 });
  }
}
