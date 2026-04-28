import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (isAuthError(session)) return session;

  try {
    const { image } = await request.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Gambar diperlukan' }, { status: 400 });
    }

    // Validasi base64
    if (!image.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Format gambar tidak valid' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key belum dikonfigurasi. Tambahkan GEMINI_API_KEY di Vercel Environment Variables.' },
        { status: 500 }
      );
    }

    // Gunakan Google Gemini API untuk Vision/OCR
    const model = 'gemini-2.0-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `Baca seluruh isi dokumen Kartu Keluarga Indonesia ini. Ekstrak SEMUA data dalam format JSON yang presisi.

PENTING:
- Tanggal lahir gunakan format YYYY-MM-DD (contoh: 1980-07-18)
- NIK dan No KK harus 16 digit angka, jangan ada spasi atau titik
- Jenis Kelamin: "LAKI-LAKI" atau "PEREMPUAN"
- Status Perkawinan: "BELUM KAWIN", "KAWIN", "CERAI HIDUP", atau "CERAI MATI"
- Status Hubungan: "KEPALA KELUARGA", "ISTRI", "ANAK", "ORANG TUA", "MERTUA", "MENANTU", "CUCU", "LAINNYA"
- Agama: "ISLAM", "KRISTEN", "KATOLIK", "HINDU", "BUDDHA", "KONGHUCU"
- Kewarganegaraan: "WNI" atau "WNA"

Output JSON dengan struktur tepat seperti ini:
{
  "noKK": "16 digit",
  "alamat": "...",
  "rt": "...",
  "rw": "...",
  "desa": "...",
  "kecamatan": "...",
  "kabupaten": "...",
  "provinsi": "...",
  "anggota": [
    {
      "nik": "16 digit",
      "namaLengkap": "...",
      "jenisKelamin": "LAKI-LAKI atau PEREMPUAN",
      "tempatLahir": "...",
      "tanggalLahir": "YYYY-MM-DD",
      "agama": "...",
      "pendidikan": "...",
      "pekerjaan": "...",
      "statusPerkawinan": "...",
      "statusKeluarga": "...",
      "kewarganegaraan": "..."
    }
  ]
}

Hanya output JSON saja, tanpa komentar atau penjelasan.`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: image.split(';')[0].split(':')[1],
                data: image.split(',')[1],
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Scan KK] Gemini API error:', response.status, errBody);
      return NextResponse.json({ error: 'Gagal memproses gambar dengan AI', detail: errBody }, { status: 500 });
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return NextResponse.json({ error: 'AI tidak dapat membaca gambar KK', detail: JSON.stringify(result) }, { status: 500 });
    }

    // Parse JSON dari response AI
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch {
      return NextResponse.json({ error: 'Format data tidak dikenali dari gambar KK', raw: content }, { status: 422 });
    }

    // Validasi minimal data
    if (!parsed.noKK || !parsed.anggota || !Array.isArray(parsed.anggota) || parsed.anggota.length === 0) {
      return NextResponse.json({ error: 'Data KK tidak lengkap, pastikan gambar KK jelas', parsed }, { status: 422 });
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[Scan KK] Error:', error);
    return NextResponse.json({ error: 'Gagal memproses gambar KK', detail: error.message }, { status: 500 });
  }
}
