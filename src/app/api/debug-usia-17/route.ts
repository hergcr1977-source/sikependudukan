import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hitungUmur, formatTanggal, isTanggalLahirInvalid } from '@/lib/utils-kependudukan';
import { requireAuth, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthError(auth)) return auth;

    const whereRT = auth.rtId ? { rtId: auth.rtId } : {};

    // Ambil semua penduduk yang punya tanggal lahir
    const allPenduduk = await db.penduduk.findMany({
      where: {
        ...whereRT,
        tanggalLahir: { not: null },
      },
      select: {
        id: true,
        namaLengkap: true,
        nik: true,
        tanggalLahir: true,
        jenisKelamin: true,
        punyaKTP: true,
      },
    });

    const now = new Date();
    const serverTimezone = now.toString(); // untuk cek timezone server

    // Cari yang usianya dekat 17 (16-18 tahun)
    const near17 = allPenduduk.filter(p => {
      try {
        const { umurTahun } = hitungUmur(p.tanggalLahir);
        return umurTahun >= 15 && umurTahun <= 19;
      } catch {
        return false;
      }
    }).map(p => {
      const { umurTahun, label } = hitungUmur(p.tanggalLahir);
      const rawDate = String(p.tanggalLahir);
      const invalid = isTanggalLahirInvalid(p.tanggalLahir);
      return {
        id: p.id,
        nama: p.namaLengkap,
        nik: p.nik,
        rawTanggalLahir: rawDate,
        umurTahun,
        label,
        punyaKTP: p.punyaKTP,
        isInvalidDate: invalid,
      };
    });

    // Juga cek yang usia tepat 17
    const exactly17 = near17.filter(p => p.umurTahun === 17);

    return NextResponse.json({
      serverTime: serverTimezone,
      serverTimestamp: now.toISOString(),
      totalPendudukWithBirthdate: allPenduduk.length,
      near17Count: near17.length,
      exactly17Count: exactly17.length,
      near17,
      exactly17,
    });
  } catch (error) {
    console.error('[Debug Usia 17] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
