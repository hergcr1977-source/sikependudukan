import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hitungUmur, isWajibKTP } from '@/lib/utils-kependudukan';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bulan = parseInt(searchParams.get('bulan') || String(new Date().getMonth() + 1));
    const tahun = parseInt(searchParams.get('tahun') || String(new Date().getFullYear()));

    const refDate = new Date(tahun, bulan - 1, 15); // mid-month reference

    const allPenduduk = await db.penduduk.findMany();
    const allSementara = await db.pendudukSementara.findMany();
    const startDate = new Date(tahun, bulan - 1, 1);
    const endDate = new Date(tahun, bulan, 0, 23, 59, 59);
    const kejadian = await db.kejadian.findMany({
      where: { tanggal: { gte: startDate, lte: endDate } },
    });

    // Age distribution for left (0-38) and right (39-75+)
    const leftAges: { label: string; l: number; p: number }[] = [];
    const rightAges: { label: string; l: number; p: number }[] = [];

    // 0-11 BLN
    let bayiL = 0, bayiP = 0;
    // 1-38
    const leftAgeMap: Record<number, { l: number; p: number }> = {};
    for (let i = 1; i <= 38; i++) leftAgeMap[i] = { l: 0, p: 0 };
    // 39-74, 75+
    const rightAgeMap: Record<string, { l: number; p: number }> = {};
    for (let i = 39; i <= 74; i++) rightAgeMap[String(i)] = { l: 0, p: 0 };
    rightAgeMap['75+'] = { l: 0, p: 0 };

    for (const p of allPenduduk) {
      const { umurTahun, isBayi } = hitungUmur(p.tanggalLahir, refDate);
      const isL = p.jenisKelamin === 'LAKI-LAKI';

      if (isBayi) {
        if (isL) bayiL++; else bayiP++;
      } else if (umurTahun >= 1 && umurTahun <= 38) {
        if (isL) leftAgeMap[umurTahun].l++; else leftAgeMap[umurTahun].p++;
      } else if (umurTahun >= 39 && umurTahun <= 74) {
        if (isL) rightAgeMap[String(umurTahun)].l++; else rightAgeMap[String(umurTahun)].p++;
      } else if (umurTahun >= 75) {
        if (isL) rightAgeMap['75+'].l++; else rightAgeMap['75+'].p++;
      }
    }

    leftAges.push({ label: '0-11 BLN', l: bayiL, p: bayiP });
    for (let i = 1; i <= 38; i++) {
      leftAges.push({ label: String(i), l: leftAgeMap[i].l, p: leftAgeMap[i].p });
    }

    let totalLeftL = 0, totalLeftP = 0;
    for (const a of leftAges) { totalLeftL += a.l; totalLeftP += a.p; }

    for (let i = 39; i <= 74; i++) {
      rightAges.push({ label: String(i), l: rightAgeMap[String(i)].l, p: rightAgeMap[String(i)].p });
    }
    rightAges.push({ label: '75+', l: rightAgeMap['75+'].l, p: rightAgeMap['75+'].p });

    let totalRightL = 0, totalRightP = 0;
    for (const a of rightAges) { totalRightL += a.l; totalRightP += a.p; }

    // JUMLAH right side
    rightAges.push({ label: 'JUMLAH', l: totalRightL, p: totalRightP });

    // Summary
    const pendudukL = allPenduduk.filter(p => p.jenisKelamin === 'LAKI-LAKI').length;
    const pendudukP = allPenduduk.filter(p => p.jenisKelamin === 'PEREMPUAN').length;

    const wajibKTPAll = allPenduduk.filter(p => isWajibKTP(p.tanggalLahir, refDate));
    const wajibKTPL = wajibKTPAll.filter(p => p.jenisKelamin === 'LAKI-LAKI').length;
    const wajibKTPP = wajibKTPAll.filter(p => p.jenisKelamin === 'PEREMPUAN').length;

    const kkL = allPenduduk.filter(p => p.statusKeluarga === 'KEPALA KELUARGA' && p.jenisKelamin === 'LAKI-LAKI').length;
    const kkP = allPenduduk.filter(p => p.statusKeluarga === 'KEPALA KELUARGA' && p.jenisKelamin === 'PEREMPUAN').length;

    // Active sementara (based on month)
    const activeSementara = allSementara.filter(p => {
      if (!p.tanggalKeluar) return p.tanggalMasuk <= endDate;
      return p.tanggalMasuk <= endDate && p.tanggalKeluar >= startDate;
    });
    const sementaraL = activeSementara.filter(p => p.jenisKelamin === 'LAKI-LAKI').length;
    const sementaraP = activeSementara.filter(p => p.jenisKelamin === 'PEREMPUAN').length;

    // Kejadian summary
    const kejadianSummary: Record<string, { l: number; p: number }> = {};
    for (const type of ['LAHIR', 'MATI', 'PINDAH', 'DATANG']) {
      const filtered = kejadian.filter(k => k.jenisKejadian === type);
      kejadianSummary[type] = {
        l: filtered.filter(k => k.jenisKelamin === 'LAKI-LAKI').length,
        p: filtered.filter(k => k.jenisKelamin === 'PEREMPUAN').length,
      };
    }

    return NextResponse.json({
      bulan,
      tahun,
      leftAges,
      rightAges,
      totalLeftL,
      totalLeftP,
      summary: {
        penduduk: { l: pendudukL, p: pendudukP },
        wajibKTP: { l: wajibKTPL, p: wajibKTPP },
        kartuKeluarga: { l: kkL, p: kkP },
        pendudukSementara: { l: sementaraL, p: sementaraP },
        lahir: kejadianSummary['LAHIR'],
        mati: kejadianSummary['MATI'],
        pindah: kejadianSummary['PINDAH'],
        datang: kejadianSummary['DATANG'],
      },
      kejadian,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengambil data laporan' }, { status: 500 });
  }
}
