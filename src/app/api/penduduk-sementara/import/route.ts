import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toUpperCase } from '@/lib/utils-kependudukan';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][];

    let imported = 0;
    let errors: string[] = [];

    // Column mapping (with defval:'', all rows have consistent length):
    // [0] NO. KK, [1] Nama Lengkap, [2] NIK, [3] Jenis Kelamin,
    // [4] Status keluarga, [5] Tempat Lahir, [6] Tanggal Lahir,
    // [7] Agama, [8] Pendidikan, [9] Jenis Pekerjaan,
    // [10] Sataus Perkawinan, [11] kewarga Negaraan,
    // [12] Status Warga, [13] Nama Orang Tua Ayah, [14] Nama Orang Tua Ibu,
    // [15] Nama Panggilan, [16] Keterangan

    // Normalize status keterangan
    const normalizeStatus = (raw: string): string => {
      const upper = raw.toUpperCase().trim();
      if (!upper) return '';
      if (upper.includes('KONTRAK') || upper.includes('KONTRAN')) return 'KONTRAK';
      if (upper.includes('SEWA')) return 'SEWA';
      if (upper.includes('MENUMPANG') || upper.includes('NUMPANG')) return 'NUMPANG KELUARGA';
      if (upper.includes('KOS') || upper.includes('KOST')) return 'KOS';
      if (upper.includes('NUMPANG') || upper.includes('NOMPANG')) return 'NUMPANG KELUARGA';
      if (upper.includes('MENUMPANG')) return 'MENUMPANG';
      return upper;
      return upper;
    };

    let currentNoKK = '';
    const today = new Date().toISOString().split('T')[0];

    // Skip header rows: rows[0] = header, rows[1] = sub-header (Ayah/Ibu)
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

      // Track current No. KK (only KK head has No. KK value)
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

      const statusKeterangan = normalizeStatus(statusWarga);
      if (!statusKeterangan) {
        errors.push(`Baris ${i + 1}: Status warga tidak valid (${statusWarga}) - ${namaLengkap}`);
        continue;
      }

      // Parse tanggal lahir - format: "MM/DD/YY" (e.g., "10/10/81", "6/12/83")
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

      try {
        // Check NIK uniqueness
        const existing = await db.pendudukSementara.findFirst({ where: { nik } });
        if (existing) {
          errors.push(`Baris ${i + 1}: NIK ${nik} sudah ada (${namaLengkap})`);
          continue;
        }

        const alamatAsal = keterangan || '';

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
            alamatAsal: alamatAsal,
            tanggalMasuk: new Date(today),
            tanggalKeluar: null,
            keterangan: null,
          },
        });
        imported++;
      } catch (err) {
        errors.push(`Baris ${i + 1}: Gagal menyimpan ${namaLengkap} - ${String(err)}`);
      }
    }

    return NextResponse.json({
      message: `Berhasil mengimpor ${imported} data penduduk sementara`,
      imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Gagal mengimpor data: ' + String(error) }, { status: 500 });
  }
}
