import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { hitungUmur } from '@/lib/utils-kependudukan';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// One-time fix: hanya set default BELUM untuk penduduk yang belum punya status KTP
// TIDAK memaksa PUNYA untuk umur 17+ — admin yang menentukan status KTP
export async function POST() {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;
    const allPenduduk = await db.penduduk.findMany({
      select: { id: true, tanggalLahir: true, punyaKTP: true },
    });

    let updated = 0;
    for (const p of allPenduduk) {
      // Skip jika sudah punya status yang valid
      if (p.punyaKTP && ['PUNYA', 'BELUM', 'RUSAK', 'HILANG'].includes(p.punyaKTP)) continue;

      // Set default BELUM untuk yang belum punya status
      await db.penduduk.update({
        where: { id: p.id },
        data: { punyaKTP: 'BELUM' },
      });
      updated++;
    }

    revalidatePath('/api/penduduk');
    revalidatePath('/api/statistik');

    return NextResponse.json({
      message: `Status KTP diperbarui untuk ${updated} penduduk (default BELUM)`,
      updated,
      totalChecked: allPenduduk.length,
    });
  } catch (error) {
    console.error('[Fix KTP] FATAL:', error);
    return NextResponse.json({ error: 'Gagal memperbarui status KTP' }, { status: 500 });
  }
}
