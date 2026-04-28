// ============================================================
// parse-kk.ts — Parser OCR Kartu Keluarga (client-side)
// V3: Keyword-based extraction (bukan sequential)
// - Exclude No. KK dari daftar NIK anggota (fix bug #1)
// - Extract semua field by keyword dulu, lalu sisa = nama (fix bug #2)
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
  namaAyah: string;
  namaIbu: string;
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
  namaAyah: string;
  namaIbu: string;
  anggota: KKMember[];
  rawText: string;
}

// ============================================================
// Nilai valid untuk fuzzy matching
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

// ============================================================
// Stop words — kata yang BUKAN bagian dari nama
// ============================================================
const NAME_STOP_WORDS = new Set([
  'LAKI-LAKI', 'LAKI', 'LAKILAKI', 'PEREMPUAN', 'P',
  'ISLAM', 'KRISTEN', 'BUDHA', 'HINDU', 'KONGHUCU', 'KATOLIK', 'LAINNYA',
  'SMA', 'SMP', 'SD', 'SLTA', 'SLTP', 'SEDERAJAT', 'SLB',
  'PELAJAR', 'MAHASISWA', 'PNS', 'SOPIR', 'PEDAGANG', 'BURUH',
  'WIRASWASTA', 'PEGAWAI', 'KARYAWAN', 'TNI', 'POLRI', 'PETANI',
  'MENGURUS', 'RUMAH', 'TANGGA', 'BELUM', 'TIDAK', 'BEKERJA',
  'KAWIN', 'CERAI', 'MENIKAH', 'WNI', 'WNA', 'TERCATAT',
  'KEPALA', 'KELUARGA', 'ISTRI', 'ANAK', 'MERTUA', 'MENANTU', 'CUCU',
  'D1', 'D2', 'D3', 'S1', 'S2', 'S3',
  'PAKET', 'DIPLOMA', 'SARJANA', 'PASCA',
  'USTADZ', 'MUBALIGH', 'NEGERI', 'ASN', 'HARIAN', 'LEPAS',
  'PEKEBUN', 'KETENAGAKERJAAN',
  'ALAMAT', 'TEMPAT', 'TANGGAL', 'AGAMA', 'PENDIDIKAN', 'PEKERJAAN',
  'STATUS', 'KEWARGANEGARAAN', 'JENIS', 'KELAMIN',
]);

// ============================================================
// Preprocessing gambar untuk OCR
// ============================================================
export function preprocessImageForOCR(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.max(1, 2000 / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      // Contrast enhancement
      const contrast = 1.8;
      const brightness = -10;
      for (let i = 0; i < data.length; i += 4) {
        let val = data[i];
        val = ((val - 128) * contrast) + 128 + brightness;
        data[i] = Math.max(0, Math.min(255, val));
        data[i + 1] = data[i];
        data[i + 2] = data[i];
      }

      // Binary threshold
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
    namaAyah: '',
    namaIbu: '',
    anggota: [],
    rawText: text.substring(0, 3000),
  };

  // 1. Cari No. KK
  result.noKK = extractNoKK(text);
  if (!result.noKK) return null;

  // 2. Cari Nama Kepala Keluarga
  result.namaKepala = extractNamaKepala(text, lines);

  // 3. Cari Nama Ayah & Nama Ibu (header KK)
  const ayahIbu = extractNamaAyahIbu(text, lines);
  result.namaAyah = ayahIbu.ayah;
  result.namaIbu = ayahIbu.ibu;

  // 4. Cari Alamat + RT/RW
  const alamatInfo = extractAlamat(lines);
  result.alamat = alamatInfo.alamat;
  result.rt = alamatInfo.rt;
  result.rw = alamatInfo.rw;

  // 5. Cari Desa, Kecamatan, Kabupaten, Provinsi
  result.desa = extractFieldValue(lines, ['KELURAHAN', 'KEL/DESA', 'KEL\\/DESA', 'DESA/KELURAHAN', 'DESA', 'KEL DESA', 'KEL/ DESA', 'KEL./ DESA', 'KEL./DESA', 'KEL/DESA', 'KEL. DESA', 'KEL.DESA']);
  result.kecamatan = extractFieldValue(lines, ['KECAMATAN', 'KEC.', 'KEC']);
  result.kabupaten = extractFieldValue(lines, ['KABUPATEN/KOTA', 'KABUPATEN', 'KABUPATEN/ KOTA', 'KAB.', 'KABUPATEN / KOTA', 'KAB / KOTA']);
  result.provinsi = extractFieldValue(lines, ['PROVINSI', 'PROV.', 'PROV']);

  // 6. Cari anggota keluarga — kirim noKK agar di-exclude
  result.anggota = extractAllMembers(text, result.noKK);

  return result;
}

// ============================================================
// Helper: Extract No. KK
// ============================================================
function extractNoKK(text: string): string {
  const normalized = text.replace(/(\d)\s+(\d)/g, '$1$2');

  const kkPatterns = [
    /NO\s*[.\s]*KK\s*[:\s\-]*\[?\s*(\d{16})\s*\]?/i,
    /N0\s*[.\s]*KK\s*[:\s\-]*\[?\s*(\d{16})\s*\]?/i,
    /NOMOR\s*KK\s*[:\s\-]*\[?\s*(\d{16})\s*\]?/i,
  ];
  for (const pat of kkPatterns) {
    const m = normalized.match(pat);
    if (m) return m[1];
  }

  // Fallback: 16 digit pertama
  const all16 = normalized.match(/\d{16}/g);
  if (all16 && all16.length > 0) return all16[0];
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
    if (m && m[1] && m[1].length > 3) {
      return cleanName(m[1].trim());
    }
  }
  return '';
}

// ============================================================
// Helper: Extract Nama Ayah & Nama Ibu dari header KK
// ============================================================
function extractNamaAyahIbu(text: string, lines: string[]): { ayah: string; ibu: string } {
  let ayah = '';
  let ibu = '';

  for (const line of lines) {
    if (!ayah) {
      const mAyah = line.match(/NAMA\s*AYAH\s*[:\s\-]*\[?\s*([A-Z][A-Z\s.'\-]{2,40})\s*\]?/i);
      if (mAyah && mAyah[1].trim().length > 2) {
        ayah = cleanName(mAyah[1].trim());
      }
    }
    if (!ibu) {
      const mIbu = line.match(/NAMA\s*IBU\s*[:\s\-]*\[?\s*([A-Z][A-Z\s.'\-]{2,40})\s*\]?/i);
      if (mIbu && mIbu[1].trim().length > 2) {
        ibu = cleanName(mIbu[1].trim());
      }
    }
    if (ayah && ibu) break;
  }

  return { ayah, ibu };
}

// ============================================================
// Helper: Bersihkan nama dari suffix bukan nama
// ============================================================
function cleanName(nama: string): string {
  const stopPatterns = [
    /\s+(LAKI[- ]?LAKI|PEREMPUAN)\s*.*$/i,
    /\s+(ISLAM|KRISTEN|BUDHA|HINDU|KONGHUCU|KATOLIK)\s*.*$/i,
    /\s+\d{2}[\-\/\.]\d{2}[\-\/\.]\d{4}.*$/,
    /\s+(KAWIN|CERAI|BELUM\s*MENIKAH|BELUM\s*KAWIN).*$/i,
    /\s+(WNI|WNA)\s*.*$/,
    /\s+(KEPALA\s*KELUARGA|ISTRI|ANAK|MERTUA|MENANTU|CUCU)\s*.*$/i,
    /\s+(PELAJAR|PNS|SOPIR|PEDAGANG|BURUH|WIRASWASTA|PEGAWAI|KARYAWAN|PETANI|MENGURUS).*$/i,
    /\s+(SMA|SMP|SD|SLTA|SLTP|SEDERAJAT|D1|D2|D3|S1|S2|S3|PAKET|DIPLOMA|SARJANA|PASCA).*$/i,
  ];
  for (const pat of stopPatterns) {
    nama = nama.replace(pat, '').trim();
  }
  return nama;
}

// ============================================================
// Helper: Extract Alamat + RT/RW
// ============================================================
function extractAlamat(lines: string[]): { alamat: string; rt: string; rw: string } {
  let alamat = '';
  let rt = '';
  let rw = '';

  for (let i = 0; i < lines.length; i++) {
    if (/^ALAMAT/i.test(lines[i])) {
      alamat = lines[i].replace(/^ALAMAT\s*[:\s\-]*/i, '').trim();
      if (!alamat && i + 1 < lines.length) {
        alamat = lines[i + 1].trim();
      }
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
// Cari semua anggota keluarga — EXCLUDE No. KK
// ============================================================
function extractAllMembers(fullText: string, noKK: string): KKMember[] {
  const normalized = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const normalizedNoSpaces = normalized.replace(/(\d)\s+(\d)/g, '$1$2');

  const members: KKMember[] = [];

  // Cari semua NIK 16 digit — EXCLUDE No. KK!
  const nikMatches: { nik: string; startIdx: number }[] = [];
  const nikRegex = /\b(\d{16})\b/g;
  let match;
  while ((match = nikRegex.exec(normalizedNoSpaces)) !== null) {
    if (match[1] !== noKK) {  // ← FIX BUG #1: exclude No. KK
      nikMatches.push({ nik: match[1], startIdx: match.index });
    }
  }

  if (nikMatches.length === 0) return members;

  // Parse setiap NIK segment (dari NIK ini sampai NIK berikutnya)
  for (let i = 0; i < nikMatches.length; i++) {
    const nikInfo = nikMatches[i];
    const nextNikStart = (i + 1 < nikMatches.length) ? nikMatches[i + 1].startIdx : normalizedNoSpaces.length;
    const segment = normalizedNoSpaces.substring(nikInfo.startIdx, nextNikStart);

    const member = parseMemberFromSegment(segment, nikInfo.nik);
    if (member && member.namaLengkap) {
      members.push(member);
    }
  }

  return members;
}

// ============================================================
// Parser per-anggota: KEYWORD-BASED (bukan sequential)
//
// Alur:
// 1. Extract SEMUA field yang dikenali (JK, agama, pendidikan, dll)
//    → urutan di OCR tidak penting, dicari by keyword
// 2. Hapus semua field yang sudah dikenali dari teks
// 3. Sisa teks yang berupa huruf kapital = NAMA
// ============================================================
function parseMemberFromSegment(segment: string, nik: string): KKMember | null {
  const text = segment.replace(/\s+/g, ' ').trim();
  const nikIdx = text.indexOf(nik);
  if (nikIdx < 0) return null;

  // Teks setelah NIK — normalize spasi di sekitar / dan -
  let afterNik = text.substring(nikIdx + nik.length).trim();
  afterNik = afterNik.replace(/\s*\/\s*/g, '/').replace(/\s*[-–—]\s*/g, '-');

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
    namaAyah: '',
    namaIbu: '',
  };

  // ============================================================
  // PASS 1: Extract semua field yang dikenali (urutan bebas)
  // ============================================================

  // 1. Tanggal Lahir
  const dateMatch = afterNik.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    const dd = +d, mm = +m, yy = +y;
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2025) {
      member.tanggalLahir = `${y}-${m}-${d}`;
    }
  }

  // 2. Jenis Kelamin
  if (/LAKI[\s-]*LAKI|LAKILAKI/i.test(afterNik)) {
    member.jenisKelamin = 'LAKI-LAKI';
  } else if (/\bPEREMPUAN\b/i.test(afterNik)) {
    member.jenisKelamin = 'PEREMPUAN';
  }

  // 3. Agama
  for (const a of AGAMA_VALUES) {
    if (new RegExp(`\\b${escapeRegex(a)}\\b`, 'i').test(afterNik)) {
      member.agama = a;
      break;
    }
  }

  // 4. Pendidikan
  member.pendidikan = fuzzyMatchList(afterNik, PENDIDIKAN_VALUES);

  // 5. Pekerjaan
  member.pekerjaan = fuzzyMatchList(afterNik, PEKERJAAN_VALUES);

  // 6. Status Perkawinan
  if (/KAWIN\s*(BELUM|TIDAK)\s*(TERCATAT)?/i.test(afterNik) || /KAWIN\s*TERCATAT/i.test(afterNik)) {
    member.statusPerkawinan = 'KAWIN';
  } else {
    member.statusPerkawinan = fuzzyMatchList(afterNik, STATUS_KAWIN_VALUES);
  }

  // 7. Status Keluarga
  if (/KEPALA\s*KELUARGA/i.test(afterNik)) member.statusKeluarga = 'KEPALA KELUARGA';
  else if (/\bMENANTU\b/i.test(afterNik)) member.statusKeluarga = 'MENANTU';
  else if (/\bMERTUA\b/i.test(afterNik)) member.statusKeluarga = 'MERTUA';
  else if (/\bCUCU\b/i.test(afterNik)) member.statusKeluarga = 'CUCU';
  else if (/\bISTRI\b/i.test(afterNik)) member.statusKeluarga = 'ISTRI';
  else if (/\bANAK\b/i.test(afterNik)) member.statusKeluarga = 'ANAK';

  // 8. Kewarganegaraan
  member.kewarganegaraan = /\bWNA\b/i.test(afterNik) ? 'WNA' : 'WNI';

  // 9. Nama Ayah & Ibu
  const mAyah = afterNik.match(/NAMA\s*AYAH\s*[:\s-]*\[?\s*([A-Z][A-Z\s.'-]{2,30})\s*\]?/i);
  if (mAyah) member.namaAyah = cleanName(mAyah[1].trim());
  const mIbu = afterNik.match(/NAMA\s*IBU\s*[:\s-]*\[?\s*([A-Z][A-Z\s.'-]{2,30})\s*\]?/i);
  if (mIbu) member.namaIbu = cleanName(mIbu[1].trim());

  // ============================================================
  // PASS 2: Bangun daftar phrase yang harus dihapus dari teks
  // untuk menemukan NAMA dari sisa kata
  // ============================================================
  const phrasesToRemove: string[] = [];

  // JK phrases (banyak variant OCR)
  phrasesToRemove.push('LAKI-LAKI', 'LAKI LAKI', 'LAKILAKI', 'LAKI');
  phrasesToRemove.push('PEREMPUAN');

  // Agama
  if (member.agama) phrasesToRemove.push(member.agama);

  // Pendidikan — tambahkan variant pecahan kata
  if (member.pendidikan) {
    phrasesToRemove.push(member.pendidikan);
    // Tambahkan kata-kata penyusunnya (misal "SMA/SEDERAJAT" → "SMA", "SEDERAJAT")
    const pWords = member.pendidikan.split(/[\s\/]+/);
    for (const pw of pWords) {
      if (pw.length >= 2) phrasesToRemove.push(pw);
    }
  }

  // Pekerjaan — tambahkan variant pecahan kata
  if (member.pekerjaan) {
    phrasesToRemove.push(member.pekerjaan);
    const pWords = member.pekerjaan.split(/[\s\/]+/);
    for (const pw of pWords) {
      if (pw.length >= 2) phrasesToRemove.push(pw);
    }
  }

  // Status Perkawinan
  if (member.statusPerkawinan) {
    phrasesToRemove.push(member.statusPerkawinan);
    // Variant "KAWIN" sering muncul sebagai bagian dari "KAWIN TERCATAT"
    if (member.statusPerkawinan === 'KAWIN') {
      phrasesToRemove.push('KAWIN BELUM TERCATAT', 'KAWIN TIDAK TERCATAT', 'KAWIN TERCATAT', 'BELUM TERCATAT', 'TERCATAT');
    }
    if (member.statusPerkawinan === 'BELUM MENIKAH') {
      phrasesToRemove.push('BELUM MENIKAH');
    }
    if (member.statusPerkawinan === 'BELUM KAWIN') {
      phrasesToRemove.push('BELUM KAWIN');
    }
    // Tambahkan kata penyusun
    const skWords = member.statusPerkawinan.split(/\s+/);
    for (const sw of skWords) {
      if (sw.length >= 2) phrasesToRemove.push(sw);
    }
  }

  // Status Keluarga
  if (member.statusKeluarga) {
    phrasesToRemove.push(member.statusKeluarga);
    const skWords = member.statusKeluarga.split(/\s+/);
    for (const sw of skWords) {
      if (sw.length >= 3) phrasesToRemove.push(sw);
    }
  }

  // WN
  phrasesToRemove.push('WNI', 'WNA');

  // Nama Ayah/Ibu label
  phrasesToRemove.push('NAMA AYAH', 'NAMA IBU');

  // ============================================================
  // PASS 3: Hapus semua phrase, sisa = NAMA
  // ============================================================
  // Urutkan dari yang terpanjang dulu (hindari partial match)
  phrasesToRemove.sort((a, b) => b.length - a.length);

  let cleaned = afterNik;
  for (const phrase of phrasesToRemove) {
    if (!phrase) continue;
    const regex = new RegExp(escapeRegex(phrase), 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }

  // Hapus tanggal
  cleaned = cleaned.replace(/\d{2}[-/.]\d{2}[-/.]\d{4}/g, ' ');
  // Hapus angka berdiri sendiri (nomor urut, dll)
  cleaned = cleaned.replace(/\b\d{1,3}\b/g, ' ');
  // Hapus karakter non-huruf sisa (, . : ; - = + dll)
  cleaned = cleaned.replace(/[^A-Za-z\s.'\-]/g, ' ');

  // Ambil kata yang tersisa — harus huruf kapital, panjang >= 2, bukan stop word
  const remainingWords = cleaned.split(/\s+/).filter(w => w.length >= 2);
  const nameWords: string[] = [];

  for (const w of remainingWords) {
    const upper = w.toUpperCase();
    // Harus huruf kapital semua (atau huruf besar di awal + kecil)
    if (/^[A-Z][A-Z.'\-]*$/.test(upper) || /^[A-Z][a-z.'\-]+$/.test(w)) {
      // Bukan stop word
      if (NAME_STOP_WORDS.has(upper)) continue;
      // Bukan label field
      if (/^(NAMA|NO|NIK|RT|RW|ALAMAT)$/i.test(upper)) continue;
      // Bukan singkatan pendidikan/pekerjaan yang lolos filter
      if (/^(II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)$/i.test(upper)) continue;
      nameWords.push(upper);
    }
  }

  member.namaLengkap = nameWords.join(' ').trim();

  // ============================================================
  // PASS 4: Tempat Lahir
  // Kata yang paling dekat dengan tanggal lahir, sebelumnya,
  // dan bukan stop word + bukan bagian dari nama
  // ============================================================
  if (member.tanggalLahir) {
    const dateRegex = /\d{2}[-/.]\d{2}[-/.]\d{4}/;
    const dateIdx = afterNik.search(dateRegex);
    if (dateIdx > 0) {
      const beforeDate = afterNik.substring(0, dateIdx).trim();
      const wordsBefore = beforeDate.split(/\s+/);
      // Cari dari belakang — kata terakhir sebelum tanggal
      for (let i = wordsBefore.length - 1; i >= 0; i--) {
        const w = wordsBefore[i].toUpperCase();
        if (w.length < 2 || w.length > 20) continue;
        if (!/^[A-Z]+$/.test(w)) continue;
        if (NAME_STOP_WORDS.has(w)) continue;
        // Jangan ambil kata yang sudah jadi bagian nama
        if (member.namaLengkap && member.namaLengkap.includes(w) && w.length <= 4) continue;
        member.tempatLahir = w;
        break;
      }
    }
  }

  // ============================================================
  // Fallback: jika nama kosong, coba ambil kata kapital pertama
  // ============================================================
  if (!member.namaLengkap || member.namaLengkap.length < 2) {
    const words = afterNik.split(/\s+/);
    for (const w of words.slice(0, 4)) {
      const upper = w.toUpperCase();
      if (/^[A-Z][A-Z.'\-]+$/.test(upper) && upper.length >= 3 && !NAME_STOP_WORDS.has(upper)) {
        member.namaLengkap = upper;
        break;
      }
    }
  }

  // Minimal harus punya nama
  if (!member.namaLengkap || member.namaLengkap.length < 2) return null;

  // Log untuk debug
  console.log(`[parseKK] NIK ${nik}: nama="${member.namaLengkap}", JK=${member.jenisKelamin}, tLahir=${member.tempatLahir} ${member.tanggalLahir}, agama=${member.agama}, pend=${member.pendidikan}, pekerjaan=${member.pekerjaan}, kawin=${member.statusPerkawinan}, status=${member.statusKeluarga}, WN=${member.kewarganegaraan}`);

  return member;
}

// ============================================================
// Helper: Fuzzy match — cocokkan teks dengan daftar nilai
// ============================================================
function fuzzyMatchList(text: string, values: string[]): string {
  let bestMatch = '';
  let bestScore = 0;

  for (const val of values) {
    const valRegex = escapeRegex(val);

    // Exact match — prioritas tertinggi
    if (new RegExp(`\\b${valRegex}\\b`, 'i').test(text)) {
      return val;
    }

    // Substring match berdasarkan keyword
    const keywords = val.split(/[\s\/]+/).filter(k => k.length >= 2);
    if (keywords.length === 0) continue;

    let matchCount = 0;
    for (const kw of keywords) {
      const kwRegex = escapeRegex(kw);
      if (new RegExp(`\\b${kwRegex}\\b`, 'i').test(text)) matchCount++;
    }
    const score = matchCount / keywords.length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = val;
    }
  }

  return bestScore >= 0.5 ? bestMatch : '';
}
