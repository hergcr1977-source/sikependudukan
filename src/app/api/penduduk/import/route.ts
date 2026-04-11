import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toUpperCase } from '@/lib/utils-kependudukan';
import {
  ALAMAT_LENGKAP_DEFAULT, ALAMAT_DEFAULT, RT_DEFAULT, RW_DEFAULT,
  KELURAHAN_DEFAULT, KECAMATAN_DEFAULT, KABUPATEN_DEFAULT, PROVINSI_DEFAULT,
} from '@/lib/constants';
import * as XLSX from 'xlsx';

export const maxDuration = 60;

// ========== DATE PARSER ==========
function parseTanggal(raw: any): string | null {
  // 1. Handle Date objects directly (from cellDates: true + raw: true)
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return raw.toISOString().split('T')[0];
  }
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // 2. ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split(' ')[0];

  // 3. Slash or dash separated: try DD/MM/YYYY first (Indonesian), then MM/DD/YYYY
  if (str.includes('/') || (str.includes('-') && !/^\d{4}/.test(str))) {
    const sep = str.includes('/') ? '/' : '-';
    const parts = str.split(sep);
    if (parts.length === 3) {
      const a = parseInt(parts[0]);
      const b = parseInt(parts[1]);
      let year = parseInt(parts[2]);
      if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;

      // Try DD/MM/YYYY (Indonesian format) - day > 12 means it must be DD
      if (a > 12) {
        const d = new Date(year, b - 1, a);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      }
      // Try MM/DD/YYYY - month > 12 means first part must be day
      if (b > 12) {
        const d = new Date(year, a - 1, b);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      }
      // Ambiguous: both <= 12. Try MM/DD/YYYY
      const d = new Date(year, a - 1, b);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }

  // 4. Excel serial number (30000-55000 range covers 1982-2050)
  const num = Number(str);
  if (!isNaN(num) && str === String(num) && num > 20000 && num < 60000) {
    const d = new Date(1899, 11, 30);
    d.setTime(d.getTime() + num * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  return null;
}

// ========== HEADER DETECTION ==========
function findHeaderRow(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    const rowStr = row.map(c => String(c || '').toUpperCase()).join('|');
    if (rowStr.includes('NO. KK') || rowStr.includes('NOKK') || rowStr.includes('NO KK')) return i;
    if (rowStr.includes('NIK') && rowStr.includes('NAMA')) return i;
  }
  return 0;
}

// ========== COLUMN AUTO-DETECTION ==========
function detectColumns(headerRow: any[]): Record<string, number> {
  const cols: Record<string, number> = {};
  if (!headerRow) return cols;
  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] || '').toUpperCase().trim();
    if (!h) continue;
    if (h.includes('NO. KK') || h.includes('NOKK') || h === 'NO KK') { cols.NO_KK = i; continue; }
    if (h === 'NAMA' || h === 'NAMA LENGKAP') { cols.NAMA = i; continue; }
    if (h === 'NIK') { cols.NIK = i; continue; }
    if (h === 'JK' || h.includes('JENIS KELAMIN')) { cols.JK = i; continue; }
    if (h === 'STATUS KK' || h.includes('STATUS KELUARGA') && !h.includes('PERKAWINAN') && !h.includes('KAWIN')) { cols.STATUS_KK = i; continue; }
    if (h === 'TEMPAT' || h === 'TEMPAT LAHIR') { cols.TEMPAT = i; continue; }
    if (h === 'TGL LAHIR' || h === 'TANGGAL LAHIR' || (h.includes('LAHIR') && !h.includes('TEMPAT'))) { cols.TGL_LAHIR = i; continue; }
    if (h === 'AGAMA') { cols.AGAMA = i; continue; }
    if (h === 'PENDIDIKAN') { cols.PENDIDIKAN = i; continue; }
    if (h === 'PEKERJAAN') { cols.PEKERJAAN = i; continue; }
    if (h === 'STATUS KAWIN' || h.includes('PERKAWINAN') || h === 'STATUS KAWIN') { cols.STATUS_KAWIN = i; continue; }
    if (h === 'WARGANEGARAAN' || h === 'KEWARGANEGARAAN' || h === 'WN') { cols.WARGANEGARAAN = i; continue; }
    if (h === 'AYAH' || h.includes('NAMA AYAH')) { cols.AYAH = i; continue; }
    if (h === 'IBU' || h.includes('NAMA IBU')) { cols.IBU = i; continue; }
    if (h === 'PANGGILAN' || h.includes('NAMA PANGGILAN')) { cols.PANGGILAN = i; continue; }
    if (h === 'KETERANGAN') { cols.KETERANGAN = i; continue; }
  }
  return cols;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });
    }

    // Auto-migration: pastikan semua kolom alamat ada di DB
    try {
      const cols = await db.$queryRawUnsafe('PRAGMA table_info(Penduduk)');
      const colNames = (cols as Array<{ name: string }>).map(c => c.name);
      for (const [col, def] of [
        ['alamat', "'KP. CEMPLANG'"], ['rt', "'001'"], ['rw', "'002'"],
        ['kelurahan', "'SUKAMAJU'"], ['kecamatan', "'CIBUNGBULANG'"],
        ['kabupaten', "'BOGOR'"], ['provinsi', "'JAWA BARAT'"], ['alamatLengkap', "NULL"],
      ] as [string, string][]) {
        if (!colNames.includes(col)) {
          console.log(`[Migration] Adding column ${col} to Penduduk`);
          await db.$executeRawUnsafe(`ALTER TABLE Penduduk ADD COLUMN ${col} TEXT DEFAULT ${def};`);
        }
      }
    } catch (e) {
      console.warn('[Migration] Penduduk:', e);
    }

    // Parse Excel - gunakan raw: true (default) agar tanggal = Date object
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

    console.log(`[Import Penduduk] Total rows in sheet: ${rows.length}`);

    if (rows.length < 2) {
      return NextResponse.json({ error: 'File kosong atau tidak memiliki cukup data' }, { status: 400 });
    }

    // Auto-detect header row
    const headerIdx = findHeaderRow(rows);
    const headerContent = rows[headerIdx]?.map((c, i) => `[${i}]=${c}`).join(' | ');
    console.log(`[Import Penduduk] Header at row ${headerIdx}: ${headerContent}`);

    // Auto-detect columns
    const detected = detectColumns(rows[headerIdx]);
    console.log(`[Import Penduduk] Detected columns:`, JSON.stringify(detected));

    const COL = {
      NO_KK: detected.NO_KK ?? 0,
      NAMA: detected.NAMA ?? 1,
      NIK: detected.NIK ?? 2,
      JK: detected.JK ?? 3,
      STATUS_KK: detected.STATUS_KK ?? 4,
      TEMPAT: detected.TEMPAT ?? 5,
      TGL_LAHIR: detected.TGL_LAHIR ?? 6,
      AGAMA: detected.AGAMA ?? 7,
      PENDIDIKAN: detected.PENDIDIKAN ?? 8,
      PEKERJAAN: detected.PEKERJAAN ?? 9,
      STATUS_KAWIN: detected.STATUS_KAWIN ?? 10,
      WARGANEGARAAN: detected.WARGANEGARAAN ?? 11,
      AYAH: detected.AYAH ?? 12,
      IBU: detected.IBU ?? 13,
      PANGGILAN: detected.PANGGILAN ?? 14,
      KETERANGAN: detected.KETERANGAN ?? 15,
    };

    // Pre-fetch existing NIKs
    const existingNIKs = new Set(
      (await db.penduduk.findMany({ select: { nik: true } })).map(p => p.nik)
    );
    console.log(`[Import Penduduk] Existing NIKs: ${existingNIKs.size}`);

    let imported = 0;
    let skipped = 0;
    let currentNoKK = '';
    const errors: string[] = [];
    let dateParseFails = 0;

    // Data dimulai setelah header row
    const startRow = headerIdx + 1;

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      // Helper: ambil nilai string dari kolom
      const get = (idx: number) => {
        const val = row[idx];
        if (val instanceof Date) return ''; // tanggal diambil pakai getDate
        return String(val || '').trim();
      };
      // Helper: ambil raw value (bisa Date object)
      const getRaw = (idx: number) => row[idx];

      const noKKRaw = get(COL.NO_KK);
      const namaLengkap = get(COL.NAMA);
      const nik = get(COL.NIK);
      const jenisKelamin = get(COL.JK);
      const statusKeluarga = get(COL.STATUS_KK);
      const tempatLahir = get(COL.TEMPAT);
      const tanggalLahirRaw = getRaw(COL.TGL_LAHIR);
      const tanggalLahir = parseTanggal(tanggalLahirRaw);
      const agama = get(COL.AGAMA);
      const pendidikan = get(COL.PENDIDIKAN);
      const pekerjaan = get(COL.PEKERJAAN);
      const statusPerkawinan = get(COL.STATUS_KAWIN);
      const kewarganegaraan = get(COL.WARGANEGARAAN) || 'WNI';
      const namaAyah = get(COL.AYAH);
      const namaIbu = get(COL.IBU);
      const namaPanggilan = get(COL.PANGGILAN);
      const keterangan = get(COL.KETERANGAN);

      // Skip baris kosong
      if (!namaLengkap) continue;

      // Skip baris sub-header (hanya berisi "Ayah", "Ibu", dll)
      const rowText = row.slice(0, 5).map(c => String(c || '').toUpperCase().trim()).join(' ');
      if (rowText === '' && (get(COL.AYAH).toUpperCase() === 'AYAH' || get(COL.IBU).toUpperCase() === 'IBU')) continue;

      // Skip baris yang bukan data (hanya kewarganegaraan saja tanpa data lainnya)
      if (!nik && !jenisKelamin && !tempatLahir && !statusKeluarga && !tanggalLahir) continue;

      // Track NoKK (merged cells: NoKK hanya muncul di baris pertama KK)
      if (noKKRaw) currentNoKK = noKKRaw;
      if (!currentNoKK) { skipped++; continue; }
      if (!nik) { skipped++; continue; }

      // Cek duplikat
      if (existingNIKs.has(nik)) { skipped++; continue; }

      // Validasi tanggal
      if (!tanggalLahir) {
        dateParseFails++;
        console.log(`[Import Penduduk] Date FAIL row ${i}: raw=${JSON.stringify(tanggalLahirRaw)} type=${typeof tanggalLahirRaw}`);
        errors.push(`Baris ${i + 1}: ${namaLengkap} - tanggal lahir tidak valid (${String(tanggalLahirRaw)})`);
        skipped++;
        continue;
      }

      // Tandai NIK sudah diproses (agar duplikat dalam file juga di-skip)
      existingNIKs.add(nik);

      // Insert ke database
      try {
        await db.penduduk.create({
          data: {
            noKK: currentNoKK,
            nik,
            namaLengkap: toUpperCase(namaLengkap) || 'TIDAK DIKETAHUI',
            jenisKelamin: toUpperCase(jenisKelamin) || 'LAKI-LAKI',
            statusKeluarga: toUpperCase(statusKeluarga) || 'KEPALA KELUARGA',
            tempatLahir: toUpperCase(tempatLahir) || '-',
            tanggalLahir: new Date(tanggalLahir),
            agama: toUpperCase(agama) || 'ISLAM',
            pendidikan: toUpperCase(pendidikan) || 'TIDAK/BELUM SEKOLAH',
            pekerjaan: toUpperCase(pekerjaan) || 'BELUM/TIDAK BEKERJA',
            statusPerkawinan: toUpperCase(statusPerkawinan) || 'BELUM MENIKAH',
            kewarganegaraan: toUpperCase(kewarganegaraan) || 'WNI',
            namaAyah: toUpperCase(namaAyah) || '-',
            namaIbu: toUpperCase(namaIbu) || '-',
            namaPanggilan: namaPanggilan ? toUpperCase(namaPanggilan) : null,
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
            keterangan: keterangan || null,
          },
        });
        imported++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Import Penduduk] DB Error row ${i + 1} (${namaLengkap}, NIK:${nik}):`, msg);
        errors.push(`Baris ${i + 1}: ${namaLengkap} - ${msg.substring(0, 100)}`);
      }
    }

    console.log(`[Import Penduduk] RESULT: imported=${imported}, skipped=${skipped}, dateFails=${dateParseFails}, dbErrors=${errors.length - dateParseFails}`);

    return NextResponse.json({
      message: `Berhasil mengimpor ${imported} data penduduk${skipped > 0 ? `, ${skipped} dilewati` : ''}`,
      imported,
      skipped,
      dateParseFails: dateParseFails > 0 ? dateParseFails : undefined,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });
  } catch (error) {
    console.error('[Import Penduduk] FATAL:', error);
    return NextResponse.json({ error: 'Gagal mengimpor: ' + String(error) }, { status: 500 });
  }
}
