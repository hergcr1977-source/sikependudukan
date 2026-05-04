import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toUpperCase } from '@/lib/utils-kependudukan';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

/**
 * Endpoint sekali pakai untuk mensinkronkan semua kejadian lama ke data penduduk.
 * - DATANG/LAHIR: buat penduduk jika belum ada
 * - MATI/PINDAH: hapus penduduk jika ada (PINDAH mengecualikan yang juga punya DATANG)
 *
 * Setelah dipanggil, semua data kejadian lama akan tercermin di data penduduk.
 * Kejadian yang dihapus setelah ini TIDAK akan mempengaruhi data penduduk.
 */
export async function POST() {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    const rtId = auth.rtId || 1;
    const results = { datang: 0, lahir: 0, mati: 0, pindah: 0, errors: [] as string[] };

    // ===== 1. DATANG: Buat penduduk dari kejadian DATANG yang punya NIK =====
    const datangList = await db.kejadian.findMany({
      where: { jenisKejadian: 'DATANG', rtId, nik: { not: null } },
    });

    for (const k of datangList) {
      if (!k.nik) continue;
      try {
        const existing = await db.penduduk.findUnique({ where: { nik: k.nik } });
        if (!existing) {
          await db.penduduk.create({
            data: {
              rtId: k.rtId,
              noKK: k.noKK || '',
              nik: k.nik,
              namaLengkap: toUpperCase(k.namaLengkap),
              jenisKelamin: toUpperCase(k.jenisKelamin) || 'LAKI-LAKI',
              statusKeluarga: 'LAINNYA',
              tempatLahir: '-',
              tanggalLahir: k.tanggal,
              agama: 'ISLAM',
              pendidikan: '-',
              pekerjaan: 'BELUM/TIDAK BEKERJA',
              statusPerkawinan: 'BELUM MENIKAH',
              kewarganegaraan: 'WNI',
              namaAyah: '-',
              namaIbu: '-',
              punyaKTP: 'BELUM',
            },
          });
          results.datang++;
        }
      } catch (e: any) {
        results.errors.push(`DATANG ${k.namaLengkap} (${k.nik}): ${e.message}`);
      }
    }

    // ===== 2. LAHIR: Buat penduduk dari kejadian LAHIR yang punya NIK =====
    const lahirList = await db.kejadian.findMany({
      where: { jenisKejadian: 'LAHIR', rtId, nik: { not: null } },
    });

    for (const k of lahirList) {
      if (!k.nik) continue;
      try {
        const existing = await db.penduduk.findUnique({ where: { nik: k.nik } });
        if (!existing) {
          // Cari namaAyah dari kepala KK
          let namaAyah = '-';
          let namaIbu = '-';
          if (k.noKK) {
            const kkHead = await db.penduduk.findFirst({
              where: { noKK: k.noKK, statusKeluarga: 'KEPALA KELUARGA', rtId },
            });
            if (kkHead) namaAyah = kkHead.namaLengkap || '-';
            const istri = await db.penduduk.findFirst({
              where: { noKK: k.noKK, jenisKelamin: 'PEREMPUAN', rtId },
            });
            if (istri) namaIbu = istri.namaLengkap || '-';
          }

          await db.penduduk.create({
            data: {
              rtId: k.rtId,
              noKK: k.noKK || '',
              nik: k.nik,
              namaLengkap: toUpperCase(k.namaLengkap),
              jenisKelamin: toUpperCase(k.jenisKelamin) || 'LAKI-LAKI',
              statusKeluarga: 'ANAK',
              tempatLahir: '-',
              tanggalLahir: k.tanggal,
              agama: 'ISLAM',
              pendidikan: 'TIDAK/BELUM SEKOLAH',
              pekerjaan: 'BELUM/TIDAK BEKERJA',
              statusPerkawinan: 'BELUM MENIKAH',
              kewarganegaraan: 'WNI',
              namaAyah,
              namaIbu,
              punyaKTP: 'BELUM',
            },
          });
          results.lahir++;
        }
      } catch (e: any) {
        results.errors.push(`LAHIR ${k.namaLengkap} (${k.nik}): ${e.message}`);
      }
    }

    // ===== 3. MATI: Hapus penduduk berdasarkan NIK =====
    const matiList = await db.kejadian.findMany({
      where: { jenisKejadian: 'MATI', rtId, nik: { not: null } },
    });

    for (const k of matiList) {
      if (!k.nik) continue;
      try {
        const del = await db.penduduk.deleteMany({ where: { nik: k.nik } });
        if (del.count > 0) results.mati++;
      } catch (_e) {
        // Penduduk tidak ditemukan, skip
      }
    }

    // ===== 4. PINDAH: Hapus penduduk berdasarkan NIK, kecuali yang juga punya DATANG =====
    const pindahList = await db.kejadian.findMany({
      where: { jenisKejadian: 'PINDAH', rtId, nik: { not: null } },
    });

    // Kumpulkan NIK yang juga punya kejadian DATANG (agar tidak dihapus)
    const datangNiks = new Set(
      datangList.filter(k => k.nik).map(k => k.nik!)
    );

    for (const k of pindahList) {
      if (!k.nik) continue;
      if (datangNiks.has(k.nik)) continue; // Sudah DATANG, jangan hapus
      try {
        const del = await db.penduduk.deleteMany({ where: { nik: k.nik } });
        if (del.count > 0) results.pindah++;
      } catch (_e) {
        // Penduduk tidak ditemukan, skip
      }
    }

    return NextResponse.json({
      message: 'Sinkronisasi selesai',
      results,
      totalProcessed: results.datang + results.lahir + results.mati + results.pindah,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Gagal sinkronisasi' }, { status: 500 });
  }
}
