import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toUpperCase } from '@/lib/utils-kependudukan';
import {
  ALAMAT_LENGKAP_DEFAULT, ALAMAT_DEFAULT, RT_DEFAULT, RW_DEFAULT,
  KELURAHAN_DEFAULT, KECAMATAN_DEFAULT, KABUPATEN_DEFAULT, PROVINSI_DEFAULT,
  generateAlamatLengkap,
} from '@/lib/constants';
import * as XLSX from 'xlsx';

export const maxDuration = 60;

// ========== DATE PARSER ==========
function parseTanggal(raw: any): string | null {
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return raw.toISOString().split('T')[0];
  }
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split(' ')[0];
  if (str.includes('/') || (str.includes('-') && !/^\d{4}/.test(str))) {
    const sep = str.includes('/') ? '/' : '-';
    const parts = str.split(sep);
    if (parts.length === 3) {
      const a = parseInt(parts[0]); const b = parseInt(parts[1]);
      let year = parseInt(parts[2]);
      if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
      if (a > 12) { const d = new Date(year, b - 1, a); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]; }
      if (b > 12) { const d = new Date(year, a - 1, b); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]; }
      const d = new Date(year, a - 1, b); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }
  const num = Number(str);
  if (!isNaN(num) && str === String(num) && num > 10000 && num < 80000) {
    const d = new Date(1899, 11, 30); d.setTime(d.getTime() + num * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
}

// ========== STATUS NORMALIZER ==========
function normalizeStatus(raw: string): string {
  const upper = raw.toUpperCase().trim();
  if (!upper) return 'NUMPANG KELUARGA';
  if (upper.includes('KONTRAK') || upper.includes('KONTRAN')) return 'KONTRAK';
  if (upper.includes('SEWA')) return 'SEWA';
  if (upper.includes('MENUMPANG') || upper.includes('NUMPANG')) return 'NUMPANG KELUARGA';
  if (upper.includes('KOS') || upper.includes('KOST')) return 'KOS';
  return 'NUMPANG KELUARGA';
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

function detectColumns(headerRow: any[]): Record<string, number> {
  const cols: Record<string, number> = {};
  if (!headerRow) return cols;
  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] || '').toUpperCase().trim();
    if (!h) continue;
    if (h.includes('NO. KK') || h.includes('NOKK')) { cols.NO_KK = i; continue; }
    if (h === 'NAMA' || h === 'NAMA LENGKAP') { cols.NAMA = i; continue; }
    if (h === 'NIK') { cols.NIK = i; continue; }
    if (h === 'JK' || h.includes('JENIS KELAMIN')) { cols.JK = i; continue; }
    if (h === 'STATUS KK' || (h.includes('STATUS KELUARGA') && !h.includes('PERKAWINAN') && !h.includes('KAWIN'))) { cols.STATUS_KK = i; continue; }
    if (h === 'TEMPAT' || h === 'TEMPAT LAHIR') { cols.TEMPAT = i; continue; }
    if (h === 'TGL LAHIR' || h === 'TANGGAL LAHIR' || (h.includes('LAHIR') && !h.includes('TEMPAT'))) { cols.TGL_LAHIR = i; continue; }
    if (h === 'AGAMA') { cols.AGAMA = i; continue; }
    if (h === 'PENDIDIKAN') { cols.PENDIDIKAN = i; continue; }
    if (h === 'PEKERJAAN' || h.includes('JENIS PEKERJAAN')) { cols.PEKERJAAN = i; continue; }
    if (h === 'STATUS KAWIN' || h.includes('PERKAWINAN') || h.includes('PERKAWANAN')) { cols.STATUS_KAWIN = i; continue; }
    if (h === 'WARGANEGARAAN' || h === 'KEWARGANEGARAAN' || h === 'WN' || h.includes('KEWAR')) { cols.WARGANEGARAAN = i; continue; }
    if (h === 'STATUS WARGA' || (h === 'STATUS' && !cols.STATUS_KK)) { cols.STATUS_WARGA = i; continue; }
    if (h === 'AYAH' || h.includes('NAMA AYAH') || h === 'NAMA ORANG TUA') { cols.AYAH = i; continue; }
    if (h === 'IBU' || h.includes('NAMA IBU')) { cols.IBU = i; continue; }
    if (h === 'PANGGILAN' || h.includes('NAMA PANGGILAN')) { cols.PANGGILAN = i; continue; }
    if (h === 'KETERANGAN') { cols.KETERANGAN = i; continue; }
  }
  return cols;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });

    // ===== STEP 0: Test DB connection first =====
    try {
      await db.pendudukSementara.count();
    } catch (dbError: unknown) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error('[Import Sementara] DB connection failed:', msg);
      return NextResponse.json({ error: 'Koneksi database gagal: ' + msg.substring(0, 200) }, { status: 500 });
    }

    // ===== STEP 1: Parse Excel =====
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

    console.log(`[Import Sementara] Total rows: ${rows.length}`);
    if (rows.length < 2) return NextResponse.json({ error: 'File kosong' }, { status: 400 });

    const headerIdx = findHeaderRow(rows);
    const detected = detectColumns(rows[headerIdx]);

    const COL = {
      NO_KK: detected.NO_KK ?? 0, NAMA: detected.NAMA ?? 1, NIK: detected.NIK ?? 2,
      JK: detected.JK ?? 3, STATUS_KK: detected.STATUS_KK ?? 4, TEMPAT: detected.TEMPAT ?? 5,
      TGL_LAHIR: detected.TGL_LAHIR ?? 6, AGAMA: detected.AGAMA ?? 7,
      PENDIDIKAN: detected.PENDIDIKAN ?? 8, PEKERJAAN: detected.PEKERJAAN ?? 9,
      STATUS_KAWIN: detected.STATUS_KAWIN ?? 10, WARGANEGARAAN: detected.WARGANEGARAAN ?? 11,
      STATUS_WARGA: detected.STATUS_WARGA ?? 12,
      AYAH: detected.AYAH ?? 13, IBU: detected.IBU ?? 14,
      PANGGILAN: detected.PANGGILAN ?? 15, KETERANGAN: detected.KETERANGAN ?? 16,
    };

    console.log(`[Import Sementara] Detected columns:`, COL);

    // ===== STEP 2: Pre-fetch existing NIKs for upsert tracking =====
    const existingRecords = new Map(
      (await db.pendudukSementara.findMany({ select: { nik: true, id: true } })).map(p => [p.nik, p.id])
    );
    console.log(`[Import Sementara] Existing records: ${existingRecords.size}`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let currentNoKK = '';
    const errors: string[] = [];
    let dateParseFails = 0;
    const startRow = headerIdx + 1;
    const nowDate = new Date();

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      const get = (idx: number) => {
        const val = row[idx];
        return val instanceof Date ? '' : String(val || '').trim();
      };

      const noKKRaw = get(COL.NO_KK);
      const namaLengkap = get(COL.NAMA);
      const nik = get(COL.NIK);
      const jenisKelamin = get(COL.JK);
      const statusKeluarga = get(COL.STATUS_KK);
      const tempatLahir = get(COL.TEMPAT);
      const tanggalLahir = parseTanggal(row[COL.TGL_LAHIR]);
      const agama = get(COL.AGAMA);
      const pendidikan = get(COL.PENDIDIKAN);
      const pekerjaan = get(COL.PEKERJAAN);
      const statusPerkawinan = get(COL.STATUS_KAWIN);
      const kewarganegaraan = get(COL.WARGANEGARAAN) || 'WNI';
      const statusWarga = get(COL.STATUS_WARGA);
      const namaAyah = get(COL.AYAH);
      const namaIbu = get(COL.IBU);
      const namaPanggilan = get(COL.PANGGILAN);
      const keterangan = get(COL.KETERANGAN);

      // Skip completely empty rows
      if (!namaLengkap) continue;
      if (!nik && !jenisKelamin && !tempatLahir && !statusKeluarga && !tanggalLahir) continue;

      // Track current NoKK
      if (noKKRaw) currentNoKK = noKKRaw;
      if (!currentNoKK) { skipped++; continue; }
      if (!nik) { skipped++; continue; }

      // Validate tanggal lahir
      if (!tanggalLahir) {
        dateParseFails++;
        errors.push(`Baris ${i + 1}: ${namaLengkap} - tanggal tidak valid (${String(row[COL.TGL_LAHIR]).substring(0, 30)})`);
        skipped++;
        continue;
      }

      const statusKeterangan = normalizeStatus(statusWarga);

      // Prepare the data record
      const recordData = {
        noKK: currentNoKK,
        nik: nik,
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
        statusKeterangan: statusKeterangan,
        alamatAsal: keterangan || '-',
        bantuan: '[]',
        bpjs: null,
        alamat: ALAMAT_DEFAULT,
        rt: RT_DEFAULT,
        rw: RW_DEFAULT,
        kelurahan: KELURAHAN_DEFAULT,
        kecamatan: KECAMATAN_DEFAULT,
        kabupaten: KABUPATEN_DEFAULT,
        provinsi: PROVINSI_DEFAULT,
        alamatLengkap: ALAMAT_LENGKAP_DEFAULT || generateAlamatLengkap(),
        tanggalMasuk: nowDate,
        tanggalKeluar: null,
        keterangan: keterangan || null,
      };

      try {
        if (existingRecords.has(nik)) {
          // UPDATE existing record
          const existingId = existingRecords.get(nik)!;
          await db.pendudukSementara.update({
            where: { id: existingId },
            data: recordData,
          });
          updated++;
          existingRecords.delete(nik);
        } else {
          // CREATE new record
          await db.pendudukSementara.create({ data: recordData });
          imported++;
          existingRecords.set(nik, -1);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Import Sementara] Error row ${i + 1} (${namaLengkap}):`, msg);
        errors.push(`Baris ${i + 1}: ${namaLengkap} - ${msg.substring(0, 150)}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Import Sementara] RESULT: imported=${imported}, updated=${updated}, skipped=${skipped}, dateFails=${dateParseFails}, errors=${errors.length}, time=${elapsed}s`);

    return NextResponse.json({
      message: `Berhasil: ${imported} baru ditambahkan, ${updated} diperbarui${skipped > 0 ? `, ${skipped} dilewati` : ''}`,
      imported,
      updated,
      skipped,
      dateParseFails: dateParseFails > 0 ? dateParseFails : undefined,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      elapsed: elapsed + 's',
    });
  } catch (error) {
    console.error('[Import Sementara] FATAL:', error);
    return NextResponse.json({ error: 'Gagal mengimpor: ' + String(error) }, { status: 500 });
  }
}
