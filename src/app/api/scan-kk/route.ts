import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// Kompresi gambar agar tidak terlalu besar untuk API
function compressBase64Image(base64: string): string {
  const matches = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!matches) return base64;
  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length < 2 * 1024 * 1024) return base64;
  return `data:image/jpeg;base64,${matches[2]}`;
}

const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-8b',
];

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

    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBQmcMqOw-g5ZZ1aTamSCdGAJ7uqRqGlRo';
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key belum dikonfigurasi.' }, { status: 500 });
    }

    const processedImage = compressBase64Image(image);
    const mimeMatch = processedImage.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = processedImage.split(',')[1];

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

    const geminiBody = {
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
      },
    };

    // Coba beberapa model secara berurutan
    let lastError = '';
    let result: any = null;

    for (const model of MODELS) {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        console.log(`[Scan KK] Trying model: ${model}...`);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        });

        if (response.ok) {
          result = await response.json();
          console.log(`[Scan KK] Success with model: ${model}`);
          break;
        }

        const errText = await response.text();
        console.error(`[Scan KK] ${model} failed (${response.status}):`, errText.substring(0, 200));
        lastError = errText;

        // Jika 404 (model tidak ada), lanjut ke model berikutnya
        if (response.status === 404) continue;
        // Jika 429 (quota) atau 400 (location), langsung berhenti
        if (response.status === 429 || response.status === 400) {
          let errMsg = 'Quota API habis. ';
          try {
            const errJson = JSON.parse(errText);
            if (errJson.error?.message?.includes('location')) {
              errMsg += 'Lokasi tidak didukung. Pastikan billing sudah diaktifkan di Google AI Studio.';
            } else if (errJson.error?.message?.includes('quota') || errJson.error?.message?.includes('Quota')) {
              errMsg += 'Batas penggunaan gratis tercapai. Aktifkan billing di aistudio.google.com untuk meningkatkan limit.';
            } else {
              errMsg += errJson.error?.message || '';
            }
          } catch { errMsg += errText.substring(0, 200); }
          return NextResponse.json({ error: errMsg }, { status: 500 });
        }
      } catch (e: any) {
        lastError = e.message;
        continue;
      }
    }

    if (!result) {
      return NextResponse.json({ error: 'Semua model AI gagal. Pastikan billing sudah diaktifkan di Google AI Studio (aistudio.google.com).' }, { status: 500 });
    }

    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      const blockReason = result.candidates?.[0]?.finishReason;
      return NextResponse.json(
        { error: `AI tidak dapat membaca gambar. ${blockReason === 'SAFETY' ? 'Gambar diblokir oleh filter keamanan.' : 'Pastikan gambar KK jelas.'}` },
        { status: 500 }
      );
    }

    // Parse JSON
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'Format data tidak dikenali dari gambar KK' }, { status: 422 });
    }

    if (!parsed.noKK || !parsed.anggota || !Array.isArray(parsed.anggota) || parsed.anggota.length === 0) {
      return NextResponse.json({ error: 'Data KK tidak lengkap, pastikan gambar KK jelas' }, { status: 422 });
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[Scan KK] Error:', error);
    return NextResponse.json({ error: 'Gagal memproses gambar KK', detail: error.message }, { status: 500 });
  }
}
