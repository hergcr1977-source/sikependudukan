// ============================================================
// parse-kk.ts — Parser OCR Kartu Keluarga (client-side)
// Mendukung Tesseract.js output yang berantakan/bercampur kolom
// ============================================================

interface KKMember {
  nik: string;
  namaLengkap: string;
  jenisKelamin: string;
  tempatLahir: string;
  tanggalLahir: string;
  agama: string;
  pendidikan: string;
  pekerjaan: string;
  statusPerkawinan: string;
  statusKeluarga: string;
  kewarganegaraan: string;
}

interface KKParseResult {
  noKK: string;
  alamat: string;
  rt: string;
  rw: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  namaKepala: string;
  anggota: KKMember[];
  rawText: string; // untuk debug/review
}

// ============================================================
// Pilihan nilai yang valid (dari constants.ts)
// ============================================================
const AGAMA_VALUES = ['ISLAM', 'KRISTEN', 'BUDHA', 'HINDU', 'KONGHUCU', 'KATOLIK', 'LAINNYA'];
const PENDIDIKAN_VALUES = [
  'TIDAK/BELUM SEKOLAH', 'BELUM TAMAT SD/SEDERAJAT', 'TIDAK TAMAT SD/SEDERAJAT',
  'SD/SEDERAJAT', 'SMP/SEDERAJAT', 'SMA/SEDERAJAT',
  'PAKET A', 'PAKET B', 'PAKET C', 'SLB',
  'D1', 'D2', 'D3', 'S1', 'S2', 'S3',
  'DIPLOMA I/II/III', 'SARJANA', 'PASCA SARJANA',
];
const PEKERJAAN_VALUES = [
  'PELAJAR/MAHASISWA', 'PNS', 'SOPIR', 'USTADZ/MUBALIGH', 'PEDAGANG',
  'BELUM/TIDAK BEKERJA', 'BURUH HARIAN LEPAS', 'MENGURUS RUMAH TANGGA',
  'WIRASWASTA', 'PEGAWAI ASN', 'KARYAWAN SWASTA', 'TNI', 'POLRI',
  'BURUH', 'PETANI/PEKEBUN', 'PEGAWAI NEGERI',
];
const STATUS_KAWIN_VALUES = ['BELUM MENIKAH', 'KAWIN', 'CERAI HIDUP', 'CERAI MATI', 'BELUM KAWIN'];
const STATUS_KELUARGA_VALUES = ['KEPALA KELUARGA', 'ISTRI', 'ANAK', 'MERTUA', 'MENANTU', 'CUCU', 'LAINNYA'];

// ============================================================
// Preprocessing gambar untuk OCR yang lebih akurat
// ============================================================
export function preprocessImageForOCR(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.max(1, 2000 / Math.max(img.width, img.height)); // upscale jika kurang dari 2000px
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Step 1: Grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      // Step 2: Contrast enhancement
      const contrast = 1.8;
      const brightness = -10;
      for (let i = 0; i < data.length; i += 4) {
        let val = data[i];
        val = ((val - 128) * contrast) + 128 + brightness;
        data[i] = Math.max(0, Math.min(255, val));
        data[i + 1] = data[i];
        data[i + 2] = data[i];
      }

      // Step 3: Binary threshold (Otsu-like, di tengah)
      const threshold = 130;
      for (let i = 0; i < data.length; i += 4) {
        const bw = data[i] > threshold ? 255 : 0;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Gagal memuat gambar'));
    img.src = dataUrl;
  });
}

// ============================================================
// Parser utama
// ============================================================
export function parseKKFromOCR(rawText: string): KKParseResult | null {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const result: KKParseResult = {
    noKK: '',
    alamat: '',
    rt: '',
    rw: '',
    desa: '',
    kecamatan: '',
    kabupaten: '',
    provinsi: '',
    namaKepala: '',
    anggota: [],
    rawText: text.substring(0, 2000),
  };

  // ============================================================
  // 1. Cari No. KK
  // ============================================================
  result.noKK = extractNoKK(text);
  if (!result.noKK) return null;

  // ============================================================
  // 2. Cari Nama Kepala Keluarga
  // ============================================================
  result.namaKepala = extractNamaKepala(text, lines);

  // ============================================================
  // 3. Cari Alamat
  // ============================================================
  const alamatInfo = extractAlamat(lines);
  result.alamat = alamatInfo.alamat;
  result.rt = alamatInfo.rt;
  result.rw = alamatInfo.rw;

  // ============================================================
  // 4. Cari Desa, Kecamatan, Kabupaten, Provinsi
  // ============================================================
  result.desa = extractFieldValue(lines, ['KELURAHAN', 'KEL/DESA', 'KEL\\/DESA', 'DESA/KELURAHAN', 'DESA', 'KEL DESA', 'KEL/ DESA', 'KEL./ DESA', 'KEL./DESA', 'KEL/DESA', 'KEL. DESA', 'KEL.DESA']);
  result.kecamatan = extractFieldValue(lines, ['KECAMATAN', 'KEC.', 'KEC']);
  result.kabupaten = extractFieldValue(lines, ['KABUPATEN/KOTA', 'KABUPATEN', 'KABUPATEN/ KOTA', 'KAB.', 'KABUPATEN / KOTA', 'KAB / KOTA']);
  result.provinsi = extractFieldValue(lines, ['PROVINSI', 'PROV.', 'PROV']);

  // ============================================================
  // 5. Cari dan parse anggota keluarga
  // ============================================================
  result.anggota = extractAllMembers(text, lines);

  return result;
}

// ============================================================
// Helper: Extract No. KK (16 digit pertama setelah label "KK")
// ============================================================
function extractNoKK(text: string): string {
  // Normalisasi: hapus spasi dalam angka berurutan
  const normalized = text.replace(/(\d)\s+(\d)/g, '$1$2');

  // Cari setelah "NO KK", "NO. KK", "NOMOR KK"
  const kkPatterns = [
    /NO\s*[.\s]*KK\s*[:\s\-]*\[?\s*(\d{16})\s*\]?/i,
    /N0\s*[.\s]*KK\s*[:\s\-]*\[?\s*(\d{16})\s*\]?/i,
    /NOMOR\s*KK\s*[:\s\-]*\[?\s*(\d{16})\s*\]?/i,
  ];
  for (const pat of kkPatterns) {
    const m = normalized.match(pat);
    if (m) return m[1];
  }

  // Fallback: cari 16 digit pertama yang bukan tanggal
  const all16 = normalized.match(/\d{16}/g);
  if (all16 && all16.length > 0) {
    return all16[0];
  }

  return '';
}

// ============================================================
// Helper: Extract Nama Kepala Keluarga
// ============================================================
function extractNamaKepala(text: string, lines: string[]): string {
  const patterns = [
    /NAMA\s*(KEPALA)?\s*KELUARGA\s*[:\s\-]*\[?\s*([A-Z][A-Z\s.'\-]{2,40})\s*\]?/i,
    /KELUARGA\s*[:\s\-]*\[?\s*([A-Z][A-Z\s.'\-]{2,40})\s*\]?/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m && m[1] && m[1].length > 3) return m[1].trim();
  }
  return '';
}

// ============================================================
// Helper: Extract Alamat + RT/RW
// ============================================================
function extractAlamat(lines: string[]): { alamat: string; rt: string; rw: string } {
  let alamat = '';
  let rt = '';
  let rw = '';

  for (let i = 0; i < lines.length; i++) {
    // Cari baris "ALAMAT"
    if (/^ALAMAT/i.test(lines[i])) {
      alamat = lines[i].replace(/^ALAMAT\s*[:\s\-]*/i, '').trim();

      // Jika alamat kosong, ambil baris berikutnya
      if (!alamat && i + 1 < lines.length) {
        alamat = lines[i + 1].trim();
      }

      // Cari RT/RW di baris alamat atau baris berikutnya
      for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
        const rtRwMatch = lines[j].match(/(\d{3})\s*[\/\\]\s*(\d{3})/);
        if (rtRwMatch) {
          rt = rtRwMatch[1];
          rw = rtRwMatch[2];
          break;
        }
      }
      break;
    }
  }

  return { alamat, rt, rw };
}

// ============================================================
// Helper: Extract field value dari label
// ============================================================
function extractFieldValue(lines: string[], keywords: string[]): string {
  for (const keyword of keywords) {
    const regex = new RegExp(`^${escapeRegex(keyword)}\\s*[:\\s\\/\\-]*\\s*(.+)$`, 'i');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(regex);
      if (m) {
        let val = m[1].trim();
        // Bersihkan dari suffix seperti ", KODE POS 16630"
        val = val.replace(/,\s*KODE\s*POS\s*\d{5}.*/i, '').trim();
        return val;
      }
    }
  }
  return '';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// Helper: Cari semua anggota keluarga
// ============================================================
function extractAllMembers(fullText: string, lines: string[]): KKMember[] {
  // Normalisasi teks: hapus spasi di dalam angka berurutan (bukan tanggal)
  const normalized = fullText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const members: KKMember[] = [];
  const usedNiks = new Set<string>();

  // Cari semua NIK (16 digit) — normalisasi dulu
  const normalizedNoSpaces = normalized.replace(/(\d)\s+(\d)/g, '$1$2');

  // Cari pattern NIK: 16 digit yang bukan bagian dari tanggal
  // Tanggal biasanya format DD-MM-YYYY, NIK format 16 digit tanpa pemisah
  const nikMatches: { nik: string; startIdx: number }[] = [];
  const nikRegex = /\b(\d{16})\b/g;
  let match;
  while ((match = nikRegex.exec(normalizedNoSpaces)) !== null) {
    const nik = match[1];
    // Skip jika ini adalah No. KK (sudah dipakai sebagai header)
    // Kita biarkan semua NIK terdeteksi, nanti difilter
    nikMatches.push({ nik, startIdx: match.index });
  }

  if (nikMatches.length === 0) return members;

  // Ambil teks di sekitar setiap NIK (±200 karakter) untuk parsing per-anggota
  for (const nikInfo of nikMatches) {
    if (usedNiks.has(nikInfo.nik)) continue;

    const start = Math.max(0, nikInfo.startIdx - 50);
    const end = Math.min(normalizedNoSpaces.length, nikInfo.startIdx + 250);
    const context = normalizedNoSpaces.substring(start, end);

    const member = parseMemberFromContext(context, nikInfo.nik);
    if (member && member.namaLengkap) {
      members.push(member);
      usedNiks.add(nikInfo.nik);
    }
  }

  return members;
}

// ============================================================
// Parser per-anggota dari konteks teks
// ============================================================
function parseMemberFromContext(context: string, nik: string): KKMember | null {
  // Bersihkan: normalisasi whitespace
  const text = context.replace(/\s+/g, ' ').trim();

  const member: KKMember = {
    nik,
    namaLengkap: '',
    jenisKelamin: '',
    tempatLahir: '',
    tanggalLahir: '',
    agama: '',
    pendidikan: '',
    pekerjaan: '',
    statusPerkawinan: '',
    statusKeluarga: '',
    kewarganegaraan: '',
  };

  // ============================================================
  // 1. Extract nama — teks kapital setelah NIK, sebelum keyword field
  // ============================================================
  // Cari NIK di dalam konteks
  const nikIdx = text.indexOf(nik);
  if (nikIdx < 0) return null;

  // Ambil teks setelah NIK
  const afterNik = text.substring(nikIdx + nik.length).trim();

  // Nama biasanya berada di awal setelah NIK, sebelum keyword jenis kelamin/agama dll
  // Nama: huruf kapital, bisa mengandung spasi, titik, tanda hubung
  const nameMatch = afterNik.match(/^[\s]*([A-Z][A-Z\s.'\-]{1,40})/);
  if (nameMatch) {
    let nama = nameMatch[1].trim();
    // Bersihkan: jika nama berakhir dengan angka atau keyword, potong
    nama = nama.replace(/\s+(LAKI[- ]?LAKI|PEREMPUAN|LAKI|PEREMP).*/i, '').trim();
    nama = nama.replace(/\s+(ISLAM|KRISTEN|BUDHA|HINDU|KONGHUCU|KATOLIK).*/i, '').trim();
    nama = nama.replace(/\s+\d{2}[\-\/]\d{2}[\-\/]\d{4}.*$/,'').trim();
    if (nama.length >= 2) {
      member.namaLengkap = nama;
    }
  }

  // Jika nama belum ketemu, coba cari di teks sebelum NIK
  if (!member.namaLengkap) {
    const beforeNik = text.substring(0, nikIdx).trim();
    const words = beforeNik.split(/\s+/);
    // Cari kata terakhir yang huruf kapital panjang (mungkin nama)
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      if (w.length >= 3 && /^[A-Z][A-Z.'\-]*$/.test(w) && !/^\d+$/.test(w)) {
        // Cek apakah ini angka baris (1, 2, 3...)
        if (/^\d+$/.test(w)) continue;
        member.namaLengkap = w;
        break;
      }
    }
  }

  // ============================================================
  // 2. Jenis Kelamin
  // ============================================================
  if (/LAKI[\s\-]*LAKI|LAKILAKI/i.test(text)) member.jenisKelamin = 'LAKI-LAKI';
  else if (/PEREMPUAN/i.test(text)) member.jenisKelamin = 'PEREMPUAN';
  else if (/\bL\b/.test(text) && /LAKI/i.test(text)) member.jenisKelamin = 'LAKI-LAKI';
  else if (/\bP\b/.test(text) && /PEREMPUAN/i.test(text)) member.jenisKelamin = 'PEREMPUAN';

  // ============================================================
  // 3. Tanggal Lahir — DD-MM-YYYY atau DD/MM/YYYY
  // ============================================================
  const datePatterns = [
    /(\d{2})\s*[\-\/\.]\s*(\d{2})\s*[\-\/\.]\s*(\d{4})/, // DD-MM-YYYY
  ];
  for (const pat of datePatterns) {
    const dm = text.match(pat);
    if (dm) {
      const d = dm[1], m = dm[2], y = dm[3];
      // Validasi: tanggal 01-31, bulan 01-12, tahun 1900-2025
      const dd = parseInt(d), mm = parseInt(m), yy = parseInt(y);
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2025) {
        member.tanggalLahir = `${y}-${m}-${d}`;
        break;
      }
    }
  }

  // ============================================================
  // 4. Tempat Lahir — kota di sebelah tanggal lahir
  // ============================================================
  if (member.tanggalLahir) {
    const dateStr = member.tanggalLahir.replace(/-/g, '[-/]'); // original format
    const dateIdx = text.search(new RegExp(`\\d{2}\\s*[\\-\\/]\\s*\\d{2}\\s*[\\-\\/]\\s*${member.tanggalLahir.substring(0, 4)}`));
    if (dateIdx > 0) {
      // Ambil 1-2 kata sebelum tanggal
      const beforeDate = text.substring(Math.max(0, dateIdx - 30), dateIdx).trim();
      const words = beforeDate.split(/\s+/);
      // Cari kata terakhir yang mirip nama kota (kapital, bukan keyword)
      for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i];
        if (w.length >= 2 && w.length <= 20 && /^[A-Z]+$/.test(w)) {
          if (!/^LAKI|PEREMP|KEPALA|ISTRI|ANAK|KAWIN|ISLAM|KRISTEN|BUDHA|HINDU|SMA|SD|SMP|SLTA|SLTP|SEDERAJAT|PELAJAR|BURUH|PEDAGANG|WIRASWASTA|PNS|PEGAWAI|BELUM|SUDAH|CERAI|MENIKAH|WNI|WNA|KETENAGAKERJAAN|MENGURUS|RUMAH|TANGGA$/i.test(w)) {
            member.tempatLahir = w;
            break;
          }
        }
      }
    }
  }

  // ============================================================
  // 5. Agama — fuzzy match terhadap daftar agama
  // ============================================================
  for (const agama of AGAMA_VALUES) {
    // Bersihkan agama dari tanda baca untuk regex
    const agamaClean = agama.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(agamaClean, 'i').test(text)) {
      member.agama = agama;
      break;
    }
  }

  // ============================================================
  // 6. Pendidikan — fuzzy match terhadap daftar pendidikan
  // ============================================================
  member.pendidikan = fuzzyMatchList(text, PENDIDIKAN_VALUES);

  // ============================================================
  // 7. Pekerjaan — fuzzy match terhadap daftar pekerjaan
  // ============================================================
  member.pekerjaan = fuzzyMatchList(text, PEKERJAAN_VALUES);

  // ============================================================
  // 8. Status Perkawinan — fuzzy match
  // ============================================================
  // Khusus untuk status kawin, cek beberapa variant
  if (/KAWIN\s*(BELUM|TIDAK)\s*(TERCATAT)?/i.test(text)) {
    member.statusPerkawinan = 'KAWIN';
  } else if (/KAWIN\s*TERCATAT/i.test(text)) {
    member.statusPerkawinan = 'KAWIN';
  } else {
    member.statusPerkawinan = fuzzyMatchList(text, STATUS_KAWIN_VALUES);
  }

  // ============================================================
  // 9. Status dalam Keluarga
  // ============================================================
  if (/KEPALA\s*KELUARGA/i.test(text)) member.statusKeluarga = 'KEPALA KELUARGA';
  else if (/MENANTU/i.test(text)) member.statusKeluarga = 'MENANTU';
  else if (/MERTUA/i.test(text)) member.statusKeluarga = 'MERTUA';
  else if (/CUCU/i.test(text)) member.statusKeluarga = 'CUCU';
  else if (/\bISTRI\b/i.test(text)) member.statusKeluarga = 'ISTRI';
  else if (/\bANAK\b/i.test(text)) member.statusKeluarga = 'ANAK';

  // ============================================================
  // 10. Kewarganegaraan
  // ============================================================
  member.kewarganegaraan = /WNA/i.test(text) ? 'WNA' : 'WNI';

  // ============================================================
  // Validasi: harus punya nama
  // ============================================================
  if (!member.namaLengkap || member.namaLengkap.length < 2) return null;

  return member;
}

// ============================================================
// Helper: Fuzzy match — cocokkan teks dengan daftar nilai
// Menggunakan skema pencocokan fleksibel (substring, typo minor)
// ============================================================
function fuzzyMatchList(text: string, values: string[]): string {
  let bestMatch = '';
  let bestScore = 0;

  for (const val of values) {
    // Bersihkan value untuk regex
    const valRegex = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Exact match (paling tinggi skor)
    if (new RegExp(`\\b${valRegex}\\b`, 'i').test(text)) {
      return val; // langsung return, exact match
    }

    // Substring match
    if (valRegex.length >= 3) {
      // Coba match keyword utama dari value
      const keywords = val.split(/[\s\/]+/).filter(k => k.length >= 3);
      let matchCount = 0;
      for (const kw of keywords) {
        const kwRegex = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(kwRegex, 'i').test(text)) matchCount++;
      }
      const score = matchCount / keywords.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = val;
      }
    }
  }

  return bestScore >= 0.5 ? bestMatch : '';
}
