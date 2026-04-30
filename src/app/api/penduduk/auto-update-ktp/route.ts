import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hitungUmur } from '@/lib/utils-kependudukan';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

/**
 * Auto-update status punyaKTP berdasarkan usia saat ini.
 * Dipanggil otomatis oleh frontend saat halaman dimuat / periodik.
 *
 * Logic (DIPERBAIKI - tidak memaksa PUNYA untuk umur 17+):
 * - Usia < 17 tahun → punyaKTP = 'BELUM' (belum wajib)
 * - Usia >= 17 tahun → JANGAN ubah, biarkan apa adanya (admin yang mengatur)
 * - Status RUSAK / HILANG tetap dipertahankan (tidak diubah)
 * - Status null / empty → set berdasarkan usia
 */
export async function POST() {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    const whereRT = auth.rtId ? { rtId: auth.rtId } : {};

    // Ambil semua penduduk
    const allPenduduk = await db.penduduk.findMany({
      where: whereRT,
      select: { id: true, tanggalLahir: true, punyaKTP: true },
    });

    let updated = 0;
    const batch: { id: number; punyaKTP: string }[] = [];

    for (const p of allPenduduk) {
      if (!p.tanggalLahir) continue;

      // Jika status sudah diisi oleh admin (PUNYA, BELUM, RUSAK, HILANG), JANGAN ubah
      if (p.punyaKTP && ['PUNYA', 'BELUM', 'RUSAK', 'HILANG'].includes(p.punyaKTP)) {
        continue;
      }

      // Hanya update jika status masih null/empty — set default berdasarkan usia
      try {
        const { umurTahun } = hitungUmur(p.tanggalLahir);
        const defaultStatus = umurTahun >= 17 ? 'BELUM' : 'BELUM'; // default BELUM untuk semua
        batch.push({ id: p.id, punyaKTP: defaultStatus });
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
