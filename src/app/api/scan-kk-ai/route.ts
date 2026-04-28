import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

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

    const prompt = `Kamu adalah AI yang ahli membaca dokumen Kartu Keluarga (KK) Indonesia.

Analisis gambar Kartu Keluarga ini dan ekstrak SEMUA data ke dalam format JSON yang akurat.

PENTING:
- Baca data dengan teliti dan akurat, karakter per karakter
- Jika ada karakter yang tidak jelas, tulis sebaik mungkin
- Format tanggal lahir: YYYY-MM-DD (contoh: 1990-05-17)
- NIK harus tepat 16 digit
- No KK harus tepat 16 digit
- Status keluarga harus salah satu: KEPALA KELUARGA, ISTRI, ANAK, MERTUA, MENANTU, CUCU, LAINNYA
- Jenis kelamin: LAKI-LAKI atau PEREMPUAN
- Agama: ISLAM, KRISTEN, BUDHA, HINDU, KONGHUCU, KATOLIK, LAINNYA
- Pendidikan: TIDAK/BELUM SEKOLAH, BELUM TAMAT SD/SEDERAJAT, SD/SEDERAJAT, SMP/SEDERAJAT, SMA/SEDERAJAT, D1, D2, D3, S1, S2, S3, PAKET A, PAKET B, PAKET C, SLB
- Pekerjaan: PELAJAR/MAHASISWA, PNS, PEDAGANG, BELUM/TIDAK BEKERJA, BURUH HARIAN LEPAS, MENGURUS RUMAH TANGGA, WIRASWASTA, PEGAWAI ASN, KARYAWAN SWASTA, SOPIR, USTADZ/MUBALIGH, TNI, POLRI, PETANI/PEKEBUN
- Status perkawinan: BELUM MENIKAH, KAWIN, CERAI HIDUP, CERAI MATI

Kembalikan HANYA JSON murni tanpa markdown code block, tanpa penjelasan:
{
  "noKK": "...",
  "namaKepalaKeluarga": "...",
  "alamat": "...",
  "rt": "...",
  "rw": "...",
  "desa": "...",
  "kecamatan": "...",
  "kabupaten": "...",
  "provinsi": "...",
  "anggota": [
    {
      "nik": "...",
      "namaLengkap": "...",
      "jenisKelamin": "...",
      "tempatLahir": "...",
      "tanggalLahir": "YYYY-MM-DD",
      "agama": "...",
      "pendidikan": "...",
      "pekerjaan": "...",
      "statusPerkawinan": "...",
      "statusKeluarga": "...",
      "kewarganegaraan": "WNI"
    }
  ]}`;

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
      // Coba extract JSON dari response (kadang AI bungkus dengan ```json ... ```)
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

    // Validasi minimal
    if (!parsed.noKK && (!parsed.anggota || parsed.anggota.length === 0)) {
      return NextResponse.json({ error: 'AI tidak dapat mengenali format KK. Pastikan foto KK jelas.', raw: content.substring(0, 300) }, { status: 422 });
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[Scan KK AI] Error:', error);
    return NextResponse.json({ error: 'Gagal memproses gambar dengan AI', detail: error.message }, { status: 500 });
  }
}
