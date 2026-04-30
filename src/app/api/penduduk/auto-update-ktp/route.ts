import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hitungUmur } from '@/lib/utils-kependudukan';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

/**
 * Auto-update status punyaKTP berdasarkan usia saat ini.
 * Dipanggil otomatis oleh frontend saat halaman dimuat / periodik.
 *
 * Logic:
 * - Usia < 17 tahun → punyaKTP = 'BELUM'
 * - Usia >= 17 tahun → punyaKTP = 'PUNYA'
 * - Status RUSAK / HILANG tetap dipertahankan (tidak diubah)
 */
export async function POST() {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    const whereRT = auth.rtId ? { rtId: auth.rtId } : {};

    // Ambil semua penduduk yang bukan RUSAK/HILANG
    const allPenduduk = await db.penduduk.findMany({
      where: {
        ...whereRT,
        punyaKTP: { notIn: ['RUSAK', 'HILANG'] },
      },
      select: { id: true, tanggalLahir: true, punyaKTP: true },
    });

    let updated = 0;
    const batch: { id: number; punyaKTP: string }[] = [];

    for (const p of allPenduduk) {
      if (!p.tanggalLahir) continue;
      try {
        const { umurTahun } = hitungUmur(p.tanggalLahir);
        const shouldHave = umurTahun >= 17 ? 'PUNYA' : 'BELUM';
        if (p.punyaKTP !== shouldHave) {
          batch.push({ id: p.id, punyaKTP: shouldHave });
        }
      } catch {
        // skip invalid dates
      }
    }

    // Update per-record
    for (const item of batch) {
      try {
        await db.penduduk.update({
          where: { id: item.id },
          data: { punyaKTP: item.punyaKTP },
        });
        updated++;
      } catch {
        // skip individual errors
      }
    }

    return NextResponse.json({
      success: true,
      checked: allPenduduk.length,
      updated,
    });
  } catch (error) {
    console.error('[Auto-update KTP] Error:', error);
    return NextResponse.json({ error: 'Gagal auto-update KTP' }, { status: 500 });
  }
}
