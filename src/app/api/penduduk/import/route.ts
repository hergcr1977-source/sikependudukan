import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toUpperCase, validateNIK } from '@/lib/utils-kependudukan';
import { ALAMAT_LENGKAP_DEFAULT, ALAMAT_DEFAULT, RT_DEFAULT, RW_DEFAULT, KELURAHAN_DEFAULT, KECAMATAN_DEFAULT, KABUPATEN_DEFAULT, PROVINSI_DEFAULT } from '@/lib/constants';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });
    }

    // Pastikan kolom alamatLengkap dan alamat individual ada di database
    try {
      const cols = await db.$queryRawUnsafe('PRAGMA table_info(Penduduk)');
      const colNames = (cols as Array<{ name: string }>).map(c => c.name);
      if (!colNames.includes('alamatLengkap')) {
        await db.$executeRawUnsafe('ALTER TABLE Penduduk ADD COLUMN alamatLengkap TEXT;');
      }
      for (const [col, def] of [['alamat', "'KP. CEMPLANG'"], ['rt', "'001'"], ['rw', "'002'"], ['kelurahan', "'SUKAMAJU'"], ['kecamatan', "'CIBUNGBULANG'"], ['kabupaten', "'BOGOR'"], ['provinsi', "'JAWA BARAT'"]] as [string, string][]) {
        if (!colNames.includes(col)) {
          await db.$executeRawUnsafe(`ALTER TABLE Penduduk ADD COLUMN ${col} TEXT DEFAULT ${def};`);
        }
      }
    } catch (e) {
      console.warn('Auto-migration warning:', e);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][];

    if (rows.length < 3) {
      return NextResponse.json({ error: 'File kosong atau tidak memiliki cukup data' }, { status: 400 });
    }

    // Pre-fetch semua NIK yang sudah ada
    const existingNIKs = new Set(
      (await db.penduduk.findMany({ select: { nik: true } })).map(p => p.nik)
    );

    let imported = 0;
    let skipped = 0;
    let errors: string[] = [];
    let currentNoKK = '';

    // Skip header rows (index 0 = header, index 1 = sub-header Ayah/Ibu)
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 5) continue;

      const noKKRaw = String(row[0] || '').trim();
      const namaLengkap = (row[1] || '').trim();
      const nik = (row[2] || '').trim();
      const jenisKelamin = (row[3] || '').trim();
      const statusKeluarga = (row[4] || '').trim();
      const tempatLahir = (row[5] || '').trim();
      const tanggalLahirRaw = (row[6] || '').trim();
      const agama = (row[7] || '').trim();
      const pendidikan = (row[8] || '').trim();
      const pekerjaan = (row[9] || '').trim();
      const statusPerkawinan = (row[10] || '').trim();
      const kewarganegaraan = (row[11] || 'WNI').trim();
      const namaAyah = (row[12] || '').trim();
      const namaIbu = (row[13] || '').trim();
      const namaPanggilan = (row[14] || '').trim();
      const keterangan = (row[15] || '').trim();
      const bpjs = (row[16] || '').trim();

      // Skip empty rows or rows without name
      if (!namaLengkap) continue;

      // Skip rows that are only status-related data (e.g., only WNI in column)
      if (!nik && !statusKeluarga && !tempatLahir) continue;

      // If NO KK is present, update current family
      if (noKKRaw) {
        currentNoKK = noKKRaw;
      }

      if (!currentNoKK || !nik) {
        continue; // Skip baris tanpa NoKK/NIK tanpa error
      }

      if (!validateNIK(nik)) {
        skipped++;
        continue;
      }

      // Cek duplikat NIK dari cache
      if (existingNIKs.has(nik)) {
        skipped++;
        existingNIKs.add(nik); // juga tandai supaya tidak hitung duplikat dalam batch
        continue;
      }

      // Parse tanggal lahir
      let tanggalLahirStr = '';
      if (tanggalLahirRaw && tanggalLahirRaw.includes('/')) {
        const parts = tanggalLahirRaw.split('/');
        if (parts.length === 3) {
          const month = parseInt(parts[0]) - 1;
          const day = parseInt(parts[1]);
          let year = parseInt(parts[2]);
          if (year < 100) {
            const currentCentury2Digit = new Date().getFullYear() % 100;
            year = year > currentCentury2Digit ? 1900 + year : 2000 + year;
          }
          const date = new Date(year, month, day);
          tanggalLahirStr = date.toISOString().split('T')[0];
        }
      } else if (tanggalLahirRaw && !isNaN(Number(tanggalLahirRaw))) {
        const serialDate = parseInt(tanggalLahirRaw);
        const epoch = new Date(1899, 11, 30);
        const date = new Date(epoch.getTime() + serialDate * 86400000);
        tanggalLahirStr = date.toISOString().split('T')[0];
      } else if (tanggalLahirRaw && tanggalLahirRaw.includes('-')) {
        tanggalLahirStr = tanggalLahirRaw.split(' ')[0];
      }

      if (!tanggalLahirStr) {
        skipped++;
        continue;
      }

      // Tandai NIK sudah diproses
      existingNIKs.add(nik);

      // Insert satu per satu dengan error handling
      try {
        await db.penduduk.create({
          data: {
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
            keterangan: keterangan || null,
            punyaKTP: 'BELUM',
            bantuan: '[]',
            bpjs: bpjs ? bpjs.toUpperCase() : null,
            alamat: ALAMAT_DEFAULT,
            rt: RT_DEFAULT,
            rw: RW_DEFAULT,
            kelurahan: KELURAHAN_DEFAULT,
            kecamatan: KECAMATAN_DEFAULT,
            kabupaten: KABUPATEN_DEFAULT,
            provinsi: PROVINSI_DEFAULT,
            alamatLengkap: ALAMAT_LENGKAP_DEFAULT,
          },
        });
        imported++;
      } catch (insertError) {
        console.error(`Insert error row ${i + 1} (${namaLengkap}):`, insertError);
        errors.push(`Baris ${i + 1}: Gagal menyimpan ${namaLengkap}`);
      }
    }

    return NextResponse.json({
      message: `Berhasil mengimpor ${imported} data penduduk${skipped > 0 ? `, ${skipped} dilewati` : ''}`,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Gagal mengimpor data: ' + String(error) }, { status: 500 });
  }
}
