import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hitungUmur, isWajibKTP } from '@/lib/utils-kependudukan';

// POST /api/laporan/save - generate & save laporan for a given month
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bulan = parseInt(body.bulan || String(new Date().getMonth() + 1));
    const tahun = parseInt(body.tahun || String(new Date().getFullYear()));

    const reportData = await generateReportData(bulan, tahun);

    const keterangan = body.keterangan || '';

    const saved = await db.laporanBulanan.upsert({
      where: {
        bulan_tahun: { bulan, tahun },
      },
      create: {
        bulan,
        tahun,
        data: JSON.stringify(reportData),
        keterangan: keterangan || null,
      },
      update: {
        data: JSON.stringify(reportData),
        keterangan: keterangan || null,
      },
    });

    return NextResponse.json({
      success: true,
      id: saved.id,
      message: `Laporan ${bulan}/${tahun} berhasil disimpan`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal menyimpan laporan' }, { status: 500 });
  }
}

// GET /api/laporan/save - list all saved laporan
export async function GET() {
  try {
    const saved = await db.laporanBulanan.findMany({
      orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }],
    });

    const result = saved.map(s => ({
      id: s.id,
      bulan: s.bulan,
      tahun: s.tahun,
      keterangan: s.keterangan || '',
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengambil daftar laporan' }, { status: 500 });
  }
}

// PATCH /api/laporan/save - update keterangan only
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, bulan, tahun, keterangan } = body;

    let record;
    if (id) {
      record = await db.laporanBulanan.findUnique({ where: { id } });
    } else if (bulan && tahun) {
      record = await db.laporanBulanan.findUnique({
        where: { bulan_tahun: { bulan: parseInt(bulan), tahun: parseInt(tahun) } },
      });
    }

    if (!record) {
      // Auto-create if not exists
      const reportData = await generateReportData(parseInt(String(bulan)), parseInt(String(tahun)));
      record = await db.laporanBulanan.create({
        data: {
          bulan: parseInt(String(bulan)),
          tahun: parseInt(String(tahun)),
          data: JSON.stringify(reportData),
          keterangan: keterangan || null,
        },
      });
    } else {
      record = await db.laporanBulanan.update({
        where: { id: record.id },
        data: { keterangan: keterangan || null },
      });
    }

    return NextResponse.json({ success: true, message: 'Keterangan berhasil disimpan' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal menyimpan keterangan' }, { status: 500 });
  }
}

// DELETE /api/laporan/save?id=X
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');
    if (!id) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    await db.laporanBulanan.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Laporan berhasil dihapus' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal menghapus laporan' }, { status: 500 });
  }
}

// Shared report generation logic
async function generateReportData(bulan: number, tahun: number) {
  const refDate = new Date(tahun, bulan - 1, 15);

  const allPenduduk = await db.penduduk.findMany();
  const allSementara = await db.pendudukSementara.findMany();
  const startDate = new Date(tahun, bulan - 1, 1);
  const endDate = new Date(tahun, bulan, 0, 23, 59, 59);
  const kejadian = await db.kejadian.findMany({
    where: { tanggal: { gte: startDate, lte: endDate } },
  });

  const leftAges: { label: string; l: number; p: number }[] = [];
  const rightAges: { label: string; l: number; p: number }[] = [];

  let bayiL = 0, bayiP = 0;
  const leftAgeMap: Record<number, { l: number; p: number }> = {};
  for (let i = 1; i <= 38; i++) leftAgeMap[i] = { l: 0, p: 0 };
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
  rightAges.push({ label: 'JUMLAH', l: totalRightL, p: totalRightP });

  const pendudukL = allPenduduk.filter(p => p.jenisKelamin === 'LAKI-LAKI').length;
  const pendudukP = allPenduduk.filter(p => p.jenisKelamin === 'PEREMPUAN').length;

  const wajibKTPAll = allPenduduk.filter(p => isWajibKTP(p.tanggalLahir, refDate));
  const wajibKTPL = wajibKTPAll.filter(p => p.jenisKelamin === 'LAKI-LAKI').length;
  const wajibKTPP = wajibKTPAll.filter(p => p.jenisKelamin === 'PEREMPUAN').length;

  const kkL = allPenduduk.filter(p => p.statusKeluarga === 'KEPALA KELUARGA' && p.jenisKelamin === 'LAKI-LAKI').length;
  const kkP = allPenduduk.filter(p => p.statusKeluarga === 'KEPALA KELUARGA' && p.jenisKelamin === 'PEREMPUAN').length;

  const activeSementara = allSementara.filter(p => {
    if (!p.tanggalKeluar) return p.tanggalMasuk <= endDate;
    return p.tanggalMasuk <= endDate && p.tanggalKeluar >= startDate;
  });
  const sementaraL = activeSementara.filter(p => p.jenisKelamin === 'LAKI-LAKI').length;
  const sementaraP = activeSementara.filter(p => p.jenisKelamin === 'PEREMPUAN').length;

  const kejadianSummary: Record<string, { l: number; p: number }> = {};
  for (const type of ['LAHIR', 'MATI', 'PINDAH', 'DATANG']) {
    const filtered = kejadian.filter(k => k.jenisKejadian === type);
    kejadianSummary[type] = {
      l: filtered.filter(k => k.jenisKelamin === 'LAKI-LAKI').length,
      p: filtered.filter(k => k.jenisKelamin === 'PEREMPUAN').length,
    };
  }

  return {
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
  };
}
