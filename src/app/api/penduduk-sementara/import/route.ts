import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toUpperCase } from '@/lib/utils-kependudukan';
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
      const cols = await db.$queryRawUnsafe('PRAGMA table_info(PendudukSementara)');
      const colNames = (cols as Array<{ name: string }>).map(c => c.name);
      if (!colNames.includes('alamatLengkap')) {
        await db.$executeRawUnsafe('ALTER TABLE PendudukSementara ADD COLUMN alamatLengkap TEXT;');
      }
      for (const [col, def] of [['alamat', "'KP. CEMPLANG'"], ['rt', "'001'"], ['rw', "'002'"], ['kelurahan', "'SUKAMAJU'"], ['kecamatan', "'CIBUNGBULANG'"], ['kabupaten', "'BOGOR'"], ['provinsi', "'JAWA BARAT'"]] as [string, string][]) {
        if (!colNames.includes(col)) {
          await db.$executeRawUnsafe(`ALTER TABLE PendudukSementara ADD COLUMN ${col} TEXT DEFAULT ${def};`);
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
      (await db.pendudukSementara.findMany({ select: { nik: true } })).map(p => p.nik)
    );

    // Pre-fetch juga NIK dari tabel penduduk utama untuk cek duplikat lintas tabel
    const existingPendudukNIKs = new Set(
      (await db.penduduk.findMany({ select: { nik: true } })).map(p => p.nik)
    );

    let errors: string[] = [];

    // Normalize status keterangan - lebih fleksibel, default ke NUMPANG KELUARGA jika tidak dikenali
    const normalizeStatus = (raw: string): string => {
      const upper = raw.toUpperCase().trim();
      if (!upper) return 'NUMPANG KELUARGA'; // Default jika kosong
      if (upper.includes('KONTRAK') || upper.includes('KONTRAN')) return 'KONTRAK';
      if (upper.includes('SEWA')) return 'SEWA';
      if (upper.includes('MENUMPANG') || upper.includes('NUMPANG')) return 'NUMPANG KELUARGA';
      if (upper.includes('KOS') || upper.includes('KOST')) return 'KOS';
      // Jika tidak dikenali, gunakan default
      return 'NUMPANG KELUARGA';
    };

    let currentNoKK = '';
    const today = new Date().toISOString().split('T')[0];

    // Skip header rows: rows[0] = header, rows[1] = sub-header
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 5) continue;

      const noKKRaw = String(row[0] || '').trim();
      const namaLengkap = String(row[1] || '').trim();
      const nik = String(row[2] || '').trim();
      const jenisKelamin = String(row[3] || '').trim();
      const statusKeluarga = String(row[4] || '').trim();
      const tempatLahir = String(row[5] || '').trim();
      const tanggalLahirRaw = String(row[6] || '').trim();
      const agama = String(row[7] || '').trim();
      const pendidikan = String(row[8] || '').trim();
      const pekerjaan = String(row[9] || '').trim();
      const statusPerkawinan = String(row[10] || '').trim();
      const kewarganegaraan = String(row[11] || 'WNI').trim();
      const statusWarga = String(row[12] || '').trim();
      const namaAyah = String(row[13] || '').trim();
      const namaIbu = String(row[14] || '').trim();
      const namaPanggilan = String(row[15] || '').trim();
      const keterangan = String(row[16] || '').trim();

      // Skip empty rows
      if (!namaLengkap) continue;

      // Skip rows that are only status-related (e.g., only WNI in column)
      if (!jenisKelamin && !tempatLahir && !tanggalLahirRaw && !agama) continue;

      // Track current No. KK
      if (noKKRaw) {
        currentNoKK = noKKRaw;
      }

      if (!currentNoKK) {
        errors.push(`Baris ${i + 1}: No. KK tidak ditemukan - ${namaLengkap}`);
        continue;
      }

      if (!nik) {
        errors.push(`Baris ${i + 1}: NIK kosong - ${namaLengkap}`);
        continue;
      }

      // Cek duplikat NIK dari penduduk sementara
      if (existingNIKs.has(nik)) {
        errors.push(`Baris ${i + 1}: NIK ${nik} sudah ada di penduduk sementara (${namaLengkap})`);
        continue;
      }

      // Cek duplikat NIK dari penduduk utama
      if (existingPendudukNIKs.has(nik)) {
        errors.push(`Baris ${i + 1}: NIK ${nik} sudah ada di data penduduk utama (${namaLengkap})`);
        continue;
      }

      // Status keterangan - default ke NUMPANG KELUARGA jika kosong/tidak dikenali
      const statusKeterangan = normalizeStatus(statusWarga);

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
          if (!isNaN(date.getTime())) {
            tanggalLahirStr = date.toISOString().split('T')[0];
          }
        }
      } else if (tanggalLahirRaw && !isNaN(Number(tanggalLahirRaw))) {
        const serialDate = parseInt(tanggalLahirRaw);
        const epoch = new Date(1899, 11, 30);
        const date = new Date(epoch.getTime() + serialDate * 86400000);
        if (!isNaN(date.getTime())) {
          tanggalLahirStr = date.toISOString().split('T')[0];
        }
      } else if (tanggalLahirRaw && tanggalLahirRaw.includes('-')) {
        tanggalLahirStr = tanggalLahirRaw.split(' ')[0];
      }

      if (!tanggalLahirStr) {
        errors.push(`Baris ${i + 1}: Tanggal lahir tidak valid (${tanggalLahirRaw}) - ${namaLengkap}`);
        continue;
      }

      // Tandai NIK sudah diproses
      existingNIKs.add(nik);

      // Insert satu per satu dengan error handling individual
      try {
        await db.pendudukSementara.create({
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
            noHP: null,
            statusKeterangan: statusKeterangan,
            alamatAsal: keterangan || '',
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
            tanggalMasuk: new Date(today),
            tanggalKeluar: null,
            keterangan: keterangan || null,
          },
        });
      } catch (insertError) {
        console.error(`Insert error row ${i + 1} (${namaLengkap}):`, insertError);
        errors.push(`Baris ${i + 1}: Gagal menyimpan ${namaLengkap} - ${String(insertError)}`);
      }
    }

    // Hitung jumlah yang berhasil
    const imported = await db.pendudukSementara.count();

    return NextResponse.json({
      message: `Berhasil mengimpor data penduduk sementara. Total: ${imported} data`,
      imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Gagal mengimpor data: ' + String(error) }, { status: 500 });
  }
}
