import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, isAuthError } from '@/lib/auth-server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    const penerima = await db.$queryRawUnsafe<Array<{
      id: number;
      noKK: string;
      nik: string;
      namaLengkap: string;
      jenisKelamin: string;
      statusKeluarga: string;
      tanggalLahir: string;
      alamat: string;
      rt: string;
      rw: string;
      keterangan: string | null;
    }>>(`
      SELECT * FROM "PenerimaSembako" ORDER BY "namaLengkap" ASC
    `);

    if (penerima.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data untuk diekspor' }, { status: 400 });
    }

    const headers = [
      'No', 'No KK', 'NIK', 'Nama Lengkap', 'Jenis Kelamin',
      'Status Keluarga', 'Alamat', 'RT/RW', 'Keterangan',
    ];

    const data = penerima.map((p, i) => [
      i + 1,
      p.noKK,
      p.nik,
      p.namaLengkap,
      p.jenisKelamin === 'LAKI-LAKI' ? 'L' : p.jenisKelamin === 'PEREMPUAN' ? 'P' : p.jenisKelamin,
      p.statusKeluarga,
      p.alamat || 'KP. CEMPLANG',
      `${p.rt || '001'}/${p.rw || '002'}`,
      p.keterangan || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 20 },  // No KK
      { wch: 20 },  // NIK
      { wch: 25 },  // Nama Lengkap
      { wch: 12 },  // Jenis Kelamin
      { wch: 20 },  // Status Keluarga
      { wch: 25 },  // Alamat
      { wch: 10 },  // RT/RW
      { wch: 25 },  // Keterangan
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Penerima Sembako');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const today = new Date().toISOString().split('T')[0];

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="penerima_sembako_desa_${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[Export Sembako] Error:', error);
    return NextResponse.json({ error: 'Gagal mengekspor data' }, { status: 500 });
  }
}
