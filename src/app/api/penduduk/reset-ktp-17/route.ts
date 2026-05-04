import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { hitungUmur } from '@/lib/utils-kependudukan';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

/**
 * Reset status KTP: ubah semua penduduk usia 17 tahun dari PUNYA → BELUM
 * Supaya admin mudah mengetahui siapa yang benar-benar sudah punya KTP.
 */
export async function POST() {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    const whereRT = auth.rtId ? { rtId: auth.rtId } : {};

    // Ambil semua penduduk yang statusnya PUNYA
    const allPunya = await db.penduduk.findMany({
      where: {
        ...whereRT,
        punyaKTP: 'PUNYA',
      },
      select: { id: true, namaLengkap: true, nik: true, tanggalLahir: true },
    });

    console.log(`[Reset KTP 17] Found ${allPunya.length} penduduk with PUNYA status`);

    const toUpdate: typeof allPunya = [];

    for (const p of allPunya) {
      try {
        if (!p.tanggalLahir) continue;
        const { umurTahun } = hitungUmur(String(p.tanggalLahir).split('T')[0]);
        if (umurTahun === 17) {
          toUpdate.push(p);
          console.log(`[Reset KTP 17] Will reset: ${p.namaLengkap} (${p.tanggalLahir})`);
        }
      } catch (err) {
        console.warn(`[Reset KTP 17] Skip invalid date for ${p.namaLengkap}: ${p.tanggalLahir}`);
      }
    }

    // Update semua yang usia 17 tahun → BELUM
    let updated = 0;
    if (toUpdate.length > 0) {
      const ids = toUpdate.map(p => p.id);
      const result = await db.penduduk.updateMany({
        where: { id: { in: ids } },
        data: { punyaKTP: 'BELUM' },
      });
      updated = result.count;
    }

    console.log(`[Reset KTP 17] Updated ${updated} penduduk`);

    revalidatePath('/api/penduduk');
    revalidatePath('/api/statistik');

    return NextResponse.json({
      message: `${updated} penduduk usia 17 tahun diubah dari PUNYA → BELUM`,
      updated,
      details: toUpdate.map(p => ({
        nama: p.namaLengkap,
        nik: p.nik,
        tanggalLahir: p.tanggalLahir,
      })),
    });
  } catch (error) {
    console.error('[Reset KTP 17] Error:', error);
    return NextResponse.json(
      { error: 'Gagal reset KTP usia 17 tahun: ' + String(error) },
      { status: 500 }
    );
  }
}
