import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toUpperCase } from '@/lib/utils-kependudukan';
import { ALAMAT_LENGKAP_DEFAULT, ALAMAT_DEFAULT, RT_DEFAULT, RW_DEFAULT, KELURAHAN_DEFAULT, KECAMATAN_DEFAULT, KABUPATEN_DEFAULT, PROVINSI_DEFAULT } from '@/lib/constants';
import * as XLSX from 'xlsx';

// Cari index kolom berdasarkan nama header
function findColIndex(headers: string[], keywords: string[]): number {
  const headerStr = headers.map(h => toUpperCase(String(h).trim()));
  for (const kw of keywords) {
    const idx = headerStr.findIndex(h => h.includes(toUpperCase(kw)));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseTanggal(raw: string): string | null {
  if (!raw) return null;
  raw = String(raw).trim();
  if (!raw) return null;

  // Format: YYYY-MM-DD (dari cellDates)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.split(' ')[0];

  // Format: MM/DD/YY atau MM/DD/YYYY
  if (raw.includes('/')) {
    const parts = raw.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0]) - 1;
      const day = parseInt(parts[1]);
      let year = parseInt(parts[2]);
      if (year < 100) {
        const c = new Date().getFullYear() % 100;
        year = year > c ? 1900 + year : 2000 + year;
      }
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }

  // Excel serial number
  const num = Number(raw);
  if (!isNaN(num) && raw === String(num)) {
    const d = new Date(1899, 11, 30);
    d.setTime(d.getTime() + num * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });
    }

    // Auto-migration
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
      console.warn('Auto-migration:', e);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][];

    if (rows.length < 3) {
      return NextResponse.json({ error: 'File kosong atau tidak memiliki cukup data' }, { status: 400 });
    }

    // Auto-detect kolom dari header baris 0
    const header0: string[] = (rows[0] || []).map(c => String(c || '').trim());
    const header1: string[] = (rows[1] || []).map(c => String(c || '').trim());

    // Gunakan header baris 0 untuk deteksi kolom, fallback ke header baris 1
    const headerForDetect = header0.length > 2 ? header0 : header1;

    // Cari index kolom
    let COL_NO_KK = findColIndex(headerForDetect, ['NO. KK', 'NO KK', 'NOMOR KK', 'NO_KK', 'NoKK']);
    let COL_NAMA = findColIndex(headerForDetect, ['NAMA LENGKAP', 'NAMA', 'NAME']);
    let COL_NIK = findColIndex(headerForDetect, ['NIK', 'NO. INDUK']);
    let COL_JK = findColIndex(headerForDetect, ['JENIS KELAMIN', 'J. KELAMIN', 'LAKI', 'PEREMPUAN', 'JK', 'JenisKelamin']);
    let COL_STATUS = findColIndex(headerForDetect, ['STATUS KELUARGA', 'STATUS', 'HUB. KELUARGA', 'HubKeluarga']);
    let COL_TEMPAT = findColIndex(headerForDetect, ['TEMPAT LAHIR', 'TMP LAHIR']);
    let COL_TGL = findColIndex(headerForDetect, ['TANGGAL LAHIR', 'TGL LAHIR', 'TTL']);

    // Jika auto-detect gagal, gunakan index default
    if (COL_NO_KK < 0 || COL_NAMA < 0 || COL_NIK < 0) {
      // Fallback: coba pola lama (data mulai dari Col B = index 0)
      COL_NO_KK = 0; COL_NAMA = 1; COL_NIK = 2; COL_JK = 3; COL_STATUS = 4; COL_TEMPAT = 5; COL_TGL = 6;
    }

    // Log kolom yang terdeteksi
    console.log(`[Import Penduduk] Kolom terdeteksi: NoKK=${COL_NO_KK}, Nama=${COL_NAMA}, NIK=${COL_NIK}, JK=${COL_JK}, Status=${COL_STATUS}, Tempat=${COL_TEMPAT}, Tgl=${COL_TGL}`);

    // Cek: apakah ada kolom "NO" (nomor urut) sebelum kolom yang terdeteksi?
    const firstHeaderVal = headerForDetect[0] || '';
    if (/^(NO|NO\.$|NOMOR|URUT)$/i.test(firstHeaderVal)) {
      // Ada kolom NO di posisi 0, shift semua +1
      if (COL_NO_KK === 0) COL_NO_KK = findColIndex(headerForDetect, ['NO. KK', 'NO KK', 'NOMOR KK']) ?? 1;
      console.log(`[Import Penduduk] Terdeteksi kolom NO di index 0, kolom di-shift`);
    }

    // Pre-fetch NIK yang sudah ada
    const existingNIKs = new Set(
      (await db.penduduk.findMany({ select: { nik: true } })).map(p => p.nik)
    );

    let imported = 0;
    let skipped = 0;
    let currentNoKK = '';
    const errors: string[] = [];

    // Mulai dari baris ke-2 (setelah header)
    const startRow = header0.length > 2 ? 2 : (header1.length > 2 ? 3 : 2);

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      const getCol = (idx: number) => String(row[idx] || '').trim();

      const noKKRaw = getCol(COL_NO_KK);
      const namaLengkap = getCol(COL_NAMA);
      const nik = getCol(COL_NIK);
      const jenisKelamin = COL_JK >= 0 ? getCol(COL_JK) : '';
      const statusKeluarga = COL_STATUS >= 0 ? getCol(COL_STATUS) : 'KEPALA KELUARGA';
      const tempatLahir = COL_TEMPAT >= 0 ? getCol(COL_TEMPAT) : '';
      const tanggalLahirRaw = COL_TGL >= 0 ? getCol(COL_TGL) : '';

      if (!namaLengkap) continue;
      if (!nik && !jenisKelamin && !tempatLahir) continue;

      if (noKKRaw) currentNoKK = noKKRaw;
      if (!currentNoKK || !nik) { skipped++; continue; }
      if (nik.length !== 16 || !/^\d{16}$/.test(nik)) { skipped++; continue; }
      if (existingNIKs.has(nik)) { skipped++; continue; }

      const tanggalLahir = parseTanggal(tanggalLahirRaw);
      if (!tanggalLahir) { skipped++; continue; }

      existingNIKs.add(nik);

      // Ambil field opsional dari kolom yang tersedia
      const agama = toUpperCase(getCol(COL_TGL >= 0 ? COL_TGL + 1 : 7));
      const pendidikan = toUpperCase(getCol(COL_TGL >= 0 ? COL_TGL + 2 : 8));
      const pekerjaan = toUpperCase(getCol(COL_TGL >= 0 ? COL_TGL + 3 : 9));
      const statusPerkawinan = toUpperCase(getCol(COL_TGL >= 0 ? COL_TGL + 4 : 10));
      const kewarganegaraan = toUpperCase(getCol(COL_TGL >= 0 ? COL_TGL + 5 : 11) || 'WNI');
      const namaAyah = toUpperCase(getCol(COL_TGL >= 0 ? COL_TGL + 6 : 12));
      const namaIbu = toUpperCase(getCol(COL_TGL >= 0 ? COL_TGL + 7 : 13));
      const namaPanggilan = getCol(COL_TGL >= 0 ? COL_TGL + 8 : 14);
      const keterangan = getCol(COL_TGL >= 0 ? COL_TGL + 9 : 15);
      const bpjs = getCol(COL_TGL >= 0 ? COL_TGL + 10 : 16);

      try {
        await db.$executeRawUnsafe(
          `INSERT INTO Penduduk (noKK, nik, namaLengkap, jenisKelamin, statusKeluarga, tempatLahir, tanggalLahir, agama, pendidikan, pekerjaan, statusPerkawinan, kewarganegaraan, namaAyah, namaIbu, namaPanggilan, noHP, punyaKTP, bantuan, bpjs, alamat, rt, rw, kelurahan, kecamatan, kabupaten, provinsi, alamatLengkap, keterangan, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'BELUM', '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          currentNoKK, nik, toUpperCase(namaLengkap), toUpperCase(jenisKelamin), toUpperCase(statusKeluarga),
          toUpperCase(tempatLahir), tanggalLahir, agama, pendidikan, pekerjaan, statusPerkawinan,
          kewarganegaraan, namaAyah, namaIbu, namaPanggilan ? toUpperCase(namaPanggilan) : null,
          bpjs ? toUpperCase(bpjs) : null,
          ALAMAT_DEFAULT, RT_DEFAULT, RW_DEFAULT, KELURAHAN_DEFAULT, KECAMATAN_DEFAULT, KABUPATEN_DEFAULT, PROVINSI_DEFAULT,
          ALAMAT_LENGKAP_DEFAULT,
          keterangan || null
        );
        imported++;
      } catch (err) {
        console.error(`Insert error row ${i + 1} (${namaLengkap}):`, err);
        errors.push(`Baris ${i + 1}: ${namaLengkap}`);
      }
    }

    return NextResponse.json({
      message: `Berhasil mengimpor ${imported} data penduduk${skipped > 0 ? `, ${skipped} dilewati` : ''}`,
      imported,
      skipped,
      kolomTerdeteksi: { NoKK: COL_NO_KK, Nama: COL_NAMA, NIK: COL_NIK, JK: COL_JK },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Gagal mengimpor: ' + String(error) }, { status: 500 });
  }
}
