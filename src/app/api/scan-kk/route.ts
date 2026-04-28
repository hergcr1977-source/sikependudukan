import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// Kompresi gambar agar tidak terlalu besar untuk API
function compressBase64Image(base64: string): string {
  const matches = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!matches) return base64;
  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  // Jika kurang dari 2MB, kirim apa adanya
  if (buffer.length < 2 * 1024 * 1024) return base64;
  // Jika lebih dari 2MB, turunkan quality dengan resize (jadikan JPEG jika bukan)
  return `data:image/jpeg;base64,${matches[2]}`;
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (isAuthError(session)) return session;

  try {
    const { image } = await request.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Gambar diperlukan' }, { status: 400 });
    }

    if (!image.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Format gambar tidak valid' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyDqkmUR2l61JCPcPUzchi2ng3zNHyDLBfw';
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key belum dikonfigurasi.' },
        { status: 500 }
      );
    }

    // Kompresi gambar jika terlalu besar
    const processedImage = compressBase64Image(image);
    const mimeMatch = processedImage.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = processedImage.split(',')[1];

    // Gunakan Google Gemini API
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

    const geminiBody: any = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    };

    console.log('[Scan KK] Sending to Gemini API...', { mimeType, imageSize: Buffer.from(base64Data, 'base64').length });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Scan KK] Gemini API error:', response.status, errText);
      let errMsg = 'Gagal memproses gambar dengan AI';
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errMsg;
      } catch {}
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      const blockReason = result.candidates?.[0]?.finishReason;
      console.error('[Scan KK] No content from Gemini:', JSON.stringify(result).substring(0, 500));
      return NextResponse.json(
        { error: `AI tidak dapat membaca gambar. ${blockReason === 'SAFETY' ? 'Gambar diblokir oleh filter keamanan AI.' : 'Pastikan gambar KK jelas dan tidak blur.'}` },
        { status: 500 }
      );
    }

    // Parse JSON dari response AI
    let parsed;
    try {
      // Coba extract JSON dari response (mungkin ada markdown code block)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch {
      console.error('[Scan KK] Failed to parse AI response:', content.substring(0, 500));
      return NextResponse.json({ error: 'Format data tidak dikenali dari gambar KK' }, { status: 422 });
    }

    // Validasi minimal data
    if (!parsed.noKK || !parsed.anggota || !Array.isArray(parsed.anggota) || parsed.anggota.length === 0) {
      return NextResponse.json({ error: 'Data KK tidak lengkap, pastikan gambar KK jelas' }, { status: 422 });
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[Scan KK] Error:', error);
    return NextResponse.json({ error: 'Gagal memproses gambar KK', detail: error.message }, { status: 500 });
  }
}
