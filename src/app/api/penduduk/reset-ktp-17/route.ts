import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { hitungUmur } from '@/lib/utils-kependudukan';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

/**
 * Reset status KTP: ubah semua penduduk usia 17 tahun dari PUNYA → BELUM
 * Supaya admin mudah mengetahui siapa yang benar-benar sudah punya KTP.
 * Bisa dipanggil langsung dari browser (GET) atau POST.
 */
export async function GET() {
  return resetKTP17();
}

export async function POST() {
  return resetKTP17();
}

async function resetKTP17() {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    const whereRT = auth.rtId ? { rtId: auth.rtId } : {};

    // Ambil semua penduduk yang statusnya PUNYA dan punya tanggal lahir
    const allPunya = await db.penduduk.findMany({
      where: {
        ...whereRT,
        punyaKTP: 'PUNYA',
        tanggalLahir: { not: null },
      },
      select: { id: true, namaLengkap: true, nik: true, tanggalLahir: true },
    });

    const toUpdate: typeof allPunya = [];

    for (const p of allPunya) {
      try {
        const { umurTahun } = hitungUmur(p.tanggalLahir);
        if (umurTahun === 17) {
          toUpdate.push(p);
        }
      } catch {
        // skip invalid dates
      }
    }

    // Update semua yang usia 17 tahun → BELUM
    let updated = 0;
    for (const p of toUpdate) {
      await db.penduduk.update({
        where: { id: p.id },
        data: { punyaKTP: 'BELUM' },
      });
      updated++;
    }

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
    return NextResponse.json({ error: 'Gagal reset KTP usia 17 tahun' }, { status: 500 });
  }
}
