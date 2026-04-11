'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSpreadsheet, Download, Loader2, Save, Trash2, Eye, CheckCircle2, Archive, Printer } from 'lucide-react';
import { BULAN } from '@/lib/constants';

interface AgeRow {
  label: string;
  l: number;
  p: number;
}

interface LaporanData {
  bulan: number;
  tahun: number;
  leftAges: AgeRow[];
  rightAges: AgeRow[];
  totalLeftL: number;
  totalLeftP: number;
  summary: {
    penduduk: { l: number; p: number };
    wajibKTP: { l: number; p: number };
    kartuKeluarga: { l: number; p: number };
    pendudukSementara: { l: number; p: number };
    lahir: { l: number; p: number };
    mati: { l: number; p: number };
    pindah: { l: number; p: number };
    datang: { l: number; p: number };
  };
}

interface SavedLaporan {
  id: number;
  bulan: number;
  tahun: number;
  createdAt: string;
  updatedAt: string;
}

const summarySections = [
  { key: 'penduduk' as const, label: 'PENDUDUK' },
  { key: 'wajibKTP' as const, label: 'WAJIB KTP 17+' },
  { key: 'kartuKeluarga' as const, label: 'KARTU KELUARGA' },
  { key: 'pendudukSementara' as const, label: 'PENDUDUK SEMENTARA' },
  { key: 'lahir' as const, label: 'LAHIR' },
  { key: 'mati' as const, label: 'MATI' },
  { key: 'pindah' as const, label: 'PINDAH' },
  { key: 'datang' as const, label: 'DATANG' },
];

interface TabLaporanProps {
  isAdmin?: boolean;
}

export default function TabLaporan({ isAdmin = true }: TabLaporanProps) {
  const now = new Date();
  const [bulan, setBulan] = useState(String(now.getMonth() + 1));
  const [tahun, setTahun] = useState(String(now.getFullYear()));
  const [laporanData, setLaporanData] = useState<LaporanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedLaporan, setSavedLaporan] = useState<SavedLaporan[]>([]);
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [savingKeterangan, setSavingKeterangan] = useState(false);

  // Load saved list on mount
  const loadSavedLaporan = async () => {
    try {
      const res = await fetch('/api/laporan/save');
      if (res.ok) setSavedLaporan(await res.json());
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadSavedLaporan();
  }, []);

  // Load keterangan for current bulan/tahun
  const loadKeterangan = (b: string, t: string) => {
    const found = savedLaporan.find(
      s => s.bulan === parseInt(b) && s.tahun === parseInt(t)
    );
    setKeterangan(found?.keterangan ?? '');
  };

  const generateLaporan = async () => {
    setLoading(true);
    setSaveMsg('');
    try {
      const res = await fetch(`/api/laporan?bulan=${bulan}&tahun=${tahun}`);
      if (res.ok) {
        setLaporanData(await res.json());
        loadKeterangan(bulan, tahun);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/laporan/export?bulan=${bulan}&tahun=${tahun}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Laporan_Bulanan_${BULAN[parseInt(bulan) - 1]}_${tahun}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const simpanLaporan = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/laporan/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulan: parseInt(bulan), tahun: parseInt(tahun), keterangan }),
      });
      if (res.ok) {
        const result = await res.json();
        setSaveMsg(result.message);
        loadSavedLaporan();
      }
    } catch (error) {
      console.error(error);
      setSaveMsg('Gagal menyimpan laporan');
    } finally {
      setSaving(false);
    }
  };

  const simpanKeterangan = async () => {
    setSavingKeterangan(true);
    try {
      const res = await fetch('/api/laporan/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulan: parseInt(bulan), tahun: parseInt(tahun), keterangan }),
      });
      if (res.ok) {
        loadSavedLaporan();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSavingKeterangan(false);
    }
  };

  const hapusLaporan = async (id: number) => {
    if (!confirm('Hapus laporan tersimpan ini?')) return;
    try {
      const res = await fetch(`/api/laporan/save?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadSavedLaporan();
        setSaveMsg('Laporan berhasil dihapus');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const lihatLaporan = async (savedBulan: number, savedTahun: number) => {
    setBulan(String(savedBulan));
    setTahun(String(savedTahun));
    setLoading(true);
    try {
      const res = await fetch(`/api/laporan?bulan=${savedBulan}&tahun=${savedTahun}`);
      if (res.ok) {
        const data = await res.json();
        setLaporanData(data);
        setShowRiwayat(false);
        loadKeterangan(String(savedBulan), String(savedTahun));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Check if current bulan/tahun is saved
  const isSaved = savedLaporan.some(
    s => s.bulan === parseInt(bulan) && s.tahun === parseInt(tahun)
  );

  const cetakLaporan = () => {
    if (!laporanData) return;
    const data = laporanData;
    const b = BULAN[data.bulan - 1];

    // Summary sections with their row positions (0-based from row 0 = header)
    const summaries = [
      { name: 'PENDUDUK', key: 'penduduk' as const },
      { name: 'WAJIB KTP 17+', key: 'wajibKTP' as const },
      { name: 'KARTU KELUARGA', key: 'kartuKeluarga' as const },
      { name: 'PENDUDUK SEMENTARA', key: 'pendudukSementara' as const },
      { name: 'LAHIR', key: 'lahir' as const },
      { name: 'MATI', key: 'mati' as const },
      { name: 'PINDAH', key: 'pindah' as const },
      { name: 'DATANG', key: 'datang' as const },
    ];

    // Build summary row map: which rows have summary content
    // Each section: header(row n), L/P sub(row n+1), data rowspan 2 (rows n+2, n+3), gap(row n+4)
    const summaryMap: Record<number, { type: 'header' | 'sub' | 'data' | 'gap'; section?: typeof summaries[0]; rowspan?: number }> = {};
    let row = 0;
    for (let s = 0; s < summaries.length; s++) {
      summaryMap[row] = { type: 'header', section: summaries[s] };
      summaryMap[row + 1] = { type: 'sub', section: summaries[s] };
      summaryMap[row + 2] = { type: 'data', section: summaries[s], rowspan: 2 };
      summaryMap[row + 3] = { type: 'gap' };
      if (s < summaries.length - 1) {
        summaryMap[row + 4] = { type: 'gap' };
      }
      row += 5;
    }

    const totalRows = 40; // 1 header + 39 data rows
    let html = '';

    for (let i = 0; i < totalRows; i++) {
      html += '<tr>';

      // LEFT TABLE (columns 0-2)
      if (i === 0) {
        html += '<td class="hdr">USIA</td><td class="hdr">L</td><td class="hdr">P</td>';
      } else {
        const leftItem = data.leftAges[i - 1];
        if (leftItem) {
          const isJumlah = leftItem.label === 'JUMLAH';
          html += `<td class="${isJumlah ? 'bld' : ''}">${leftItem.label}</td>`;
          html += `<td class="${isJumlah ? 'bld' : ''}">${leftItem.l ?? ''}</td>`;
          html += `<td class="${isJumlah ? 'bld' : ''}">${leftItem.p ?? ''}</td>`;
        } else {
          html += '<td></td><td></td><td></td>';
        }
      }

      // Spacer column
      html += '<td class="spacer"></td>';

      // RIGHT TABLE (columns 4-6)
      if (i === 0) {
        html += '<td class="hdr">USIA</td><td class="hdr">L</td><td class="hdr">P</td>';
      } else if (i === 38) {
        // JUMLAH row (span 2 rows)
        const jumlah = data.rightAges.find(r => r.label === 'JUMLAH');
        html += `<td class="bld" rowspan="2">JUMLAH</td>`;
        html += `<td class="bld" rowspan="2">${jumlah?.l || 0}</td>`;
        html += `<td class="bld" rowspan="2">${jumlah?.p || 0}</td>`;
      } else if (i === 39) {
        // Row 39: covered by JUMLAH rowspan - skip right columns
        // But we still need to render the left columns above, so this is fine
      } else {
        const rightIdx = i - 1;
        if (rightIdx < data.rightAges.length) {
          const rightItem = data.rightAges[rightIdx];
          if (rightItem.label !== 'JUMLAH') {
            html += `<td>${rightItem.label}</td>`;
            html += `<td>${rightItem.l ?? ''}</td>`;
            html += `<td>${rightItem.p ?? ''}</td>`;
          } else {
            html += '<td></td><td></td><td></td>';
          }
        } else {
          html += '<td></td><td></td><td></td>';
        }
      }

      // Spacer column
      html += '<td class="spacer"></td>';

      // SUMMARY TABLE (columns 8-10: Label, L/P, Jumlah)
      if (i === 39) {
        // Last row for summary - might be covered by rowspan or gap
        const sm = summaryMap[i];
        if (sm && sm.type === 'data' && sm.rowspan === 2) {
          const s = sm.section!;
          const d = data.summary[s.key];
          html += `<td class="bld" rowspan="2">${d.l}</td>`;
          html += `<td class="bld" rowspan="2">${d.p}</td>`;
          html += `<td class="bld" rowspan="2">${d.l + d.p}</td>`;
        }
      } else {
        const sm = summaryMap[i];
        if (!sm) {
          html += '<td></td><td></td><td></td>';
        } else if (sm.type === 'header') {
          const s = sm.section!;
          html += `<td class="shdr" colspan="2">${s.name}</td>`;
          html += `<td class="shdr">JUMLAH</td>`;
        } else if (sm.type === 'sub') {
          html += '<td class="shdr">L</td><td class="shdr">P</td><td></td>';
        } else if (sm.type === 'data') {
          const s = sm.section!;
          const d = data.summary[s.key];
          if (sm.rowspan === 2) {
            html += `<td class="bld" rowspan="2">${d.l}</td>`;
            html += `<td class="bld" rowspan="2">${d.p}</td>`;
            html += `<td class="bld" rowspan="2">${d.l + d.p}</td>`;
          } else {
            html += `<td class="bld">${d.l}</td>`;
            html += `<td class="bld">${d.p}</td>`;
            html += `<td class="bld">${d.l + d.p}</td>`;
          }
        } else {
          html += '<td class="gap"></td><td class="gap"></td><td class="gap"></td>';
        }
      }

      html += '</tr>';
    }

    const escHtml = (str: string) => str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Bulanan ${b} ${data.tahun}</title>
  <style>
    @page {
      size: landscape;
      margin: 8mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 8pt;
      color: #000;
      height: 100%;
      overflow: hidden;
    }
    .page {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .title-section {
      text-align: center;
      margin-bottom: 4px;
      flex-shrink: 0;
    }
    .title-section .t1 {
      font-size: 10pt;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .title-section .t2, .title-section .t3 {
      font-size: 9pt;
      line-height: 1.2;
    }
    .table-wrapper {
      flex: 1;
      min-height: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table colgroup col:nth-child(1) { width: 12%; }
    table colgroup col:nth-child(2) { width: 5%; }
    table colgroup col:nth-child(3) { width: 5%; }
    table colgroup col:nth-child(4) { width: 2%; }
    table colgroup col:nth-child(5) { width: 8%; }
    table colgroup col:nth-child(6) { width: 5%; }
    table colgroup col:nth-child(7) { width: 5%; }
    table colgroup col:nth-child(8) { width: 2%; }
    table colgroup col:nth-child(9) { width: 22%; }
    table colgroup col:nth-child(10) { width: 8%; }
    table colgroup col:nth-child(11) { width: 8%; }
    td {
      border: 1px solid #000;
      padding: 0 2px;
      text-align: center;
      vertical-align: middle;
      font-size: 7pt;
      height: 13px;
      line-height: 13px;
    }
    td.hdr {
      font-weight: bold;
      background-color: #d9d9d9;
      font-size: 7pt;
    }
    td.shdr {
      font-weight: bold;
      background-color: #d9d9d9;
      font-size: 7pt;
      border: 1px solid #000;
    }
    td.bld {
      font-weight: bold;
      font-size: 7pt;
    }
    td.gap {
      border: none;
      height: 3px;
      padding: 0;
    }
    td.spacer {
      border: none;
      padding: 0;
      width: 10px;
    }
    .bottom-section {
      display: flex;
      gap: 8mm;
      margin-top: 4px;
      flex-shrink: 0;
    }
    .keterangan-section {
      flex: 1;
      border: 1px solid #000;
    }
    .keterangan-section .ket-header {
      background-color: #d9d9d9;
      font-weight: bold;
      text-align: center;
      padding: 2px;
      border-bottom: 1px solid #000;
      font-size: 8pt;
    }
    .keterangan-section .ket-body {
      padding: 3px 4px;
      height: 35px;
      font-size: 7pt;
      overflow: hidden;
    }
    .signature {
      width: 140px;
      text-align: center;
      font-size: 8pt;
      flex-shrink: 0;
    }
    .signature .sig-name {
      margin-top: 30px;
      font-weight: bold;
      text-decoration: underline;
    }
    @media print {
      html, body { overflow: visible; height: auto; }
      .page { height: auto; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="title-section">
      <div class="t1">LAPORAN DATA (LAHIR, MENINGGAL, PINDAH DAN DATANG) PENDUDUK</div>
      <div class="t2">DESA SUKAMAJU KECAMATAN CIBUNGBULANG KABUPATEN BOGOR</div>
      <div class="t3">RT 001 RW 002 BULAN ${b} TAHUN ${data.tahun}</div>
    </div>

    <div class="table-wrapper">
      <table>
        <colgroup>
          <col /><col /><col /><col />
          <col /><col /><col /><col />
          <col /><col /><col />
        </colgroup>
        <tbody>
          ${html}
        </tbody>
      </table>
    </div>

    <div class="bottom-section">
      <div class="keterangan-section">
        <div class="ket-header">KETERANGAN PERUBAHAN PENDUDUK</div>
        <div class="ket-body">${escHtml(keterangan) || '&nbsp;'}</div>
      </div>

      <div class="signature">
        <div>CIBUNGBULANG, .....................</div>
        <div class="sig-name">KETUA RT.001 RW.002</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    }
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  const cellClass = 'border border-gray-400 px-1 py-[1px] text-center text-[11px]';
  const headerCellClass = 'border border-gray-400 px-1 py-[1px] text-center text-[11px] font-semibold bg-gray-100';
  const boldCellClass = 'border border-gray-400 px-1 py-[1px] text-center text-[11px] font-bold bg-gray-50';
  const summaryHeaderClass = 'border border-gray-400 px-1 py-[1px] text-center text-[11px] font-semibold bg-gray-100';

  const renderLeftTable = (data: LaporanData) => {
    const rows: React.ReactNode[] = [];
    rows.push(
      <tr key="lh" className="bg-gray-100">
        <td className={headerCellClass}>USIA</td>
        <td className={headerCellClass}>L</td>
        <td className={headerCellClass}>P</td>
      </tr>
    );
    for (let i = 0; i < data.leftAges.length; i++) {
      const item = data.leftAges[i];
      const isBold = item.label === 'JUMLAH';
      rows.push(
        <tr key={`ld-${i}`}>
          <td className={isBold ? boldCellClass : cellClass}>{item.label}</td>
          <td className={isBold ? boldCellClass : cellClass}>{item.l ?? ''}</td>
          <td className={isBold ? boldCellClass : cellClass}>{item.p ?? ''}</td>
        </tr>
      );
    }
    rows.push(
      <tr key="lt" className="bg-gray-50 font-bold">
        <td className={boldCellClass}>JUMLAH</td>
        <td className={boldCellClass}>{data.totalLeftL}</td>
        <td className={boldCellClass}>{data.totalLeftP}</td>
      </tr>
    );
    return (
      <table className="border-collapse flex-shrink-0">
        <colgroup><col style={{ width: '30px' }} /><col style={{ width: '30px' }} /><col style={{ width: '30px' }} /></colgroup>
        <tbody>{rows}</tbody>
      </table>
    );
  };

  const renderRightTable = (data: LaporanData) => {
    const rows: React.ReactNode[] = [];
    const rightDataOnly = data.rightAges.filter(r => r.label !== 'JUMLAH');
    const jumlah = data.rightAges.find(r => r.label === 'JUMLAH');
    rows.push(
      <tr key="rh" className="bg-gray-100">
        <td className={headerCellClass}>USIA</td>
        <td className={headerCellClass}>L</td>
        <td className={headerCellClass}>P</td>
      </tr>
    );
    for (let i = 0; i < rightDataOnly.length; i++) {
      const item = rightDataOnly[i];
      rows.push(
        <tr key={`rd-${i}`}>
          <td className={cellClass}>{item.label}</td>
          <td className={cellClass}>{item.l ?? ''}</td>
          <td className={cellClass}>{item.p ?? ''}</td>
        </tr>
      );
    }
    rows.push(
      <tr key="rt" className="bg-gray-50 font-bold">
        <td className={boldCellClass}>JUMLAH</td>
        <td className={boldCellClass}>{jumlah?.l || 0}</td>
        <td className={boldCellClass}>{jumlah?.p || 0}</td>
      </tr>
    );
    return (
      <table className="border-collapse flex-shrink-0">
        <colgroup><col style={{ width: '30px' }} /><col style={{ width: '30px' }} /><col style={{ width: '30px' }} /></colgroup>
        <tbody>{rows}</tbody>
      </table>
    );
  };

  const renderSummaryTable = (data: LaporanData) => {
    const rows: React.ReactNode[] = [];
    for (let s = 0; s < summarySections.length; s++) {
      const section = summarySections[s];
      const item = data.summary[section.key];
      rows.push(
        <tr key={`sh-${s}`}>
          <td colSpan={2} className={summaryHeaderClass}>{section.label}</td>
          <td rowSpan={2} className={`${summaryHeaderClass} align-middle`}>JUMLAH</td>
        </tr>
      );
      rows.push(
        <tr key={`slp-${s}`}>
          <td className={summaryHeaderClass}>L</td>
          <td className={summaryHeaderClass}>P</td>
        </tr>
      );
      rows.push(
        <tr key={`sd1-${s}`}>
          <td rowSpan={2} className={`${cellClass} align-middle`}>{item.l}</td>
          <td rowSpan={2} className={`${cellClass} align-middle`}>{item.p}</td>
          <td rowSpan={2} className={`${boldCellClass} align-middle`}>{item.l + item.p}</td>
        </tr>
      );
      rows.push(
        <tr key={`sd2-${s}`}>
          {/* cells covered by rowspan from row 3 */}
        </tr>
      );
      if (s < summarySections.length - 1) {
        rows.push(
          <tr key={`sg-${s}`} className="h-3">
            <td colSpan={3} className="border-0"></td>
          </tr>
        );
      }
    }
    return (
      <table className="border-collapse flex-shrink-0">
        <tbody>{rows}</tbody>
      </table>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-emerald-800">Laporan Bulanan</h2>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRiwayat(!showRiwayat)}
            className="text-xs gap-1"
          >
            <Archive className="h-3.5 w-3.5" />
            Riwayat Tersimpan ({savedLaporan.length})
          </Button>
        )}
      </div>

      {/* Riwayat Laporan Tersimpan */}
      {showRiwayat && (
        <Card className="border-emerald-200">
          <CardContent className="p-3">
            <h3 className="text-sm font-semibold text-emerald-800 mb-2">Riwayat Laporan Tersimpan</h3>
            {savedLaporan.length === 0 ? (
              <p className="text-xs text-gray-500">Belum ada laporan tersimpan.</p>
            ) : (
              <div className="space-y-1">
                {savedLaporan.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-medium">{BULAN[s.bulan - 1]} {s.tahun}</span>
                      <span className="text-gray-400">
                        (disimpan: {new Date(s.updatedAt).toLocaleDateString('id-ID')})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]" onClick={() => lihatLaporan(s.bulan, s.tahun)}>
                        <Eye className="h-3 w-3 mr-0.5" /> Lihat
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-red-500 hover:text-red-700" onClick={() => hapusLaporan(s.id)}>
                        <Trash2 className="h-3 w-3 mr-0.5" /> Hapus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium">Bulan</label>
              <Select value={bulan} onValueChange={setBulan}>
                <SelectTrigger className="w-32 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BULAN.map((b, i) => (
                    <SelectItem key={b} value={String(i + 1)}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Tahun</label>
              <Select value={tahun} onValueChange={setTahun}>
                <SelectTrigger className="w-24 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateLaporan} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buat Laporan'}
            </Button>
            {laporanData && (
              <>
                {isAdmin && (
                  <Button
                    variant="outline"
                    onClick={simpanLaporan}
                    disabled={saving}
                    className={isSaved ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : ''}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    {isSaved ? 'Perbarui' : 'Simpan'}
                  </Button>
                )}
                {isAdmin && (
                  <Button variant="outline" onClick={exportExcel} disabled={exporting}>
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                    Unduh Excel
                  </Button>
                )}
                <Button variant="outline" onClick={cetakLaporan} className="border-emerald-400 text-emerald-700 hover:bg-emerald-50">
                  <Printer className="h-4 w-4 mr-1" />
                  Cetak
                </Button>
              </>
            )}
          </div>
          {saveMsg && (
            <div className={`mt-2 text-xs flex items-center gap-1 ${saveMsg.includes('berhasil') ? 'text-emerald-600' : 'text-red-500'}`}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {saveMsg}
            </div>
          )}
          {isSaved && laporanData && (
            <div className="mt-1 text-[11px] text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Laporan bulan ini sudah tersimpan (otomatis diperbarui tiap awal bulan)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Preview */}
      {laporanData && (
        <Card>
          <CardContent className="px-2 py-3">
            <ScrollArea className="max-h-[calc(100vh-260px)]">
              <div className="flex justify-center">
              <div className="inline-block min-w-max">
                {/* Title */}
                <div className="text-center mb-1">
                  <div className="text-xs font-bold tracking-wide">
                    LAPORAN DATA (LAHIR, MENINGGAL, PINDAH DAN DATANG) PENDUDUK
                  </div>
                  <div className="text-[11px]">
                    DESA SUKAMAJU KECAMATAN CIBUNGBULANG KABUPATEN BOGOR
                  </div>
                  <div className="text-[11px]">
                    RT 001 RW 002 BULAN {BULAN[laporanData.bulan - 1]} TAHUN {laporanData.tahun}
                  </div>
                </div>

                {/* Three tables side by side */}
                <div className="flex gap-4">
                  {renderLeftTable(laporanData)}
                  {renderRightTable(laporanData)}
                  {renderSummaryTable(laporanData)}
                </div>

                {/* KETERANGAN PERUBAHAN PENDUDUK */}
                <div className="mt-3">
                  <div className="border border-gray-400">
                    <div className="bg-gray-100 text-center text-[11px] font-semibold px-1 py-[2px] border-b border-gray-400">
                      KETERANGAN PERUBAHAN PENDUDUK
                    </div>
                    <div className="p-1">
                      <textarea
                        className="w-full h-32 text-[11px] border-0 outline-none resize-none bg-transparent p-0"
                        placeholder="Tuliskan keterangan perubahan penduduk di sini..."
                        value={keterangan}
                        onChange={(e) => setKeterangan(e.target.value)}
                        onBlur={() => simpanKeterangan()}
                      />
                    </div>
                  </div>
                </div>

                {/* Signature */}
                <div className="flex justify-end mt-4 text-[11px] text-right">
                  <div className="space-y-0.5">
                    <div>CIBUNGBULANG, .....................</div>
                    <div className="mt-6">KETUA RT.001 RW.002</div>
                  </div>
                </div>
              </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {!laporanData && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Pilih bulan dan tahun, lalu klik &quot;Buat Laporan&quot;</p>
        </div>
      )}
    </div>
  );
}
