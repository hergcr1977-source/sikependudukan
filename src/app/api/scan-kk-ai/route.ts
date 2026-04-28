import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// ============================================================
// API Route: Scan KK via Puter.js + Google Gemini 2.5 Flash
//
// Puter.js menyediakan akses gratis ke Gemini API
// yang bisa jalan di Vercel (server-side).
//
// Endpoint: POST /api/scan-kk-ai
// Body: { image: string (base64 data URL) }
// Response: { success: true, data: { noKK, alamat, rt, rw, ... } }
// ============================================================

const SYSTEM_PROMPT = `Kamu adalah AI OCR spesialis untuk membaca Kartu Keluarga (KK) Indonesia.

Baca gambar KK Indonesia dan kembalikan data JSON EXACTLY sesuai schema.

LAYOUT KK INDONESIA:
BAGIAN HEADER (atas kartu):
- NO. KK (16 digit)
- NAMA KEPALA KELUARGA
- ALAMAT, RT/RW, KEL/DESA, KECAMATAN, KABUPATEN/KOTA, PROVINSI
- NAMA AYAH, NAMA IBU

BAGIAN TABEL (bawah kartu) — kolom kiri ke kanan:
1. NO (nomor urut)
2. NIK (16 digit)
3. NAMA (huruf kapital)
4. JK (LAKI-LAKI / PEREMPUAN)
5. TEMPAT LAHIR
6. TANGGAL LAHIR (DD-MM-YYYY, convert ke YYYY-MM-DD)
7. AGAMA
8. PENDIDIKAN
9. PEKERJAAN
10. STATUS PERKAWINAN
11. STATUS HUBUNGAN DALAM KELUARGA
12. KEWARGANEGARAAN (WNI/WNA)

NILAI VALID YANG WAJIB DIPAKAI:
- Agama: ISLAM, KRISTEN, BUDHA, HINDU, LAINNYA
- Pendidikan: TIDAK/BELUM SEKOLAH, BELUM TAMAT SD/SEDERAJAT, TIDAK TAMAT SD/SEDERAJAT, SD/SEDERAJAT, SMP/SEDERAJAT, SMA/SEDERAJAT, PAKET A, PAKET B, PAKET C, SLB, D1, D2, D3, S1, S2, S3
- Pekerjaan: PELAJAR/MAHASISWA, PNS, SOPIR, USTADZ/MUBALIGH, PEDAGANG, BELUM/TIDAK BEKERJA, BURUH HARIAN LEPAS, MENGURUS RUMAH TANGGA, WIRASWASTA, PEGAWAI ASN, KARYAWAN SWASTA, TNI, POLRI
- Status Perkawinan: BELUM MENIKAH, KAWIN, CERAI HIDUP, CERAI MATI
- Status Keluarga: KEPALA KELUARGA, ISTRI, ANAK, MERTUA, MENANTU, CUCU, LAINNYA

KEMBALIKAN HANYA JSON, tanpa markdown, tanpa komentar.`;

const USER_PROMPT = 'Baca Kartu Keluarga ini. Baca header (No KK, alamat, RT/RW, desa, kecamatan, kabupaten, provinsi, nama ayah, nama ibu), lalu baca tabel anggota baris per baris. Pastikan semua anggota terbaca. Kembalikan JSON saja.';

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (isAuthError(session)) return session;

  try {
    const { image } = await request.json();
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Gambar diperlukan' }, { status: 400 });
    }

    const puterToken = process.env.PUTER_AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiZ3VpIiwidmVyc2lvbiI6IjAuMC4wIiwidXNpZCI6ImI0ZTJmYTQ5LTE3YTYtNGNmNi1iZmM2LTJlNjI4ZDRhMTIyMiIsInVzZXJfdWlkIjoiZDZkMzUzODMtMDQ5My00OTExLWFlODYtOWJkNDgzMmEyNzEzIiwiaWF0IjoxNzc3NDA2ODAzfQ.upFccwXCqxpJMgs-NyQFUMiK8BI4_3oI8rKlStEdS_U';
    if (!puterToken) {
      console.error('[Scan KK] PUTER_AUTH_TOKEN tidak ada di environment');
      return NextResponse.json(
        { error: 'AI tidak dikonfigurasi di server', fallback: true },
        { status: 503 }
      );
    }

    // Pastikan gambar berupa data URL
    const imageDataUrl = image.startsWith('data:')
      ? image
      : `data:image/jpeg;base64,${image}`;

    console.log('[Scan KK] Mengirim ke Puter.js + Gemini 2.5 Flash');

    const response = await fetch('https://api.puter.com/puterai/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${puterToken}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: USER_PROMPT },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.05,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Scan KK] API error:', response.status, errorBody);
      return NextResponse.json(
        { error: 'AI API error: ' + response.status, fallback: true },
        { status: 500 }
      );
    }

    const result = await response.json();
    const messageContent = result.choices?.[0]?.message?.content;

    if (!messageContent) {
      console.error('[Scan KK] AI tidak mengembalikan respons');
      return NextResponse.json({ error: 'AI tidak mengembalikan respons', fallback: true }, { status: 500 });
    }

    console.log('[Scan KK] Response length:', messageContent.length);

    // Parse JSON dari response
    let parsed: any;
    try {
      let cleaned = messageContent.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
      cleaned = cleaned.trim();

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];

      parsed = JSON.parse(cleaned);
    } catch (parseErr: any) {
      console.error('[Scan KK] Gagal parse JSON:', parseErr.message);
      console.error('[Scan KK] Raw:', messageContent.substring(0, 500));
      return NextResponse.json({ error: 'AI response tidak valid', fallback: true }, { status: 500 });
    }

    if (!parsed.noKK && (!parsed.anggota || parsed.anggota.length === 0)) {
      return NextResponse.json({ error: 'AI tidak berhasil membaca KK', fallback: true }, { status: 422 });
    }

    const normalized = normalizeKKData(parsed);
    console.log('[Scan KK] ✅ noKK:', normalized.noKK, 'anggota:', normalized.anggota.length);

    return NextResponse.json({ success: true, data: normalized });
  } catch (error: any) {
    console.error('[Scan KK] Error:', error);
    return NextResponse.json({ error: error.message, fallback: true }, { status: 500 });
  }
}

// ============================================================
// Normalisasi data KK
// ============================================================
function normalizeKKData(raw: any): any {
  const PEND_MAP: Record<string, string> = {
    'TIDAK/BELUM SEKOLAH': 'TIDAK/BELUM SEKOLAH', 'BELUM TAMAT SD/SEDERAJAT': 'BELUM TAMAT SD/SEDERAJAT',
    'TIDAK TAMAT SD/SEDERAJAT': 'TIDAK TAMAT SD/SEDERAJAT', 'SD/SEDERAJAT': 'SD/SEDERAJAT',
    'SMP/SEDERAJAT': 'SMP/SEDERAJAT', 'SMA/SEDERAJAT': 'SMA/SEDERAJAT',
    'SLTP/SEDERAJAT': 'SMP/SEDERAJAT', 'SLTA/SEDERAJAT': 'SMA/SEDERAJAT',
    'PAKET A': 'PAKET A', 'PAKET B': 'PAKET B', 'PAKET C': 'PAKET C', 'SLB': 'SLB',
    'D1': 'D1', 'D2': 'D2', 'D3': 'D3', 'S1': 'S1', 'S2': 'S2', 'S3': 'S3',
    'TAMAT SD/SEDERAJAT': 'SD/SEDERAJAT', 'TAMAT SMP/SEDERAJAT': 'SMP/SEDERAJAT',
    'TAMAT SMA/SEDERAJAT': 'SMA/SEDERAJAT', 'TAMAT SD': 'SD/SEDERAJAT',
    'TAMAT SMP': 'SMP/SEDERAJAT', 'TAMAT SMA': 'SMA/SEDERAJAT',
    'SD': 'SD/SEDERAJAT', 'SMP': 'SMP/SEDERAJAT', 'SMA': 'SMA/SEDERAJAT',
    'DIPLOMA': 'D3', 'SARJANA': 'S1', 'MAGISTER': 'S2', 'PASCA SARJANA': 'S2', 'DOKTOR': 'S3',
    'TIDAK SEKOLAH': 'TIDAK/BELUM SEKOLAH', 'BELUM SEKOLAH': 'TIDAK/BELUM SEKOLAH',
  };

  const PEK_MAP: Record<string, string> = {
    'PELAJAR/MAHASISWA': 'PELAJAR/MAHASISWA', 'PELAJAR': 'PELAJAR/MAHASISWA',
    'MAHASISWA': 'PELAJAR/MAHASISWA', 'PNS': 'PNS', 'SOPIR': 'SOPIR',
    'USTADZ/MUBALIGH': 'USTADZ/MUBALIGH', 'PEDAGANG': 'PEDAGANG',
    'BELUM/TIDAK BEKERJA': 'BELUM/TIDAK BEKERJA', 'BURUH HARIAN LEPAS': 'BURUH HARIAN LEPAS',
    'MENGURUS RUMAH TANGGA': 'MENGURUS RUMAH TANGGA', 'WIRASWASTA': 'WIRASWASTA',
    'PEGAWAI ASN': 'PEGAWAI ASN', 'KARYAWAN SWASTA': 'KARYAWAN SWASTA',
    'TNI': 'TNI', 'POLRI': 'POLRI', 'KARYAWAN': 'KARYAWAN SWASTA',
    'PEGAWAI': 'PEGAWAI ASN', 'WIRASWASTI': 'WIRASWASTA', 'BURUH': 'BURUH HARIAN LEPAS',
    'IRT': 'MENGURUS RUMAH TANGGA', 'PETANI': 'PEDAGANG',
  };

  const SK_MAP: Record<string, string> = {
    'BELUM MENIKAH': 'BELUM MENIKAH', 'KAWIN': 'KAWIN',
    'CERAI HIDUP': 'CERAI HIDUP', 'CERAI MATI': 'CERAI MATI',
    'BELUM KAWIN': 'BELUM MENIKAH', 'KAWIN TERCATAT': 'KAWIN',
    'KAWIN BELUM TERCATAT': 'KAWIN', 'KAWIN TIDAK TERCATAT': 'KAWIN',
  };

  const AGAMA_MAP: Record<string, string> = {
    'ISLAM': 'ISLAM', 'KRISTEN': 'KRISTEN', 'BUDHA': 'BUDHA',
    'HINDU': 'HINDU', 'LAINNYA': 'LAINNYA',
    'KONGHUCU': 'LAINNYA', 'KATOLIK': 'KRISTEN', 'PROTESTAN': 'KRISTEN', 'BUDDHA': 'BUDHA',
  };

  const SKK_MAP: Record<string, string> = {
    'KEPALA KELUARGA': 'KEPALA KELUARGA', 'ISTRI': 'ISTRI', 'ANAK': 'ANAK',
    'MERTUA': 'MERTUA', 'MENANTU': 'MENANTU', 'CUCU': 'CUCU', 'LAINNYA': 'LAINNYA',
    'ORANG TUA': 'LAINNYA',
  };

  function mapVal(rawVal: any, map: Record<string, string>): string {
    if (!rawVal) return '';
    const u = String(rawVal).toUpperCase().trim();
    if (map[u]) return map[u];
    const n = u.replace(/\s+/g, ' ').trim();
    if (map[n]) return map[n];
    for (const [k, v] of Object.entries(map)) {
      if (n.includes(k) || k.includes(n)) return v;
    }
    return '';
  }

  function normalizeDate(raw: any): string {
    if (!raw) return '';
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dm = s.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
    if (dm) {
      const dd = +dm[1], mm = +dm[2], yy = +dm[3];
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2030)
        return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
    const ym = s.match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/);
    if (ym) {
      const yy = +ym[1], mm = +ym[2], dd = +ym[3];
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2030)
        return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
    return '';
  }

  function cleanNama(nama: string): string {
    if (!nama) return '';
    let c = nama.trim().toUpperCase();
    c = c.replace(/\d{16}/g, '').trim();
    c = c.replace(/\d{2}[-\/.]\d{2}[-\/.]\d{4}/g, '').trim();
    c = c.replace(/\b(LAKI[\s-]*LAKI|PEREMPUAN|ISLAM|KRISTEN|BUDHA|HINDU|KONGHUCU|KATOLIK)\b/g, '').trim();
    c = c.replace(/\b(KAWIN|CERAI|MENIKAH|BELUM|KEPALA KELUARGA|ISTRI|ANAK|MERTUA|MENANTU|CUCU)\b/g, '').trim();
    c = c.replace(/\b(WNI|WNA|SMA|SMP|SD|SEDERAJAT|D[123]|S[123]|PAKET|PNS|POLRI|TNI)\b/g, '').trim();
    c = c.replace(/\b(PEDAGANG|WIRASWASTA|PELAJAR|MAHASISWA|BURUH|SOPIR|PEGAWAI|MENGURUS)\b/gi, '').trim();
    return c.replace(/[\s\-]+/g, ' ').replace(/[.,;:'"]/g, '').trim();
  }

  const result: any = {
    noKK: String(raw.noKK || '').replace(/\D/g, '').substring(0, 16),
    alamat: String(raw.alamat || '').trim(),
    rt: String(raw.rt || '').trim(),
    rw: String(raw.rw || '').trim(),
    desa: String(raw.desa || '').trim(),
    kecamatan: String(raw.kecamatan || '').trim(),
    kabupaten: String(raw.kabupaten || '').trim(),
    provinsi: String(raw.provinsi || '').trim(),
    namaAyah: String(raw.namaAyah || '').trim(),
    namaIbu: String(raw.namaIbu || '').trim(),
    namaKepala: '',
    anggota: [],
  };

  if (Array.isArray(raw.anggota)) {
    for (const a of raw.anggota) {
      if (!a.nik && !a.namaLengkap) continue;

      let jk = '';
      const jkRaw = String(a.jenisKelamin || '').toUpperCase().trim();
      if (jkRaw === 'LAKI-LAKI' || /LAKI/i.test(jkRaw)) jk = 'LAKI-LAKI';
      else if (jkRaw === 'PEREMPUAN' || /PEREMP/i.test(jkRaw)) jk = 'PEREMPUAN';

      const member: any = {
        nik: String(a.nik || '').replace(/\D/g, '').substring(0, 16),
        namaLengkap: cleanNama(a.namaLengkap || ''),
        jenisKelamin: jk,
        tempatLahir: String(a.tempatLahir || '').trim(),
        tanggalLahir: normalizeDate(a.tanggalLahir),
        agama: mapVal(a.agama, AGAMA_MAP),
        pendidikan: mapVal(a.pendidikan, PEND_MAP),
        pekerjaan: mapVal(a.pekerjaan, PEK_MAP),
        statusPerkawinan: mapVal(a.statusPerkawinan, SK_MAP),
        statusKeluarga: mapVal(a.statusKeluarga, SKK_MAP),
        kewarganegaraan: /WNA/i.test(a.kewarganegaraan || '') ? 'WNA' : 'WNI',
        namaAyah: String(a.namaAyah || '').trim() || result.namaAyah,
        namaIbu: String(a.namaIbu || '').trim() || result.namaIbu,
      };

      if (member.namaLengkap) result.anggota.push(member);
      if (member.statusKeluarga === 'KEPALA KELUARGA' && !result.namaKepala)
        result.namaKepala = member.namaLengkap;
    }
  }

  if (!result.namaKepala) {
    result.namaKepala = String(raw.namaKepala || raw.namaKepalaKeluarga || '').trim();
  }
  if (!result.namaKepala && result.anggota.length > 0) {
    result.namaKepala = result.anggota[0].namaLengkap;
  }

  return result;
}
