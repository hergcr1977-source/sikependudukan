import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hitungUmur, isWajibKTP, formatTanggal } from '@/lib/utils-kependudukan';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allPenduduk = await db.penduduk.findMany();
    const allSementara = await db.pendudukSementara.findMany({
      where: { tanggalKeluar: null },
    });

    const kkMap = new Map<string, typeof allPenduduk>();
    for (const p of allPenduduk) {
      const members = kkMap.get(p.noKK) || [];
      members.push(p);
      kkMap.set(p.noKK, members);
    }
    const totalKK = kkMap.size;

    const pendudukL = allPenduduk.filter(p => p.jenisKelamin === 'LAKI-LAKI').length;
    const pendudukP = allPenduduk.filter(p => p.jenisKelamin === 'PEREMPUAN').length;

    const ageDist: Record<string, { l: number; p: number }> = {};
    for (const p of allPenduduk) {
      const { label, isBayi } = hitungUmur(p.tanggalLahir);
      const key = isBayi ? '0-11 BLN' : label;
      if (!ageDist[key]) ageDist[key] = { l: 0, p: 0 };
      if (p.jenisKelamin === 'LAKI-LAKI') ageDist[key].l++;
      else ageDist[key].p++;
    }

    const bayiL = ageDist['0-11 BLN']?.l || 0;
    const bayiP = ageDist['0-11 BLN']?.p || 0;

    const dpt = allPenduduk.filter(p => {
      const { umurTahun } = hitungUmur(p.tanggalLahir);
      return umurTahun >= 17;
    });
    const dptL = dpt.filter(p => p.jenisKelamin === 'LAKI-LAKI').length;
    const dptP = dpt.filter(p => p.jenisKelamin === 'PEREMPUAN').length;

    const wajibKTP = allPenduduk.filter(p => isWajibKTP(p.tanggalLahir));
    const wajibKTPL = wajibKTP.filter(p => p.jenisKelamin === 'LAKI-LAKI').length;
    const wajibKTPP = wajibKTP.filter(p => p.jenisKelamin === 'PEREMPUAN').length;

    const wajibKTPList = wajibKTP.map(p => ({
      id: p.id,
      noKK: p.noKK,
      nik: p.nik,
      namaLengkap: p.namaLengkap,
      jenisKelamin: p.jenisKelamin,
      tempatLahir: p.tempatLahir,
      tanggalLahir: formatTanggal(p.tanggalLahir),
      statusKeluarga: p.statusKeluarga,
      punyaKTP: p.punyaKTP,
    }));

    const kkL = allPenduduk.filter(p => p.statusKeluarga === 'KEPALA KELUARGA' && p.jenisKelamin === 'LAKI-LAKI').length;
    const kkP = allPenduduk.filter(p => p.statusKeluarga === 'KEPALA KELUARGA' && p.jenisKelamin === 'PEREMPUAN').length;

    const sementaraL = allSementara.filter(p => p.jenisKelamin === 'LAKI-LAKI').length;
    const sementaraP = allSementara.filter(p => p.jenisKelamin === 'PEREMPUAN').length;
    const semKKMap = new Set(allSementara.map(p => p.noKK));
    const sementaraKK = semKKMap.size;

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const kejadianBulanIni = await db.kejadian.findMany({
      where: { tanggal: { gte: startDate, lte: endDate } },
    });

    const kejadianCounts: Record<string, { l: number; p: number }> = {};
    for (const type of ['LAHIR', 'MATI', 'PINDAH', 'DATANG']) {
      const filtered = kejadianBulanIni.filter(k => k.jenisKejadian === type);
      kejadianCounts[type] = {
        l: filtered.filter(k => k.jenisKelamin === 'LAKI-LAKI').length,
        p: filtered.filter(k => k.jenisKelamin === 'PEREMPUAN').length,
      };
    }

    return NextResponse.json({
      totalKK,
      totalPenduduk: allPenduduk.length,
      pendudukL,
      pendudukP,
      bayiL,
      bayiP,
      dptL,
      dptP,
      ageDist,
      wajibKTPL,
      wajibKTPP,
      wajibKTPList,
      kkL,
      kkP,
      sementaraL,
      sementaraP,
      sementaraKK,
      kejadianCounts,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengambil statistik' }, { status: 500 });
  }
}
