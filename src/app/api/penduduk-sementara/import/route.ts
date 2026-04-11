import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toUpperCase } from '@/lib/utils-kependudukan';
import { ALAMAT_LENGKAP_DEFAULT, ALAMAT_DEFAULT, RT_DEFAULT, RW_DEFAULT, KELURAHAN_DEFAULT, KECAMATAN_DEFAULT, KABUPATEN_DEFAULT, PROVINSI_DEFAULT } from '@/lib/constants';
import * as XLSX from 'xlsx';

function parseTanggal(raw: string | null | undefined): string | null {
  if (!raw) return null;
  raw = String(raw).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.split(' ')[0];
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
  const num = Number(raw);
  if (!isNaN(num) && raw === String(num)) {
    const d = new Date(1899, 11, 30);
    d.setTime(d.getTime() + num * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  if (raw.includes('-')) return raw.split(' ')[0];
  return null;
}

function normalizeStatus(raw: string): string {
  const upper = raw.toUpperCase().trim();
  if (!upper) return 'NUMPANG KELUARGA';
  if (upper.includes('KONTRAK') || upper.includes('KONTRAN')) return 'KONTRAK';
  if (upper.includes('SEWA')) return 'SEWA';
  if (upper.includes('MENUMPANG') || upper.includes('NUMPANG')) return 'NUMPANG KELUARGA';
  if (upper.includes('KOS') || upper.includes('KOST')) return 'KOS';
  return 'NUMPANG KELUARGA';
}

// Format Excel penduduk sementara:
// Kolom 12 = Status Warga, sehingga Ayah/Ibu bergeser ke 13/14
const COL = {
  NO_KK: 0,
  NAMA: 1,
  NIK: 2,
  JK: 3,
  STATUS_KK: 4,
  TEMPAT: 5,
  TGL_LAHIR: 6,
  AGAMA: 7,
  PENDIDIKAN: 8,
  PEKERJAAN: 9,
  STATUS_KAWIN: 10,
  WARGANEGARAAN: 11,
  STATUS_WARGA: 12,   // Khusus penduduk sementara
  AYAH: 13,             // Bergeser karena kolom Status Warga
  IBU: 14,              // Bergeser karena kolom Status Warga
  PANGGILAN: 15,        // Bergeser karena kolom Status Warga
  KETERANGAN: 16,       // Bergeser karena kolom Status Warga
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });
    }

    // Auto-migration
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
      console.warn('Auto-migration:', e);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][];

    if (rows.length < 3) {
      return NextResponse.json({ error: 'File kosong atau tidak memiliki cukup data' }, { status: 400 });
    }

    // Pre-fetch NIK yang sudah ada
    const existingNIKs = new Set(
      (await db.pendudukSementara.findMany({ select: { nik: true } })).map(p => p.nik)
    );

    let imported = 0;
    let skipped = 0;
    let currentNoKK = '';
    const errors: string[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      const get = (idx: number) => String(row[idx] || '').trim();

      const noKKRaw = get(COL.NO_KK);
      const namaLengkap = get(COL.NAMA);
      const nik = get(COL.NIK);
      const jenisKelamin = get(COL.JK);
      const statusKeluarga = get(COL.STATUS_KK);
      const tempatLahir = get(COL.TEMPAT);
      const tanggalLahirRaw = get(COL.TGL_LAHIR);
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

      // Skip baris kosong
      if (!namaLengkap) continue;

      // Skip baris yang bukan data
      if (!nik && !jenisKelamin && !tempatLahir && !statusKeluarga) continue;

      // Track No KK
      if (noKKRaw) currentNoKK = noKKRaw;

      // Validasi dasar
      if (!currentNoKK) { skipped++; continue; }
      if (!nik) { skipped++; continue; }

      // Cek duplikat
      if (existingNIKs.has(nik)) { skipped++; continue; }

      // Parse tanggal
      const tanggalLahir = parseTanggal(tanggalLahirRaw);
      if (!tanggalLahir) { skipped++; continue; }

      // Tandai NIK sudah diproses
      existingNIKs.add(nik);

      const statusKeterangan = normalizeStatus(statusWarga);

      try {
        await db.pendudukSementara.create({
          data: {
            noKK: currentNoKK,
            nik: nik,
            namaLengkap: toUpperCase(namaLengkap),
            jenisKelamin: toUpperCase(jenisKelamin),
            statusKeluarga: toUpperCase(statusKeluarga) || 'KEPALA KELUARGA',
            tempatLahir: toUpperCase(tempatLahir),
            tanggalLahir: new Date(tanggalLahir),
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
        imported++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Import Sementara] Error baris ${i + 1} (${namaLengkap}):`, msg);
        errors.push(`Baris ${i + 1}: ${namaLengkap} - ${msg.substring(0, 80)}`);
      }
    }

    return NextResponse.json({
      message: `Berhasil mengimpor ${imported} data penduduk sementara${skipped > 0 ? `, ${skipped} dilewati` : ''}`,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Import Sementara] Fatal error:', error);
    return NextResponse.json({ error: 'Gagal mengimpor: ' + String(error) }, { status: 500 });
  }
}
