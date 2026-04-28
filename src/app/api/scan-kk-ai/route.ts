import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// ============================================================
// Normalisasi field ke nilai yang valid sesuai constants.ts
// ============================================================
function normalizeAgama(v: string): string {
  if (!v) return '';
  const u = v.toUpperCase().trim();
  const map: Record<string, string> = {
    'ISLAM': 'ISLAM', 'MOSLEM': 'ISLAM', 'MUSLIM': 'ISLAM',
    'KRISTEN': 'KRISTEN', 'PROTESTAN': 'KRISTEN',
    'KATOLIK': 'KATOLIK', 'CATHOLIC': 'KATOLIK',
    'HINDU': 'HINDU', 'BUDHA': 'BUDHA', 'BUDDHA': 'BUDHA', 'BUDDHIS': 'BUDHA',
    'KONGHUCU': 'KONGHUCU', 'CONFUCIAN': 'KONGHUCU',
  };
  return map[u] || (['ISLAM','KRISTEN','BUDHA','HINDU','KONGHUCU','KATOLIK','LAINNYA'].includes(u) ? u : '');
}

function normalizePendidikan(v: string): string {
  if (!v) return '';
  const u = v.toUpperCase().trim();
  // Map variasi ke nilai resmi
  if (/TIDAK.*SEKOLAH|BELUM.*SEKOLAH/i.test(u)) return 'TIDAK/BELUM SEKOLAH';
  if (/BELUM.*TAMAT.*SD|TIDAK.*TAMAT.*SD/i.test(u)) return 'BELUM TAMAT SD/SEDERAJAT';
  if (/\bSD\b|SEKOLAH\s*DASAR/i.test(u) && !/SMP|SLTA|SMA/i.test(u)) return 'SD/SEDERAJAT';
  if (/\bSMP\b|\bSLTP\b|SEKOLAH\s*MENENGAH\s*PERTAMA/i.test(u)) return 'SMP/SEDERAJAT';
  if (/\bSMA\b|\bSLTA\b|\bSMK\b|SEKOLAH\s*MENENGAH/i.test(u)) return 'SMA/SEDERAJAT';
  if (/\bPAKET\s*A\b/i.test(u)) return 'PAKET A';
  if (/\bPAKET\s*B\b/i.test(u)) return 'PAKET B';
  if (/\bPAKET\s*C\b/i.test(u)) return 'PAKET C';
  if (/\bD1\b/i.test(u)) return 'D1';
  if (/\bD2\b/i.test(u)) return 'D2';
  if (/\bD3\b|DIPLOMA/i.test(u)) return 'D3';
  if (/\bS1\b|SARJANA/i.test(u)) return 'S1';
  if (/\bS2\b|MAGISTER/i.test(u)) return 'S2';
  if (/\bS3\b|DOKTOR/i.test(u)) return 'S3';
  if (/\bSLB\b/i.test(u)) return 'SLB';
  const valid = ['TIDAK/BELUM SEKOLAH','BELUM TAMAT SD/SEDERAJAT','SD/SEDERAJAT','SMP/SEDERAJAT','SMA/SEDERAJAT','PAKET A','PAKET B','PAKET C','SLB','D1','D2','D3','S1','S2','S3'];
  return valid.includes(u) ? u : '';
}

function normalizePekerjaan(v: string): string {
  if (!v) return '';
  const u = v.toUpperCase().trim();
  if (/PELAJAR|MAHASISWA/i.test(u)) return 'PELAJAR/MAHASISWA';
  if (/\bPNS\b|PEGAWAI\s*NEGERI/i.test(u)) return 'PNS';
  if (/PEGAWAI\s*ASN/i.test(u)) return 'PEGAWAI ASN';
  if (/\bTNI\b/i.test(u)) return 'TNI';
  if (/\bPOLRI\b|POLISI/i.test(u)) return 'POLRI';
  if (/PEDAGANG/i.test(u)) return 'PEDAGANG';
  if (/WIRASWASTA/i.test(u)) return 'WIRASWASTA';
  if (/BURUH/i.test(u)) return 'BURUH HARIAN LEPAS';
  if (/SOPIR|SUPIR|PENGEMUDI/i.test(u)) return 'SOPIR';
  if (/USTADZ|MUBALIGH/i.test(u)) return 'USTADZ/MUBALIGH';
  if (/MENGURUS\s*RUMAH\s*TANGGA|IRT/i.test(u)) return 'MENGURUS RUMAH TANGGA';
  if (/BELUM.*BEKERJA|TIDAK.*BEKERJA/i.test(u)) return 'BELUM/TIDAK BEKERJA';
  if (/KARYAWAN\s*SWASTA/i.test(u)) return 'KARYAWAN SWASTA';
  if (/PETANI/i.test(u)) return 'PEDAGANG'; // fallback
  const valid = ['PELAJAR/MAHASISWA','PNS','SOPIR','USTADZ/MUBALIGH','PEDAGANG','BELUM/TIDAK BEKERJA','BURUH HARIAN LEPAS','MENGURUS RUMAH TANGGA','WIRASWASTA','PEGAWAI ASN','KARYAWAN SWASTA','TNI','POLRI'];
  return valid.includes(u) ? u : '';
}

function normalizeStatusPerkawinan(v: string): string {
  if (!v) return '';
  const u = v.toUpperCase().trim();
  if (/KAWIN/i.test(u)) return 'KAWIN';
  if (/BELUM\s*MENIKAH|BELUM\s*KAWIN/i.test(u)) return 'BELUM MENIKAH';
  if (/CERAI\s*HIDUP/i.test(u)) return 'CERAI HIDUP';
  if (/CERAI\s*MATI/i.test(u)) return 'CERAI MATI';
  const valid = ['BELUM MENIKAH','KAWIN','CERAI HIDUP','CERAI MATI'];
  return valid.includes(u) ? u : '';
}

function normalizeStatusKeluarga(v: string): string {
  if (!v) return '';
  const u = v.toUpperCase().trim();
  if (/KEPALA/i.test(u)) return 'KEPALA KELUARGA';
  if (/ISTRI/i.test(u)) return 'ISTRI';
  if (/ANAK/i.test(u)) return 'ANAK';
  if (/MERTUA/i.test(u)) return 'MERTUA';
  if (/MENANTU/i.test(u)) return 'MENANTU';
  if (/CUCU/i.test(u)) return 'CUCU';
  const valid = ['KEPALA KELUARGA','ISTRI','ANAK','MERTUA','MENANTU','CUCU','LAINNYA'];
  return valid.includes(u) ? u : '';
}

function normalizeJenisKelamin(v: string): string {
  if (!v) return '';
  const u = v.toUpperCase().trim();
  if (/LAKI|PRIA|L\b/i.test(u) && !/PEREMPUAN/i.test(u)) return 'LAKI-LAKI';
  if (/PEREMPUAN|WANITA|P\b/i.test(u)) return 'PEREMPUAN';
  return u === 'LAKI-LAKI' || u === 'PEREMPUAN' ? u : '';
}

function normalizeTanggalLahir(v: string): string {
  if (!v) return '';
  // Jika sudah format YYYY-MM-DD
  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return v;
  // DD-MM-YYYY atau DD/MM/YYYY
  const dmyMatch = v.match(/^(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    return `${dmyMatch[3]}-${m}-${d}`;
  }
  return v;
}

function cleanNIK(nik: string): string {
  return (nik || '').replace(/\D/g, '').substring(0, 16);
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (isAuthError(session)) return session;

  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'Gambar diperlukan' }, { status: 400 });
    }

    // Validasi base64
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    if (!base64Data || base64Data.length < 1000) {
      return NextResponse.json({ error: 'Ukuran gambar terlalu kecil' }, { status: 400 });
    }

    const mimeType = imageBase64.includes('image/png') ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    // Inisialisasi ZAI SDK
    const ZAI = await import('z-ai-web-dev-sdk');
    const zai = await ZAI.create();

    const prompt = `Baca Kartu Keluarga Indonesia ini. Kembalikan JSON saja, tanpa markdown.

NILAI YANG WAJIB DIGUNAKAN (pilih salah satu yang paling cocok):
- agama: ISLAM | KRISTEN | BUDHA | HINDU | KONGHUCU | KATOLIK | LAINNYA
- pendidikan: TIDAK/BELUM SEKOLAH | BELUM TAMAT SD/SEDERAJAT | SD/SEDERAJAT | SMP/SEDERAJAT | SMA/SEDERAJAT | D1 | D2 | D3 | S1 | S2 | S3 | PAKET A | PAKET B | PAKET C | SLB
- pekerjaan: PELAJAR/MAHASISWA | PNS | SOPIR | USTADZ/MUBALIGH | PEDAGANG | BELUM/TIDAK BEKERJA | BURUH HARIAN LEPAS | MENGURUS RUMAH TANGGA | WIRASWASTA | PEGAWAI ASN | KARYAWAN SWASTA | TNI | POLRI
- statusPerkawinan: BELUM MENIKAH | KAWIN | CERAI HIDUP | CERAI MATI
- statusKeluarga: KEPALA KELUARGA | ISTRI | ANAK | MERTUA | MENANTU | CUCU | LAINNYA
- jenisKelamin: LAKI-LAKI | PEREMPUAN
- tanggalLahir: format YYYY-MM-DD (contoh: 1990-05-17)
- NIK: tepat 16 digit angka, tanpa spasi
- noKK: tepat 16 digit angka, tanpa spasi

CONTOH OUTPUT:
{"noKK":"3201010101010001","namaKepalaKeluarga":"AHMAD","alamat":"KP CEMPLANG","rt":"001","rw":"002","desa":"SUKAMAJU","kecamatan":"CIBUNGBULANG","kabupaten":"BOGOR","provinsi":"JAWA BARAT","anggota":[{"nik":"3201010101010001","namaLengkap":"AHMAD","jenisKelamin":"LAKI-LAKI","tempatLahir":"BOGOR","tanggalLahir":"1990-05-17","agama":"ISLAM","pendidikan":"SMA/SEDERAJAT","pekerjaan":"PEDAGANG","statusPerkawinan":"KAWIN","statusKeluarga":"KEPALA KELUARGA","kewarganegaraan":"WNI"}]}

PENTING: Kembalikan JSON MURNI tanpa ```json``` atau penjelasan apapun.`;

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'AI tidak dapat membaca gambar' }, { status: 422 });
    }

    // Parse JSON dari response AI
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Coba extract JSON dari response
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          parsed = JSON.parse(jsonStr);
        } catch {
          return NextResponse.json({ error: 'Gagal memproses hasil AI', raw: content.substring(0, 500) }, { status: 422 });
        }
      } else {
        return NextResponse.json({ error: 'Format AI tidak valid', raw: content.substring(0, 500) }, { status: 422 });
      }
    }

    // ============================================================
    // NORMALISASI semua field agar sesuai konstanta app
    // ============================================================
    const result: any = {
      noKK: cleanNIK(parsed.noKK),
      namaKepalaKeluarga: (parsed.namaKepalaKeluarga || parsed.namaKepala || '').toUpperCase().trim(),
      alamat: (parsed.alamat || '').trim(),
      rt: (parsed.rt || '').replace(/\D/g, '').substring(0, 3),
      rw: (parsed.rw || '').replace(/\D/g, '').substring(0, 3),
      desa: (parsed.desa || parsed.kelurahan || '').toUpperCase().trim(),
      kecamatan: (parsed.kecamatan || '').toUpperCase().trim(),
      kabupaten: (parsed.kabupaten || parsed.kabupatenKota || '').toUpperCase().trim(),
      provinsi: (parsed.provinsi || '').toUpperCase().trim(),
      anggota: [],
    };

    if (parsed.anggota && Array.isArray(parsed.anggota)) {
      result.anggota = parsed.anggota.map((a: any) => ({
        nik: cleanNIK(a.nik),
        namaLengkap: (a.namaLengkap || a.nama || '').toUpperCase().trim(),
        jenisKelamin: normalizeJenisKelamin(a.jenisKelamin),
        tempatLahir: (a.tempatLahir || '').toUpperCase().trim(),
        tanggalLahir: normalizeTanggalLahir(a.tanggalLahir),
        agama: normalizeAgama(a.agama),
        pendidikan: normalizePendidikan(a.pendidikan),
        pekerjaan: normalizePekerjaan(a.pekerjaan),
        statusPerkawinan: normalizeStatusPerkawinan(a.statusPerkawinan),
        statusKeluarga: normalizeStatusKeluarga(a.statusKeluarga),
        kewarganegaraan: /WNA/i.test(a.kewarganegaraan) ? 'WNA' : 'WNI',
      }));
    }

    // Validasi minimal
    if (!result.noKK && result.anggota.length === 0) {
      return NextResponse.json({ error: 'AI tidak dapat mengenali format KK. Pastikan foto KK jelas.' }, { status: 422 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Scan KK AI] Error:', error);
    return NextResponse.json({ error: 'Gagal memproses gambar dengan AI', detail: error.message }, { status: 500 });
  }
}
