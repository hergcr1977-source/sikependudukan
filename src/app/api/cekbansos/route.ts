import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nik } = body;

    if (!nik || nik.length !== 16) {
      return NextResponse.json({ error: 'NIK harus 16 digit' }, { status: 400 });
    }

    // Cek via API cekbansos.kemensos.go.id
    try {
      const response = await fetch('https://cekbansos.kemensos.go.id/api/bansos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://cekbansos.kemensos.go.id',
          'Referer': 'https://cekbansos.kemensos.go.id/',
        },
        body: JSON.stringify({
          nik: nik,
          kode_wilayah: '00',
          tahun: new Date().getFullYear(),
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          const first = data.data[0];
          const programs = data.data.map((item: Record<string, unknown>) => ({
            namaProgram: item.bansos_name || item.program || item.nama_program || '-',
            periode: `${item.tahun || item.periode || '-'}`,
            status: item.status || 'Aktif',
            nominal: Number(item.bantuan) || Number(item.nominal) || 0,
          }));

          return NextResponse.json({
            success: true,
            source: 'api',
            data: {
              nama: first.nama || '-',
              nik: nik,
              noKK: first.nokk || first.no_kk || '-',
              kota: first.kab_kota || '-',
              kecamatan: first.kec || first.kecamatan || '-',
              kelurahan: first.kel || first.kelurahan || '-',
              alamat: first.alamat || '-',
              programBansos: programs,
              status: 'found',
            },
          });
        }
      }
    } catch (err) {
      console.error('Cekbansos API error:', err);
    }

    // Alternatif endpoint
    try {
      const response2 = await fetch(
        `https://cekbansos.kemensos.go.id/cek-bansos/data?nik=${nik}`,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://cekbansos.kemensos.go.id/',
          },
          signal: AbortSignal.timeout(15000),
        },
      );

      if (response2.ok) {
        const text = await response2.text();
        const data = JSON.parse(text);
        const records = data.records || data.data || data.result || [];
        if (records.length > 0) {
          return NextResponse.json({
            success: true,
            source: 'api_alt',
            data: {
              nama: records[0]?.nama || '-',
              nik: nik,
              noKK: records[0]?.nokk || records[0]?.no_kk || '-',
              kota: records[0]?.kab_kota || '-',
              kecamatan: records[0]?.kec || records[0]?.kecamatan || '-',
              kelurahan: records[0]?.kel || records[0]?.kelurahan || '-',
              alamat: records[0]?.alamat || '-',
              programBansos: records.map((item: Record<string, unknown>) => ({
                namaProgram: item.bansos_name || item.program || item.nama_program || '-',
                periode: `${item.tahun || item.periode || '-'}`,
                status: item.status || 'Aktif',
                nominal: Number(item.bantuan) || Number(item.nominal) || 0,
              })),
              status: 'found',
            },
          });
        }
      }
    } catch (err2) {
      console.error('Cekbansos alt API error:', err2);
    }

    return NextResponse.json({
      success: false,
      source: 'unavailable',
      error:
        'Tidak dapat terhubung ke cekbansos.kemensos.go.id. Silakan cek manual di https://cekbansos.kemensos.go.id',
      data: null,
    });
  } catch (error) {
    console.error('Cekbansos route error:', error);
    return NextResponse.json({ error: 'Gagal mengecek data bansos' }, { status: 500 });
  }
}
