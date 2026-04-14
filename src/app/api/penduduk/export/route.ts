import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatTanggal } from '@/lib/utils-kependudukan';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const penduduk = await db.penduduk.findMany({
      orderBy: [{ noKK: 'asc' }, { statusKeluarga: 'asc' }],
    });

    if (penduduk.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data untuk diekspor' }, { status: 400 });
    }

    // Header sesuai format import: NO. KK, NAMA, NIK, JK, STATUS KK, TEMPAT, TGL LAHIR, AGAMA, PENDIDIKAN, PEKERJAAN, STATUS KAWIN, WARGANEGARAAN, AYAH, IBU, PANGGILAN, KETERANGAN
    const headers = [
      'NO. KK', 'NAMA', 'NIK', 'JK', 'STATUS KK',
      'TEMPAT', 'TGL LAHIR', 'AGAMA', 'PENDIDIKAN', 'PEKERJAAN',
      'STATUS KAWIN', 'WARGANEGARAAN', 'AYAH', 'IBU', 'PANGGILAN', 'KETERANGAN',
    ];

    const data = penduduk.map(p => [
      p.noKK,
      p.namaLengkap,
      p.nik,
      p.jenisKelamin === 'LAKI-LAKI' ? 'L' : p.jenisKelamin === 'PEREMPUAN' ? 'P' : p.jenisKelamin,
      p.statusKeluarga,
      p.tempatLahir,
      formatTanggal(p.tanggalLahir),
      p.agama,
      p.pendidikan,
      p.pekerjaan,
      p.statusPerkawinan,
      p.kewarganegaraan,
      p.namaAyah,
      p.namaIbu,
      p.namaPanggilan || '',
      p.keterangan || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Atur lebar kolom
    ws['!cols'] = [
      { wch: 20 }, // NO. KK
      { wch: 25 }, // NAMA
      { wch: 20 }, // NIK
      { wch: 5 },  // JK
      { wch: 20 }, // STATUS KK
      { wch: 15 }, // TEMPAT
      { wch: 14 }, // TGL LAHIR
      { wch: 10 }, // AGAMA
      { wch: 25 }, // PENDIDIKAN
      { wch: 25 }, // PEKERJAAN
      { wch: 18 }, // STATUS KAWIN
      { wch: 15 }, // WARGANEGARAAN
      { wch: 25 }, // AYAH
      { wch: 25 }, // IBU
      { wch: 15 }, // PANGGILAN
      { wch: 25 }, // KETERANGAN
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Penduduk');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="data-penduduk-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[Export Penduduk] FATAL:', error);
    return NextResponse.json({ error: 'Gagal mengekspor data' }, { status: 500 });
  }
}
