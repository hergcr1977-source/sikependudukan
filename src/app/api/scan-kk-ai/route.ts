import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// ============================================================
// PROMPT SUPER DETAIL — menjelaskan layout persis KK Indonesia
// ============================================================

const SYSTEM_PROMPT = `KAMU ADALAH MESIN OCR KARTU KELUARGA (KK) INDONESIA. TUGASMU ADALAH MEMBACA SETIAP FIELD DARI GAMBAR KK DAN MENGEMBALIKANNYA SEBAGAI JSON.

== PENJELASAN LAYOUT KARTU KELUARGA INDONESIA ==

KK Indonesia terdiri dari 2 bagian utama:

BAGIAN 1: HEADER (bagian atas kartu)
- "NO. KK": Nomor Kartu Keluarga, 16 digit angka
- "NAMA KEPALA KELUARGA": Nama lengkap kepala keluarga
- "ALAMAT": Alamat tempat tinggal
- "RT/RW": Rukun Tetangga / Rukun Warga (masing2 3 digit)
- "KEL/DESA": Kelurahan atau Desa
- "KECAMATAN": Kecamatan
- "KABUPATEN/KOTA": Kabupaten atau Kota
- "PROVINSI": Provinsi
- "NAMA AYAH": Nama ayah dari kepala keluarga  
- "NAMA IBU": Nama ibu dari kepala keluarga

BAGIAN 2: TABEL ANGGOTA KELUARGA (bagian bawah kartu)
Tabel memiliki kolom-kolom berikut (dari kiri ke kanan):
1. NO — Nomor urut (1, 2, 3, dst)
2. NIK — Nomor Induk Kependudukan, 16 digit angka
3. NAMA — Nama lengkap anggota keluarga (huruf kapital)
4. JK — Jenis Kelamin: LAKI-LAKI atau PEREMPUAN
5. TEMPAT LAHIR — Kota/kabupaten tempat lahir
6. TANGGAL LAHIR — Format di KK: DD-MM-YYYY (contoh: 01-03-1985)
7. AGAMA — Agama yang dianut
8. PENDIDIKAN — Pendidikan terakhir
9. PEKERJAAN — Jenis pekerjaan
10. STATUS PERKAWINAN — Status perkawinan
11. STATUS HUBUNGAN DALAM KELUARGA — Hubungan dengan kepala keluarga
12. KEWARGANEGARAAN — WNI atau WNA

== ATURAN KETAT ==

1. KEMBALIKAN HANYA JSON POLOS, TANPA MARKDOWN, TANPA \`\`\`json, TANPA KOMENTAR
2. BACA SETIAP KOLOM DENGAN TELITI — JANGAN TERBALIK ANTAR KOLOM!
3. NIK harus 16 digit — jika ada spasi dalam NIK, gabungkan
4. NAMA harus HURUF KAPITAL sesuai yang tertulis, termasuk tanda baca (titik, koma, apostrof)
5. TEMPAT LAHIR dan TANGGAL LAHIR terpisah — tempat lahir BUKAN bagian dari nama
6. TANGGAL LAHIR harus dikonversi ke format YYYY-MM-DD (contoh: 01-03-1985 → 1985-03-01)
7. Semua value ENUM harus EXACTLY sesuai daftar yang diberikan

== NILAI YANG VALID (WAJIB GUNAKAN PERSIS INI) ==

AGAMA (pilih salah satu):
- ISLAM, KRISTEN, BUDHA, HINDU, LAINNYA
- Catatan: KONGHUCU dan KATOLIK → map ke LAINNYA atau KRISTEN

PENDIDIKAN (pilih salah satu):
- TIDAK/BELUM SEKOLAH
- BELUM TAMAT SD/SEDERAJAT
- TIDAK TAMAT SD/SEDERAJAT  
- SD/SEDERAJAT
- SMP/SEDERAJAT
- SMA/SEDERAJAT
- PAKET A, PAKET B, PAKET C
- SLB
- D1, D2, D3, S1, S2, S3
- Catatan: SLTP = SMP/SEDERAJAT, SLTA = SMA/SEDERAJAT

PEKERJAAN (pilih salah satu):
- PELAJAR/MAHASISWA
- PNS
- SOPIR
- USTADZ/MUBALIGH
- PEDAGANG
- BELUM/TIDAK BEKERJA
- BURUH HARIAN LEPAS
- MENGURUS RUMAH TANGGA
- WIRASWASTA
- PEGAWAI ASN
- KARYAWAN SWASTA
- TNI
- POLRI

STATUS PERKAWINAN (pilih salah satu):
- BELUM MENIKAH
- KAWIN
- CERAI HIDUP
- CERAI MATI
- Catatan: "KAWIN TERCATAT" atau "BELUM KAWIN" → sesuaikan ke nilai di atas

STATUS HUBUNGAN DALAM KELUARGA (pilih salah satu):
- KEPALA KELUARGA
- ISTRI
- ANAK
- MERTUA
- MENANTU
- CUCU
- LAINNYA

JENIS KELAMIN (pilih salah satu):
- LAKI-LAKI
- PEREMPUAN

KEWARGANEGARAAN (pilih salah satu):
- WNI
- WNA

== FORMAT JSON OUTPUT ==

{
  "noKK": "16 digit no KK",
  "alamat": "alamat lengkap",
  "rt": "3 digit RT",
  "rw": "3 digit RW",  
  "desa": "nama kelurahan/desa",
  "kecamatan": "nama kecamatan",
  "kabupaten": "nama kabupaten/kota",
  "provinsi": "nama provinsi",
  "namaAyah": "nama ayah",
  "namaIbu": "nama ibu",
  "anggota": [
    {
      "nik": "16 digit NIK",
      "namaLengkap": "NAMA LENGKAP HURUF KAPITAL",
      "jenisKelamin": "LAKI-LAKI atau PEREMPUAN",
      "tempatLahir": "KOTA TEMPAT LAHIR",
      "tanggalLahir": "YYYY-MM-DD",
      "agama": "pilih dari daftar agama",
      "pendidikan": "pilih dari daftar pendidikan",
      "pekerjaan": "pilih dari daftar pekerjaan",
      "statusPerkawinan": "pilih dari daftar status perkawinan",
      "statusKeluarga": "pilih dari daftar status keluarga",
      "kewarganegaraan": "WNI atau WNA"
    }
  ]
}

PERINGATAN: Jika ragu membaca suatu field, isi "" (string kosong). JANGAN MENEBAK! Lebih baik kosong daripada salah. Tapi usahakan membaca semua field dengan benar.`;

const USER_PROMPT = `Perhatikan gambar Kartu Keluarga Indonesia ini dengan sangat teliti.

Langkah-langkah:
1. BAGIAN HEADER: Baca No. KK, nama kepala keluarga, alamat, RT/RW, kelurahan/desa, kecamatan, kabupaten, provinsi, nama ayah, nama ibu
2. BAGIAN TABEL: Baca SETIAP BARIS anggota keluarga. Untuk setiap baris, baca kolom-kolomnya: NO, NIK (16 digit), NAMA, JENIS KELAMIN, TEMPAT LAHIR, TANGGAL LAHIR, AGAMA, PENDIDIKAN, PEKERJAAN, STATUS PERKAWINAN, STATUS HUBUNGAN KELUARGA, KEWARGANEGARAAN
3. Pastikan TIDAK ADA anggota yang terlewat
4. Pastikan NIK benar 16 digit dan TIDAK bercampur dengan karakter lain
5. Pastikan NAMA tidak tercampur dengan data kolom lain

Kembalikan JSON sesuai schema. HANYA JSON, tanpa penjelasan.`;

// ============================================================
// Resize gambar di server-side menggunakan Python PIL
// Maks 2000px, quality 90% — untuk efisiensi API call
// ============================================================
async function resizeImageForAI(imageDataUrl: string): Promise<string> {
  // Jika gambar sudah kecil (< 500KB base64 ≈ ~375KB binary), skip resize
  const base64Part = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;
  if (base64Part.length < 700000) {
    return imageDataUrl; // sudah cukup kecil
  }

  const { execFile } = await import('child_process');
  const { writeFile, readFile, unlink } = await import('fs/promises');
  const { randomBytes } = await import('crypto');
  const tmpFile = `/tmp/kk_ai_${randomBytes(8).toString('hex')}.jpg`;
  const tmpResized = `/tmp/kk_ai_${randomBytes(8).toString('hex')}_r.jpg`;

  try {
    // Convert base64 ke file
    const buffer = Buffer.from(base64Part, 'base64');
    await writeFile(tmpFile, buffer);

    // Resize dengan Python PIL
    await new Promise<void>((resolve, reject) => {
      const proc = execFile('python3', ['-c', `
from PIL import Image
import sys
img = Image.open(sys.argv[1])
w, h = img.size
MAX = 2000
if w > MAX or h > MAX:
    if w > h:
        h = int(h * MAX / w)
        w = MAX
    else:
        w = int(w * MAX / h)
        h = MAX
img.thumbnail((MAX, MAX))
img.save(sys.argv[2], 'JPEG', quality=90)
print(f'Resized to {img.size[0]}x{img.size[1]}')
`, tmpFile, tmpResized], (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Baca file hasil resize
    const resizedBuffer = await readFile(tmpResized);
    return `data:image/jpeg;base64,${resizedBuffer.toString('base64')}`;
  } finally {
    // Cleanup temp files
    try { await unlink(tmpFile); } catch {}
    try { await unlink(tmpResized); } catch {}
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (isAuthError(session)) return session;

  try {
    const { image } = await request.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Gambar diperlukan' }, { status: 400 });
    }

    console.log('[Scan KK AI] Memulai AI Vision OCR...');
    console.log('[Scan KK AI] Image data length:', image.length, 'chars');

    // Resize gambar jika terlalu besar (maks 2000px, quality 90) untuk efisiensi API
    let processedImage = image;
    try {
      processedImage = await resizeImageForAI(image);
      console.log('[Scan KK AI] Image processed, length:', processedImage.length);
    } catch (resizeErr: any) {
      console.log('[Scan KK AI] Resize gagal, pakai original:', resizeErr.message);
    }

    // Dynamic import z-ai-web-dev-sdk
    let ZAI: any;
    try {
      ZAI = (await import('z-ai-web-dev-sdk')).default;
      console.log('[Scan KK AI] SDK loaded successfully');
    } catch (err: any) {
      console.error('[Scan KK AI] z-ai-web-dev-sdk tidak tersedia:', err.message);
      return NextResponse.json(
        { error: 'SDK AI tidak tersedia', fallback: true },
        { status: 503 }
      );
    }

    let zai: any;
    try {
      zai = await ZAI.create();
      console.log('[Scan KK AI] SDK initialized successfully');
    } catch (err: any) {
      console.error('[Scan KK AI] Gagal init SDK:', err.message);
      return NextResponse.json(
        { error: 'Gagal menginisialisasi AI', fallback: true },
        { status: 503 }
      );
    }

    // Gunakan createChatCompletionVision (method khusus untuk gambar)
    const imageDataUrl = processedImage.startsWith('data:')
      ? processedImage
      : `data:image/jpeg;base64,${processedImage}`;

    console.log('[Scan KK AI] Mengirim ke AI Vision...');
    const completion = await zai.createChatCompletionVision({
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: USER_PROMPT,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.05, // sangat rendah — konsistensi maksimal
    });

    console.log('[Scan KK AI] Response received from AI');

    const messageContent = completion.choices?.[0]?.message?.content;
    if (!messageContent) {
      console.error('[Scan KK AI] AI tidak mengembalikan konten');
      return NextResponse.json(
        { error: 'AI tidak mengembalikan respons', fallback: true },
        { status: 500 }
      );
    }

    console.log('[Scan KK AI] Raw response length:', messageContent.length);
    console.log('[Scan KK AI] Raw response preview:', messageContent.substring(0, 300));

    // Parse JSON dari response AI
    let parsed: any;
    try {
      // Bersihkan response — hapus markdown wrapper jika ada
      let cleaned = messageContent.trim();
      
      // Hapus markdown code block wrapper
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
      }
      
      // Hapus leading/trailing whitespace
      cleaned = cleaned.trim();

      // Cari JSON object dalam response (jika ada teks sebelum/sesudah)
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      parsed = JSON.parse(cleaned);
    } catch (parseErr: any) {
      console.error('[Scan KK AI] Gagal parse JSON:', parseErr.message);
      console.error('[Scan KK AI] Full raw content:', messageContent);
      return NextResponse.json(
        { error: 'AI mengembalikan format tidak valid', raw: messageContent.substring(0, 500), fallback: true },
        { status: 500 }
      );
    }

    // Log parsed result untuk debugging
    console.log('[Scan KK AI] Parsed JSON keys:', Object.keys(parsed));
    if (parsed.noKK) console.log('[Scan KK AI] noKK:', parsed.noKK);
    if (parsed.anggota) console.log('[Scan KK AI] Jumlah anggota:', parsed.anggota.length);
    if (parsed.anggota?.length > 0) {
      for (let i = 0; i < parsed.anggota.length; i++) {
        const a = parsed.anggota[i];
        console.log(`[Scan KK AI] Anggota ${i + 1}: NIK=${a.nik}, NAMA=${a.namaLengkap}, JK=${a.jenisKelamin}, TTL=${a.tempatLahir} ${a.tanggalLahir}, AGAMA=${a.agama}, PEND=${a.pendidikan}, PEKERJAAN=${a.pekerjaan}, KAWIN=${a.statusPerkawinan}, STATUS=${a.statusKeluarga}`);
      }
    }

    // Validasi minimal — harus punya noKK atau anggota
    if (!parsed.noKK && (!parsed.anggota || parsed.anggota.length === 0)) {
      console.error('[Scan KK AI] Tidak ada noKK dan tidak ada anggota');
      return NextResponse.json(
        { error: 'AI tidak berhasil membaca data KK', parsed },
        { status: 422 }
      );
    }

    // Normalisasi data — pastikan value sesuai constants.ts
    const result = normalizeKKData(parsed);

    console.log('[Scan KK AI] ✅ Success! noKK:', result.noKK, 'anggota:', result.anggota.length);
    if (result.anggota.length > 0) {
      for (let i = 0; i < result.anggota.length; i++) {
        const a = result.anggota[i];
        console.log(`[Scan KK AI] ✅ Anggota ${i + 1}: NIK=${a.nik}, NAMA=${a.namaLengkap}, JK=${a.jenisKelamin}, AGAMA=${a.agama}, PEND=${a.pendidikan}, PEKERJAAN=${a.pekerjaan}, KAWIN=${a.statusPerkawinan}, STATUS=${a.statusKeluarga}`);
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Scan KK AI] ❌ Error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses gambar KK dengan AI', detail: error.message, fallback: true },
      { status: 500 }
    );
  }
}

// ============================================================
// Normalisasi data KK dari AI agar sesuai constants.ts
// ============================================================
function normalizeKKData(raw: any): any {
  const AGAMA_VALID = new Set(['ISLAM', 'KRISTEN', 'BUDHA', 'HINDU', 'LAINNYA']);
  const PENDIDIKAN_VALID = new Set([
    'TIDAK/BELUM SEKOLAH', 'BELUM TAMAT SD/SEDERAJAT', 'TIDAK TAMAT SD/SEDERAJAT',
    'SD/SEDERAJAT', 'SMP/SEDERAJAT', 'SMA/SEDERAJAT',
    'PAKET A', 'PAKET B', 'PAKET C', 'SLB',
    'D1', 'D2', 'D3', 'S1', 'S2', 'S3',
  ]);
  const PEKERJAAN_VALID = new Set([
    'PELAJAR/MAHASISWA', 'PNS', 'SOPIR', 'USTADZ/MUBALIGH', 'PEDAGANG',
    'BELUM/TIDAK BEKERJA', 'BURUH HARIAN LEPAS', 'MENGURUS RUMAH TANGGA',
    'WIRASWASTA', 'PEGAWAI ASN', 'KARYAWAN SWASTA', 'TNI', 'POLRI',
  ]);
  const STATUS_KAWIN_VALID = new Set(['BELUM MENIKAH', 'KAWIN', 'CERAI HIDUP', 'CERAI MATI']);
  const STATUS_KELUARGA_VALID = new Set(['KEPALA KELUARGA', 'ISTRI', 'ANAK', 'MERTUA', 'MENANTU', 'CUCU', 'LAINNYA']);
  const JK_VALID = new Set(['LAKI-LAKI', 'PEREMPUAN']);

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

  // Normalisasi anggota
  if (Array.isArray(raw.anggota)) {
    for (const a of raw.anggota) {
      if (!a.nik && !a.namaLengkap) continue;

      const agama = normalizeValue(a.agama, AGAMA_VALID, {
        'KONGHUCU': 'LAINNYA',
        'KATOLIK': 'KRISTEN',
        'PROTESTAN': 'KRISTEN',
        'BUDDHA': 'BUDHA',
      });

      const pendidikan = normalizePendidikan(a.pendidikan, PENDIDIKAN_VALID);

      const pekerjaan = normalizePekerjaan(a.pekerjaan, PEKERJAAN_VALID);

      const statusKawin = normalizeValue(a.statusPerkawinan, STATUS_KAWIN_VALID, {
        'BELUM KAWIN': 'BELUM MENIKAH',
        'KAWIN TERCATAT': 'KAWIN',
        'KAWIN BELUM TERCATAT': 'KAWIN',
        'KAWIN TIDAK TERCATAT': 'KAWIN',
      });

      const statusKeluarga = normalizeValue(a.statusKeluarga, STATUS_KELUARGA_VALID, {
        'ORANG TUA': 'LAINNYA',
      });

      let jk = normalizeValue(a.jenisKelamin, JK_VALID, {
        'LAKI LAKI': 'LAKI-LAKI',
        'LAKILAKI': 'LAKI-LAKI',
        'L': 'LAKI-LAKI',
        'P': 'PEREMPUAN',
      });
      if (!jk) {
        if (/LAKI/i.test(a.jenisKelamin || '')) jk = 'LAKI-LAKI';
        else if (/PEREMP/i.test(a.jenisKelamin || '')) jk = 'PEREMPUAN';
      }

      // Normalisasi tanggal lahir
      let tgl = '';
      if (a.tanggalLahir) {
        tgl = normalizeDate(a.tanggalLahir);
      }

      const member: any = {
        nik: String(a.nik || '').replace(/\D/g, '').substring(0, 16),
        namaLengkap: cleanNama(a.namaLengkap || ''),
        jenisKelamin: jk || '',
        tempatLahir: String(a.tempatLahir || '').trim(),
        tanggalLahir: tgl,
        agama,
        pendidikan,
        pekerjaan,
        statusPerkawinan: statusKawin,
        statusKeluarga,
        kewarganegaraan: /WNA/i.test(a.kewarganegaraan || '') ? 'WNA' : 'WNI',
        namaAyah: String(a.namaAyah || '').trim() || result.namaAyah,
        namaIbu: String(a.namaIbu || '').trim() || result.namaIbu,
      };

      if (member.namaLengkap) {
        result.anggota.push(member);
      }

      // Set namaKepala dari anggota pertama yang KEPALA KELUARGA
      if (member.statusKeluarga === 'KEPALA KELUARGA' && !result.namaKepala) {
        result.namaKepala = member.namaLengkap;
      }
    }
  }

  // Jika tidak ada nama kepala, ambil dari header atau anggota pertama
  if (!result.namaKepala) {
    result.namaKepala = String(raw.namaKepala || raw.namaKepalaKeluarga || '').trim();
  }
  if (!result.namaKepala && result.anggota.length > 0) {
    result.namaKepala = result.anggota[0].namaLengkap;
  }

  return result;
}

// ============================================================
// Bersihkan nama — hapus kontaminasi dari kolom lain
// ============================================================
function cleanNama(nama: string): string {
  if (!nama) return '';
  let cleaned = nama.trim().toUpperCase();
  
  // Hapus angka 16 digit (bukan bagian dari nama)
  cleaned = cleaned.replace(/\d{16}/g, '').trim();
  
  // Hapus tanggal lahir yang mungkin terbawa
  cleaned = cleaned.replace(/\d{2}[-\/.]\d{2}[-\/.]\d{4}/g, '').trim();
  
  // Hapus label field yang mungkin terbawa
  cleaned = cleaned.replace(/\b(NIK|NAMA|JK|JENIS KELAMIN|TEMPAT LAHIR|TANGGAL LAHIR|AGAMA|PENDIDIKAN|PEKERJAAN|STATUS|HUBUNGAN|KEWARGANEGARAAN)\b/gi, '').trim();
  
  // Hapus value yang sering terbawa ke nama
  cleaned = cleaned.replace(/\b(LAKI[\s-]*LAKI|PEREMPUAN|ISLAM|KRISTEN|BUDHA|HINDU|KONGHUCU|KATOLIK)\b/gi, '').trim();
  cleaned = cleaned.replace(/\b(KAWIN|CERAI|MENIKAH|BELUM)\b/gi, '').trim();
  cleaned = cleaned.replace(/\b(KEPALA KELUARGA|ISTRI|ANAK|MERTUA|MENANTU|CUCU)\b/gi, '').trim();
  cleaned = cleaned.replace(/\b(WNI|WNA)\b/g, '').trim();
  cleaned = cleaned.replace(/\b(SMA|SMP|SD|SEDERAJAT|D[123]|S[123]|PAKET|DIPLOMA|SARJANA)\b/g, '').trim();
  cleaned = cleaned.replace(/\b(PNS|POLRI|TNI|PEDAGANG|WIRASWASTA|PELAJAR|MAHASISWA|BURUH|SOPIR|PEGAWAI|MENGURUS)\b/gi, '').trim();

  // Bersihkan sisa tanda dan whitespace berlebih
  cleaned = cleaned.replace(/[\s\-]+/g, ' ').replace(/[.,;:'"]/g, '').trim();
  
  return cleaned;
}

// ============================================================
// Helper functions
// ============================================================
function normalizeValue(
  raw: any,
  validSet: Set<string>,
  aliasMap: Record<string, string> = {}
): string {
  if (!raw) return '';
  const upper = String(raw).toUpperCase().trim();

  // Exact match
  if (validSet.has(upper)) return upper;

  // Alias mapping
  if (aliasMap[upper]) return aliasMap[upper];

  // Try without extra spaces
  const normalized = upper.replace(/\s+/g, ' ').trim();
  if (validSet.has(normalized)) return normalized;

  // Try strip slashes
  const stripped = normalized.replace(/[/\\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (validSet.has(stripped)) return stripped;

  return '';
}

function normalizePendidikan(raw: any, validSet: Set<string>): string {
  if (!raw) return '';
  const upper = String(raw).toUpperCase().trim();

  if (validSet.has(upper)) return upper;

  const PEND_MAP: Record<string, string> = {
    'TIDAK/BELUM SEKOLAH': 'TIDAK/BELUM SEKOLAH',
    'BELUM TAMAT SD/SEDERAJAT': 'BELUM TAMAT SD/SEDERAJAT',
    'TIDAK TAMAT SD/SEDERAJAT': 'TIDAK TAMAT SD/SEDERAJAT',
    'SD/SEDERAJAT': 'SD/SEDERAJAT',
    'SMP/SEDERAJAT': 'SMP/SEDERAJAT',
    'SMA/SEDERAJAT': 'SMA/SEDERAJAT',
    'SLTP/SEDERAJAT': 'SMP/SEDERAJAT',
    'SLTA/SEDERAJAT': 'SMA/SEDERAJAT',
    'PAKET A': 'PAKET A',
    'PAKET B': 'PAKET B',
    'PAKET C': 'PAKET C',
    'SLB': 'SLB',
    'D1': 'D1', 'D2': 'D2', 'D3': 'D3',
    'S1': 'S1', 'S2': 'S2', 'S3': 'S3',
    'DIPLOMA I': 'D1', 'DIPLOMA II': 'D2', 'DIPLOMA III': 'D3',
    'DIPLOMA': 'D3',
    'SARJANA': 'S1',
    'MAGISTER': 'S2',
    'PASCA SARJANA': 'S2',
    'DOKTOR': 'S3',
    'SD': 'SD/SEDERAJAT',
    'SMP': 'SMP/SEDERAJAT',
    'SMA': 'SMA/SEDERAJAT',
    'TAMAT SD': 'SD/SEDERAJAT',
    'TAMAT SMP': 'SMP/SEDERAJAT',
    'TAMAT SMA': 'SMA/SEDERAJAT',
    'TAMAT SD/SEDERAJAT': 'SD/SEDERAJAT',
    'TAMAT SMP/SEDERAJAT': 'SMP/SEDERAJAT',
    'TAMAT SMA/SEDERAJAT': 'SMA/SEDERAJAT',
    'TIDAK SEKOLAH': 'TIDAK/BELUM SEKOLAH',
    'BELUM SEKOLAH': 'TIDAK/BELUM SEKOLAH',
    'STRATA 1': 'S1', 'STRATA 2': 'S2', 'STRATA 3': 'S3',
    'SARJANA MUDA': 'D3',
    'AKADEMI': 'D3',
  };

  if (PEND_MAP[upper]) return PEND_MAP[upper];

  // Try normalized
  const norm = upper.replace(/\s+/g, ' ').trim();
  if (PEND_MAP[norm]) return PEND_MAP[norm];

  // Cek mengandung keyword
  if (/DOKTOR/i.test(upper) || /S3/i.test(upper)) return 'S3';
  if (/MAGISTER/i.test(upper) || /S2/i.test(upper)) return 'S2';
  if (/SARJANA/i.test(upper) || /S1/i.test(upper)) return 'S1';
  if (/DIPLOMA\s*III/i.test(upper) || /D3/i.test(upper)) return 'D3';
  if (/DIPLOMA\s*II/i.test(upper) || /D2/i.test(upper)) return 'D2';
  if (/DIPLOMA\s*I/i.test(upper) || /D1/i.test(upper)) return 'D1';
  if (/SMA|SLTA|SEKOLAH\s*MENENGAH/i.test(upper)) return 'SMA/SEDERAJAT';
  if (/SMP|SLTP|SEKOLAH\s*PERTAMA/i.test(upper)) return 'SMP/SEDERAJAT';
  if (/SD|SEKOLAH\s*DASAR/i.test(upper)) return 'SD/SEDERAJAT';

  return '';
}

function normalizePekerjaan(raw: any, validSet: Set<string>): string {
  if (!raw) return '';
  const upper = String(raw).toUpperCase().trim();

  if (validSet.has(upper)) return upper;

  const PEK_MAP: Record<string, string> = {
    'PELAJAR/MAHASISWA': 'PELAJAR/MAHASISWA',
    'PELAJAR': 'PELAJAR/MAHASISWA',
    'MAHASISWA': 'PELAJAR/MAHASISWA',
    'PNS': 'PNS',
    'SOPIR': 'SOPIR',
    'USTADZ/MUBALIGH': 'USTADZ/MUBALIGH',
    'PEDAGANG': 'PEDAGANG',
    'BELUM/TIDAK BEKERJA': 'BELUM/TIDAK BEKERJA',
    'BURUH HARIAN LEPAS': 'BURUH HARIAN LEPAS',
    'MENGURUS RUMAH TANGGA': 'MENGURUS RUMAH TANGGA',
    'WIRASWASTA': 'WIRASWASTA',
    'PEGAWAI ASN': 'PEGAWAI ASN',
    'KARYAWAN SWASTA': 'KARYAWAN SWASTA',
    'TNI': 'TNI',
    'POLRI': 'POLRI',
    'KARYAWAN': 'KARYAWAN SWASTA',
    'PEGAWAI': 'PEGAWAI ASN',
    'PEGAWAI SWASTA': 'KARYAWAN SWASTA',
    'PEGAWAI NEGERI SIPIL': 'PNS',
    'WIRASWASTI': 'WIRASWASTA',
    'IRT': 'MENGURUS RUMAH TANGGA',
    'RUMAH TANGGA': 'MENGURUS RUMAH TANGGA',
    'PETANI': 'PEDAGANG',
    'PETANI/PEKEBUN': 'PEDAGANG',
    'BURUH': 'BURUH HARIAN LEPAS',
    'GURU': 'PEGAWAI ASN',
    'DOKTER': 'PEGAWAI ASN',
    'BIDAN': 'PEGAWAI ASN',
    'PERAWAT': 'PEGAWAI ASN',
    'WIRASWASTA': 'WIRASWASTA',
    'NELAYAN': 'PEDAGANG',
    'TUKANG': 'PEDAGANG',
    'PEMBANTU': 'KARYAWAN SWASTA',
    'SECURITY': 'KARYAWAN SWASTA',
    'SATPAM': 'KARYAWAN SWASTA',
    'SUPIR': 'SOPIR',
    'PENGEMUDI': 'SOPIR',
    'PEDAGANG/KARYAWAN': 'PEDAGANG',
    'KARYAWAN HARIAN LEPAS': 'KARYAWAN SWASTA',
  };

  if (PEK_MAP[upper]) return PEK_MAP[upper];

  const norm = upper.replace(/\s+/g, ' ').trim();
  if (PEK_MAP[norm]) return PEK_MAP[norm];

  return '';
}

function normalizeDate(raw: any): string {
  if (!raw) return '';
  let s = String(raw).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dm = s.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
  if (dm) {
    const dd = parseInt(dm[1], 10);
    const mm = parseInt(dm[2], 10);
    const yy = parseInt(dm[3], 10);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2030) {
      return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }

  // YYYY/MM/DD or YYYY.MM.DD
  const ym = s.match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/);
  if (ym) {
    const yy = parseInt(ym[1], 10);
    const mm = parseInt(ym[2], 10);
    const dd = parseInt(ym[3], 10);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2030) {
      return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }

  // DD Month YYYY format (e.g., "01 Maret 1985")
  const bulanMap: Record<string, number> = {
    'JANUARI': 1, 'FEBRUARI': 2, 'MARET': 3, 'APRIL': 4, 'MEI': 5, 'JUNI': 6,
    'JULI': 7, 'AGUSTUS': 8, 'SEPTEMBER': 9, 'OKTOBER': 10, 'NOVEMBER': 11, 'DESEMBER': 12,
    'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
    'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12,
  };
  const dmMatch = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (dmMatch) {
    const dd = parseInt(dmMatch[1], 10);
    const bl = bulanMap[dmMatch[2].toUpperCase()];
    const yy = parseInt(dmMatch[3], 10);
    if (dd >= 1 && dd <= 31 && bl && yy >= 1900 && yy <= 2030) {
      return `${yy}-${String(bl).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }

  return '';
}
