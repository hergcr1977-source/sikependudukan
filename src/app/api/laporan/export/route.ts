import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hitungUmur, isWajibKTP } from '@/lib/utils-kependudukan';
import * as XLSX from 'xlsx';

const BULAN_NAMES = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bulan = parseInt(searchParams.get('bulan') || String(new Date().getMonth() + 1));
    const tahun = parseInt(searchParams.get('tahun') || String(new Date().getFullYear()));

    const refDate = new Date(tahun, bulan - 1, 15);
    const startDate = new Date(tahun, bulan - 1, 1);
    const endDate = new Date(tahun, bulan, 0, 23, 59, 59);

    const allPenduduk = await db.penduduk.findMany();
    const allSementara = await db.pendudukSementara.findMany();
    const kejadian = await db.kejadian.findMany({
      where: { tanggal: { gte: startDate, lte: endDate } },
    });

    // === Age distribution calculation ===
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

    // Left side: 39 rows (0-11 BLN, 1..38)
    const leftData: { label: string | number; l: number; p: number }[] = [];
    leftData.push({ label: '0-11 BLN', l: bayiL, p: bayiP });
    for (let i = 1; i <= 38; i++) {
      leftData.push({ label: i, l: leftAgeMap[i].l, p: leftAgeMap[i].p });
    }

    // Right side: 37 rows (39..75+) + JUMLAH
    const rightData: { label: string | number; l: number; p: number }[] = [];
    for (let i = 39; i <= 74; i++) {
      rightData.push({ label: i, l: rightAgeMap[String(i)].l, p: rightAgeMap[String(i)].p });
    }
    rightData.push({ label: '75+', l: rightAgeMap['75+'].l, p: rightAgeMap['75+'].p });
    let totalRightL = 0, totalRightP = 0;
    for (const r of rightData) { totalRightL += r.l; totalRightP += r.p; }
    rightData.push({ label: 'JUMLAH', l: totalRightL, p: totalRightP });

    // === Summary calculations ===
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

    // Summary sections: each takes 4 rows (header + L/P sub-header + 2 merged data rows)
    // Start rows (1-based): 6, 11, 16, 21, 26, 31, 36, 41
    const summaries = [
      { name: 'PENDUDUK', l: pendudukL, p: pendudukP },
      { name: 'WAJIB KTP 17+', l: wajibKTPL, p: wajibKTPP },
      { name: 'KARTU KELUARGA', l: kkL, p: kkP },
      { name: 'PENDUDUK SEMENTARA', l: sementaraL, p: sementaraP },
      { name: 'LAHIR', l: kejadianSummary['LAHIR'].l, p: kejadianSummary['LAHIR'].p },
      { name: 'MATI', l: kejadianSummary['MATI'].l, p: kejadianSummary['MATI'].p },
      { name: 'PINDAH', l: kejadianSummary['PINDAH'].l, p: kejadianSummary['PINDAH'].p },
      { name: 'DATANG', l: kejadianSummary['DATANG'].l, p: kejadianSummary['DATANG'].p },
    ];
    const summaryStartRows = [6, 11, 16, 21, 26, 31, 36, 41];

    // === Build worksheet ===
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([[]]);

    // Column widths (A-M, 13 columns)
    ws['!cols'] = [
      { wch: 2 },   // A - spacer
      { wch: 2 },   // B - spacer
      { wch: 12 },  // C - USIA left
      { wch: 5 },   // D - L left
      { wch: 5 },   // E - P left
      { wch: 2 },   // F - spacer
      { wch: 8 },   // G - USIA right
      { wch: 5 },   // H - L right
      { wch: 5 },   // I - P right
      { wch: 2 },   // J - spacer
      { wch: 22 },  // K - summary labels
      { wch: 8 },   // L - summary P
      { wch: 8 },   // M - JUMLAH
    ];

    const merges: XLSX.Range[] = [];

    // Helper: set cell value
    const setCell = (ref: string, val: string | number) => {
      ws[ref] = { v: val, t: typeof val === 'number' ? 'n' : 's' };
    };

    // Helper: add merge range
    const addMerge = (startRef: string, endRef: string) => {
      merges.push({
        s: XLSX.utils.decode_cell(startRef),
        e: XLSX.utils.decode_cell(endRef),
      });
    };

    // ===== TITLE ROWS (Rows 2-4, 1-based) =====
    setCell('C2', 'LAPORAN DATA (LAHIR, MENINGGAL, PINDAH DAN DATANG) PENDUDUK');
    addMerge('C2', 'M2');

    setCell('C3', 'DESA SUKAMAJU KECAMATAN CIBUNGBULANG KABUPATEN BOGOR');
    addMerge('C3', 'M3');

    setCell('C4', `RT 001 RW 002 BULAN ${BULAN_NAMES[bulan - 1]} TAHUN ${tahun}`);
    addMerge('C4', 'M4');

    // Row 5: empty gap

    // ===== HEADER ROW (Row 6, 1-based) =====
    // Left age table header (NOT merged in reference)
    setCell('C6', 'USIA');
    setCell('D6', 'L');
    setCell('E6', 'P');

    // Right age table header (NOT merged in reference)
    setCell('G6', 'USIA');
    setCell('H6', 'L');
    setCell('I6', 'P');

    // Summary: PENDUDUK header
    setCell('K6', 'PENDUDUK');
    addMerge('K6', 'L6');
    setCell('M6', 'JUMLAH');
    addMerge('M6', 'M7');

    // ===== DATA ROWS (Rows 7-45, 1-based) =====
    // Left side: 39 rows at rows 7-45
    for (let i = 0; i < leftData.length; i++) {
      const row = i + 7; // 1-based row: 7 to 45
      const left = leftData[i];
      setCell(`C${row}`, left.label);
      setCell(`D${row}`, left.l);
      setCell(`E${row}`, left.p);
    }

    // Right side: 37 data rows at rows 7-43 + JUMLAH at rows 44-45 (merged)
    for (let i = 0; i < rightData.length - 1; i++) {
      const row = i + 7; // 1-based row: 7 to 43
      const right = rightData[i];
      setCell(`G${row}`, right.label);
      setCell(`H${row}`, right.l);
      setCell(`I${row}`, right.p);
    }

    // Right side JUMLAH row (rows 44-45, 1-based)
    const jumlahRight = rightData[rightData.length - 1];
    setCell('G44', 'JUMLAH');
    setCell('H44', jumlahRight.l);
    setCell('I44', jumlahRight.p);
    addMerge('G44', 'G45');
    addMerge('H44', 'H45');
    addMerge('I44', 'I45');

    // ===== SUMMARY SECTIONS =====
    for (let s = 0; s < summaries.length; s++) {
      const summary = summaries[s];
      const r = summaryStartRows[s]; // 1-based start row

      // Row r: Label (K:L merged) + JUMLAH header (M:M+1 merged)
      setCell(`K${r}`, summary.name);
      addMerge(`K${r}`, `L${r}`);
      setCell(`M${r}`, 'JUMLAH');
      addMerge(`M${r}`, `M${r + 1}`);

      // Row r+1: L/P sub-header
      setCell(`K${r + 1}`, 'L');
      setCell(`L${r + 1}`, 'P');

      // Rows r+2 to r+3: Data values (each merged across 2 rows)
      setCell(`K${r + 2}`, summary.l);
      addMerge(`K${r + 2}`, `K${r + 3}`);
      setCell(`L${r + 2}`, summary.p);
      addMerge(`L${r + 2}`, `L${r + 3}`);
      setCell(`M${r + 2}`, summary.l + summary.p);
      addMerge(`M${r + 2}`, `M${r + 3}`);
    }

    // ===== SIGNATURE (Rows 46-47, 1-based) =====
    setCell('G46', 'CIBUNGBULANG, .....................');
    addMerge('G46', 'I46');
    setCell('G47', 'KETUA RT.001 RW.002');
    addMerge('G47', 'I47');

    // Apply merges
    ws['!merges'] = merges;
    ws['!ref'] = 'A1:M47';

    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Bulanan');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=Laporan_Bulanan_${BULAN_NAMES[bulan - 1]}_${tahun}.xlsx`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengekspor laporan' }, { status: 500 });
  }
}
