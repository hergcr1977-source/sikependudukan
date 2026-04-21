import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { hitungUmur } from '@/lib/utils-kependudukan';

export const dynamic = 'force-dynamic';

// One-time fix: update all penduduk KTP status based on age >= 19
export async function POST() {
  try {
    const allPenduduk = await db.penduduk.findMany({
      select: { id: true, tanggalLahir: true, punyaKTP: true },
    });

    let updated = 0;
    for (const p of allPenduduk) {
      // Skip if already RUSAK or HILANG
      if (p.punyaKTP === 'RUSAK' || p.punyaKTP === 'HILANG') continue;

      const umur = hitungUmur(p.tanggalLahir);
      const shouldHave = umur.umurTahun >= 19 ? 'PUNYA' : 'BELUM';

      if (p.punyaKTP !== shouldHave) {
        await db.penduduk.update({
          where: { id: p.id },
          data: { punyaKTP: shouldHave },
        });
        updated++;
      }
    }

    revalidatePath('/api/penduduk');
    revalidatePath('/api/statistik');

    return NextResponse.json({
      message: `Status KTP diperbarui untuk ${updated} penduduk`,
      updated,
      totalChecked: allPenduduk.length,
    });
  } catch (error) {
    console.error('[Fix KTP] FATAL:', error);
    return NextResponse.json({ error: 'Gagal memperbarui status KTP' }, { status: 500 });
  }
}
