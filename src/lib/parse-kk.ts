// ============================================================
// parse-kk.ts — Parser OCR Kartu Keluarga v4
// 
// STRATEGI: Label-based extraction per NIK segment
// 1. Exclude No. KK dari NIK anggota (fix bug #1)
// 2. Per NIK, ambil segment sampai NIK berikutnya
// 3. Dalam segment, cari LABEL (NIK, NAMA, JK, AGAMA, dll)
//    untuk mengidentifikasi value yang benar ke field yang benar
// 4. Jika label tidak ketemu, fallback ke keyword extraction
// 5. Sisa text = nama
//
// VALUES harus EXACTLY match constants.ts agar Select field bisa
// menampilkan value dengan benar.
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
// VALUES — harus EXACTLY match constants.ts !!!
// ============================================================

// AGAMA = ['ISLAM', 'KRISTEN', 'BUDHA', 'HINDU', 'LAINNYA']
const AGAMA_VALUES = ['ISLAM', 'KRISTEN', 'BUDHA', 'HINDU', 'LAINNYA'] as const;
// OCR variants → map ke valid value
const AGAMA_MAP: Record<string, string> = {
  'ISLAM': 'ISLAM',
  'KRISTEN': 'KRISTEN',
  'BUDHA': 'BUDHA',
  'HINDU': 'HINDU',
  'KONGHUCU': 'LAINNYA',
  'KATOLIK': 'KRISTEN',
  'PROTESTAN': 'KRISTEN',
};

// PENDIDIKAN = ['TIDAK/BELUM SEKOLAH', 'BELUM TAMAT SD/SEDERAJAT', 'TIDAK TAMAT SD/SEDERAJAT',
//   'SD/SEDERAJAT', 'SMP/SEDERAJAT', 'SMA/SEDERAJAT', 'PAKET A', 'PAKET B', 'PAKET C',
//   'SLB', 'D1', 'D2', 'D3', 'S1', 'S2', 'S3']
const PENDIDIKAN_VALUES = [
  'TIDAK/BELUM SEKOLAH', 'BELUM TAMAT SD/SEDERAJAT', 'TIDAK TAMAT SD/SEDERAJAT',
  'SD/SEDERAJAT', 'SMP/SEDERAJAT', 'SMA/SEDERAJAT',
  'PAKET A', 'PAKET B', 'PAKET C', 'SLB',
  'D1', 'D2', 'D3', 'S1', 'S2', 'S3',
] as const;
const PENDIDIKAN_MAP: Record<string, string> = {
  'TIDAK/BELUM SEKOLAH': 'TIDAK/BELUM SEKOLAH',
  'BELUM TAMAT SD/SEDERAJAT': 'BELUM TAMAT SD/SEDERAJAT',
  'TIDAK TAMAT SD/SEDERAJAT': 'TIDAK TAMAT SD/SEDERAJAT',
  'SD/SEDERAJAT': 'SD/SEDERAJAT',
  'SMP/SEDERAJAT': 'SMP/SEDERAJAT',
  'SMA/SEDERAJAT': 'SMA/SEDERAJAT',
  'PAKET A': 'PAKET A',
  'PAKET B': 'PAKET B',
  'PAKET C': 'PAKET C',
  'SLB': 'SLB',
  'D1': 'D1', 'D2': 'D2', 'D3': 'D3', 'S1': 'S1', 'S2': 'S2', 'S3': 'S3',
  'DIPLOMA I/II/III': 'D3',
  'DIPLOMA': 'D3',
  'SARJANA': 'S1',
  'PASCA SARJANA': 'S2',
  'MAGISTER': 'S2',
  'DOKTOR': 'S3',
  'SD': 'SD/SEDERAJAT',
  'SMP': 'SMP/SEDERAJAT',
  'SMA': 'SMA/SEDERAJAT',
  'SEDERAJAT': 'SD/SEDERAJAT',
};

// PEKERJAAN = ['PELAJAR/MAHASISWA', 'PNS', 'SOPIR', 'USTADZ/MUBALIGH', 'PEDAGANG',
//   'BELUM/TIDAK BEKERJA', 'BURUH HARIAN LEPAS', 'MENGURUS RUMAH TANGGA',
//   'WIRASWASTA', 'PEGAWAI ASN', 'KARYAWAN SWASTA', 'TNI', 'POLRI']
const PEKERJAAN_VALUES = [
  'PELAJAR/MAHASISWA', 'PNS', 'SOPIR', 'USTADZ/MUBALIGH', 'PEDAGANG',
  'BELUM/TIDAK BEKERJA', 'BURUH HARIAN LEPAS', 'MENGURUS RUMAH TANGGA',
  'WIRASWASTA', 'PEGAWAI ASN', 'KARYAWAN SWASTA', 'TNI', 'POLRI',
] as const;
const PEKERJAAN_MAP: Record<string, string> = {
  'PELAJAR/MAHASISWA': 'PELAJAR/MAHASISWA',
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
  'PELAJAR': 'PELAJAR/MAHASISWA',
  'MAHASISWA': 'PELAJAR/MAHASISWA',
  'BURUH': 'BURUH HARIAN LEPAS',
  'PETANI/PEKEBUN': 'PEDAGANG',
  'PETANI': 'PEDAGANG',
  'PEGAWAI NEGERI': 'PNS',
  'PEGAWAI': 'PEGAWAI ASN',
  'KARYAWAN': 'KARYAWAN SWASTA',
  'WIRASWASTI': 'WIRASWASTA',
  'RUMAH TANGGA': 'MENGURUS RUMAH TANGGA',
  'IRT': 'MENGURUS RUMAH TANGGA',
};

// STATUS_PERKAWINAN = ['BELUM MENIKAH', 'KAWIN', 'CERAI HIDUP', 'CERAI MATI']
const STATUS_KAWIN_VALUES = ['BELUM MENIKAH', 'KAWIN', 'CERAI HIDUP', 'CERAI MATI'] as const;
const STATUS_KAWIN_MAP: Record<string, string> = {
  'BELUM MENIKAH': 'BELUM MENIKAH',
  'KAWIN': 'KAWIN',
  'CERAI HIDUP': 'CERAI HIDUP',
  'CERAI MATI': 'CERAI MATI',
  'KAWIN TERCATAT': 'KAWIN',
  'KAWIN BELUM TERCATAT': 'KAWIN',
  'KAWIN TIDAK TERCATAT': 'KAWIN',
  'BELUM KAWIN': 'BELUM MENIKAH',
  'CERAI': 'CERAI HIDUP',
  'MENIKAH': 'KAWIN',
};

// STATUS_KELUARGA = ['KEPALA KELUARGA', 'ISTRI', 'ANAK', 'MERTUA', 'MENANTU', 'CUCU', 'LAINNYA']
const STATUS_KELUARGA_VALUES = ['KEPALA KELUARGA', 'ISTRI', 'ANAK', 'MERTUA', 'MENANTU', 'CUCU', 'LAINNYA'] as const;

// ============================================================
// Stop words — kata BUKAN nama (untuk fallback keyword extraction)
// ============================================================
const NAME_STOP_WORDS = new Set([
  'LAKI-LAKI', 'LAKI', 'LAKILAKI', 'PEREMPUAN', 'P',
  'ISLAM', 'KRISTEN', 'BUDHA', 'HINDU', 'KONGHUCU', 'KATOLIK', 'LAINNYA',
  'SMA', 'SMP', 'SD', 'SLTA', 'SLTP', 'SEDERAJAT', 'SLB',
  'PELAJAR', 'MAHASISWA', 'PNS', 'SOPIR', 'PEDAGANG', 'BURUH',
  'WIRASWASTA', 'WIRASWASTI', 'PEGAWAI', 'KARYAWAN', 'TNI', 'POLRI', 'PETANI',
  'MENGURUS', 'RUMAH', 'TANGGA', 'BELUM', 'TIDAK', 'BEKERJA',
  'KAWIN', 'CERAI', 'MENIKAH', 'WNI', 'WNA', 'TERCATAT',
  'KEPALA', 'KELUARGA', 'ISTRI', 'ANAK', 'MERTUA', 'MENANTU', 'CUCU',
  'D1', 'D2', 'D3', 'S1', 'S2', 'S3',
  'PAKET', 'DIPLOMA', 'SARJANA', 'PASCA',
  'USTADZ', 'MUBALIGH', 'NEGERI', 'ASN', 'HARIAN', 'LEPAS',
  'PEKEBUN', 'KETENAGAKERJAAN',
  'ALAMAT', 'TEMPAT', 'TANGGAL', 'AGAMA', 'PENDIDIKAN', 'PEKERJAAN',
  'STATUS', 'KEWARGANEGARAAN', 'JENIS', 'KELAMIN', 'HUB', 'DALAM',
  'NAMA', 'NO', 'NIK', 'RT', 'RW', 'KEL', 'DESA', 'KEC',
  'KABUPATEN', 'PROVINSI',
  'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
]);

// ============================================================
// Preprocessing gambar untuk OCR
// ============================================================
export function preprocessImageForOCR(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const maxDim = 3000; // upscale untuk teks kecil di KK

      // Upscale jika gambar terlalu kecil (< 1500px), downscale jika terlalu besar
      const currentMax = Math.max(w, h);
      if (currentMax < 1500) {
        const scale = 1500 / currentMax;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      } else if (currentMax > maxDim) {
        const scale = maxDim / currentMax;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      // Gunakan high-quality interpolation untuk upscale
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      // Preprocessing RINGAN — Tesseract LSTM butuh gradasi, bukan binary!
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Step 1: Grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
      }

      // Step 2: Mild contrast enhancement (1.3x, bukan 1.8x yang agresif)
      // Tesseract LSTM butuh gradasi — binary threshold menghancurkan info!
      for (let i = 0; i < data.length; i += 4) {
        let val = ((data[i] - 128) * 1.3) + 128;
        data[i] = Math.max(0, Math.min(255, val));
        data[i + 1] = data[i]; data[i + 2] = data[i];
      }

      // Step 3: Unsharp mask sederhana — pertajam edge huruf
      // TANPA binary threshold! Tesseract punya Otsu threshold sendiri yang lebih baik
      ctx.putImageData(imageData, 0, 0);

      // Simpan sebagai JPEG berkualitas tinggi (bukan PNG yang besar)
      resolve(canvas.toDataURL('image/jpeg', 0.92));
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
    noKK: '', alamat: '', rt: '', rw: '', desa: '',
    kecamatan: '', kabupaten: '', provinsi: '',
    namaKepala: '', namaAyah: '', namaIbu: '',
    anggota: [], rawText: text.substring(0, 3000),
  };

  // 1. No. KK
  result.noKK = extractNoKK(text);
  if (!result.noKK) return null;

  // 2. Nama Kepala
  result.namaKepala = extractNamaKepala(lines);

  // 3. Nama Ayah & Ibu
  const ai = extractNamaAyahIbu(lines);
  result.namaAyah = ai.ayah;
  result.namaIbu = ai.ibu;

  // 4. Alamat + RT/RW
  const al = extractAlamat(lines);
  result.alamat = al.alamat;
  result.rt = al.rt;
  result.rw = al.rw;

  // 5. Wilayah
  result.desa = extractField(lines, ['KELURAHAN','KEL/DESA','KEL\\/DESA','DESA/KELURAHAN','DESA','KEL DESA','KEL/ DESA','KEL./DESA','KEL. DESA']);
  result.kecamatan = extractField(lines, ['KECAMATAN','KEC.','KEC']);
  result.kabupaten = extractField(lines, ['KABUPATEN/KOTA','KABUPATEN','KAB.','KABUPATEN / KOTA','KAB / KOTA']);
  result.provinsi = extractField(lines, ['PROVINSI','PROV.','PROV']);

  // 6. Anggota — exclude No. KK!
  result.anggota = extractAllMembers(text, lines, result.noKK);

  return result;
}

// ============================================================
// HEADER EXTRACTION FUNCTIONS
// ============================================================

function extractNoKK(text: string): string {
  const n = text.replace(/(\d)\s+(\d)/g, '$1$2');
  for (const p of [
    /NO\s*[.\s]*KK\s*[:\s\-]*\[?\s*(\d{16})\s*\]?/i,
    /N0\s*[.\s]*KK\s*[:\s\-]*\[?\s*(\d{16})\s*\]?/i,
    /NOMOR\s*KK\s*[:\s\-]*\[?\s*(\d{16})\s*\]?/i,
  ]) {
    const m = n.match(p);
    if (m) return m[1];
  }
  const all = n.match(/\d{16}/g);
  return all?.[0] || '';
}

function extractNamaKepala(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/NAMA\s*(KEPALA)?\s*KELUARGA\s*[:\s\-]*\[?\s*([A-Z][A-Z\s.'\-]{2,40})\s*\]?/i);
    if (m && m[1] && m[1].trim().length > 2) return cleanName(m[1].trim());
  }
  return '';
}

function extractNamaAyahIbu(lines: string[]): { ayah: string; ibu: string } {
  let ayah = '', ibu = '';
  for (const line of lines) {
    if (!ayah) {
      const m = line.match(/NAMA\s*AYAH\s*[:\s\-]*\[?\s*([A-Z][A-Z\s.'\-]{2,40})\s*\]?/i);
      if (m) ayah = cleanName(m[1].trim());
    }
    if (!ibu) {
      const m = line.match(/NAMA\s*IBU\s*[:\s\-]*\[?\s*([A-Z][A-Z\s.'\-]{2,40})\s*\]?/i);
      if (m) ibu = cleanName(m[1].trim());
    }
    if (ayah && ibu) break;
  }
  return { ayah, ibu };
}

function extractAlamat(lines: string[]): { alamat: string; rt: string; rw: string } {
  for (let i = 0; i < lines.length; i++) {
    if (/^ALAMAT/i.test(lines[i])) {
      let alamat = lines[i].replace(/^ALAMAT\s*[:\s\-]*/i, '').trim();
      if (!alamat && i + 1 < lines.length) alamat = lines[i + 1].trim();
      let rt = '', rw = '';
      for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
        const m = lines[j].match(/(\d{3})\s*[\/\\]\s*(\d{3})/);
        if (m) { rt = m[1]; rw = m[2]; break; }
      }
      return { alamat, rt, rw };
    }
  }
  return { alamat: '', rt: '', rw: '' };
}

function extractField(lines: string[], keywords: string[]): string {
  for (const kw of keywords) {
    const regex = new RegExp(`^${esc(kw)}\\s*[:\\s\\/\\-]*\\s*(.+)$`, 'i');
    for (const line of lines) {
      const m = line.match(regex);
      if (m) return m[1].trim().replace(/,\s*KODE\s*POS\s*\d{5}.*/i, '').trim();
    }
  }
  return '';
}

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function cleanName(nama: string): string {
  for (const p of [
    /\s+(LAKI[- ]?LAKI|PEREMPUAN)\s*.*$/i,
    /\s+(ISLAM|KRISTEN|BUDHA|HINDU|KONGHUCU|KATOLIK)\s*.*$/i,
    /\s+\d{2}[\-\/\.]\d{2}[\-\/\.]\d{4}.*$/,
    /\s+(KAWIN|CERAI|BELUM\s*MENIKAH|BELUM\s*KAWIN).*$/i,
    /\s+(WNI|WNA)\s*.*$/,
    /\s+(KEPALA\s*KELUARGA|ISTRI|ANAK|MERTUA|MENANTU|CUCU)\s*.*$/i,
    /\s+(PELAJAR|PNS|SOPIR|PEDAGANG|BURUH|WIRASWASTA|PEGAWAI|KARYAWAN|PETANI|MENGURUS).*$/i,
    /\s+(SMA|SMP|SD|SLTA|SLTP|SEDERAJAT|D1|D2|D3|S1|S2|S3|PAKET|DIPLOMA|SARJANA|PASCA).*$/i,
  ]) nama = nama.replace(p, '').trim();
  return nama;
}

// ============================================================
// ANGGOTA EXTRACTION — Label-based per NIK segment
// ============================================================

function extractAllMembers(fullText: string, lines: string[], noKK: string): KKMember[] {
  const norm = fullText.replace(/(\d)\s+(\d)/g, '$1$2');

  // Cari semua NIK 16 digit — EXCLUDE No. KK!
  const niks: { nik: string; idx: number }[] = [];
  const re = /\b(\d{16})\b/g;
  let m;
  while ((m = re.exec(norm)) !== null) {
    if (m[1] !== noKK) niks.push({ nik: m[1], idx: m.index });
  }
  if (niks.length === 0) return [];

  const members: KKMember[] = [];
  for (let i = 0; i < niks.length; i++) {
    const start = niks[i].idx;
    const end = (i + 1 < niks.length) ? niks[i + 1].idx : norm.length;
    const segment = norm.substring(start, end);
    const member = parseMember(segment, niks[i].nik);
    if (member) members.push(member);
  }
  return members;
}

// ============================================================
// Parser per-anggota: LABEL-BASED extraction
//
// Label yang muncul di OCR:
// - "NIK" → 16 digit (sudah diketahui)
// - "NAMA" → teks nama
// - "JK" atau "JENIS KELAMIN" → LAKI-LAKI / PEREMPUAN
// - "TEMPAT LAHIR" atau bagian dari "TTL" → kota
// - "TANGGAL LAHIR" atau "TGL LAHIR" atau bagian "TTL" → DD-MM-YYYY
// - "AGAMA" → ISLAM, dll
// - "PENDIDIKAN" → SMA/SEDERAJAT, dll
// - "PEKERJAAN" → PNS, dll
// - "STATUS PERKAWINAN" atau "STATUS" → KAWIN, dll
// - "STATUS HUB. KELUARGA" atau "HUB. KELUARGA" → KEPALA KELUARGA, dll
// - "KEWARGANEGARAAN" → WNI / WNA
// ============================================================
function parseMember(segment: string, nik: string): KKMember | null {
  const text = segment.replace(/\s+/g, ' ').trim();
  const nikIdx = text.indexOf(nik);
  if (nikIdx < 0) return null;

  const afterNik = text.substring(nikIdx + nik.length).trim();

  const member: KKMember = {
    nik, namaLengkap: '', jenisKelamin: '', tempatLahir: '',
    tanggalLahir: '', agama: '', pendidikan: '', pekerjaan: '',
    statusPerkawinan: '', statusKeluarga: '', kewarganegaraan: '',
    namaAyah: '', namaIbu: '',
  };

  // Track which parts of text have been "consumed" by label extraction
  const consumedRanges: [number, number][] = [];

  // ============================================================
  // 1. NAMA — cari "NAMA" label, atau fallback
  // ============================================================
  const namaLabelMatch = afterNik.match(/\bNAMA\s*[:\s]*([A-Z][A-Z\s.'\-]{2,40})/i);
  if (namaLabelMatch) {
    member.namaLengkap = cleanName(namaLabelMatch[1].trim());
    markConsumed(afterNik, namaLabelMatch.index!, namaLabelMatch[0].length, consumedRanges);
  }

  // ============================================================
  // 2. JENIS KELAMIN — cari label "JK" atau "JENIS KELAMIN"
  // ============================================================
  const jkLabelMatch = afterNik.match(/(?:JENIS\s*KELAMIN|JK)\s*[:\s]*(LAKI[\s\-]*LAKI|LAKILAKI|PEREMPUAN|LAKI|P)/i);
  if (jkLabelMatch) {
    const raw = jkLabelMatch[1].toUpperCase().replace(/\s+/g, '');
    if (raw.includes('LAKI')) member.jenisKelamin = 'LAKI-LAKI';
    else if (raw.includes('PEREMP')) member.jenisKelamin = 'PEREMPUAN';
    markConsumed(afterNik, jkLabelMatch.index!, jkLabelMatch[0].length, consumedRanges);
  } else {
    // Fallback: cari JK value tanpa label
    if (/LAKI[\s\-]*LAKI|LAKILAKI/i.test(afterNik)) member.jenisKelamin = 'LAKI-LAKI';
    else if (/\bPEREMPUAN\b/i.test(afterNik)) member.jenisKelamin = 'PEREMPUAN';
  }

  // ============================================================
  // 3. TTL (Tempat Tanggal Lahir) — format: "KOTA, DD-MM-YYYY"
  //    atau terpisah: TEMPAT LAHIR = kota, TANGGAL LAHIR = tanggal
  // ============================================================
  // Coba format TTL terlebih dahulu: "BOGOR, 01-01-1980"
  const ttlMatch = afterNik.match(/(?:TTL|TEMPAT\s*\/\s*TANGGAL\s*LAHIR)\s*[:\s]*([A-Z\s.'\-]{2,20})\s*[,.\s]+(\d{2}[\-\/\.]\d{2}[\-\/\.]\d{4})/i);
  if (ttlMatch) {
    member.tempatLahir = ttlMatch[1].trim().replace(/[,.\s]+$/, '');
    const d = ttlMatch[2];
    const dm = d.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
    if (dm) {
      const dd = +dm[1], mm = +dm[2], yy = +dm[3];
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2025) {
        member.tanggalLahir = `${dm[3]}-${dm[2]}-${dm[1]}`;
      }
    }
    markConsumed(afterNik, ttlMatch.index!, ttlMatch[0].length, consumedRanges);
  }

  // Cari TEMPAT LAHIR terpisah
  if (!member.tempatLahir || !member.tanggalLahir) {
    const tlMatch = afterNik.match(/(?:TEMPAT\s*LAHIR)\s*[:\s]*([A-Z\s.'\-]{2,20})/i);
    if (tlMatch && !member.tempatLahir) {
      member.tempatLahir = tlMatch[1].trim().replace(/[,.\s]+$/, '');
      markConsumed(afterNik, tlMatch.index!, tlMatch[0].length, consumedRanges);
    }
    const tgMatch = afterNik.match(/(?:TANGGAL\s*LAHIR|TGL\s*LAHIR)\s*[:\s]*(\d{2}[\-\/\.]\d{2}[\-\/\.]\d{4})/i);
    if (tgMatch && !member.tanggalLahir) {
      const dm = tgMatch[1].match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
      if (dm) {
        const dd = +dm[1], mm = +dm[2], yy = +dm[3];
        if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2025) {
          member.tanggalLahir = `${dm[3]}-${dm[2]}-${dm[1]}`;
        }
      }
      markConsumed(afterNik, tgMatch.index!, tgMatch[0].length, consumedRanges);
    }
  }

  // Fallback tanggal lahir: cari DD-MM-YYYY
  if (!member.tanggalLahir) {
    const dm = afterNik.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
    if (dm) {
      const dd = +dm[1], mm = +dm[2], yy = +dm[3];
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2025) {
        member.tanggalLahir = `${dm[3]}-${dm[2]}-${dm[1]}`;
      }
    }
  }

  // Fallback tempat lahir: kata sebelum tanggal
  if (!member.tempatLahir && member.tanggalLahir) {
    const dateStr = member.tanggalLahir.replace(/-/g, '[-/.]');
    const dateIdx = afterNik.search(new RegExp(`\\d{2}[-/.]\\d{2}[-/.]${dateStr.substring(0,4)}`));
    if (dateIdx > 0) {
      const before = afterNik.substring(Math.max(0, dateIdx - 30), dateIdx).trim();
      const words = before.split(/\s+/);
      for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i].toUpperCase();
        if (w.length >= 2 && w.length <= 20 && /^[A-Z]+$/.test(w) && !NAME_STOP_WORDS.has(w)) {
          member.tempatLahir = w;
          break;
        }
      }
    }
  }

  // ============================================================
  // 4. AGAMA — cari label atau fallback
  // ============================================================
  const agamaLabelMatch = afterNik.match(/AGAMA\s*[:\s]*([A-Z\s\/]+?)(?=\s+(?:PENDIDIKAN|PEKERJAAN|STATUS|HUB|KEWARGA|WNI|WNA|$|\d{2}[-/.]))/i);
  if (agamaLabelMatch) {
    member.agama = mapValue(agamaLabelMatch[1].trim().toUpperCase(), AGAMA_MAP);
    markConsumed(afterNik, agamaLabelMatch.index!, agamaLabelMatch[0].length, consumedRanges);
  }
  if (!member.agama) {
    member.agama = mapValueFromText(afterNik, AGAMA_MAP);
  }

  // ============================================================
  // 5. PENDIDIKAN — cari label atau fallback
  // ============================================================
  const pendLabelMatch = afterNik.match(/PENDIDIKAN\s*[:\s]*([A-Z0-9\s\/\-]+?)(?=\s+(?:PEKERJAAN|STATUS|HUB|KEWARGA|WNI|WNA|$|\d{2}[-/.]))/i);
  if (pendLabelMatch) {
    member.pendidikan = mapValue(pendLabelMatch[1].trim().toUpperCase().replace(/[-\s]+/g, ' '), PENDIDIKAN_MAP);
    markConsumed(afterNik, pendLabelMatch.index!, pendLabelMatch[0].length, consumedRanges);
  }
  if (!member.pendidikan) {
    member.pendidikan = mapValueFromText(afterNik, PENDIDIKAN_MAP);
  }

  // ============================================================
  // 6. PEKERJAAN — cari label atau fallback
  // ============================================================
  const pkrjLabelMatch = afterNik.match(/PEKERJAAN\s*[:\s]*([A-Z\s\/\-]+?)(?=\s+(?:STATUS|HUB|KEWARGA|WNI|WNA|$|\d{2}[-/.]))/i);
  if (pkrjLabelMatch) {
    member.pekerjaan = mapValue(pkrjLabelMatch[1].trim().toUpperCase(), PEKERJAAN_MAP);
    markConsumed(afterNik, pkrjLabelMatch.index!, pkrjLabelMatch[0].length, consumedRanges);
  }
  if (!member.pekerjaan) {
    member.pekerjaan = mapValueFromText(afterNik, PEKERJAAN_MAP);
  }

  // ============================================================
  // 7. STATUS PERKAWINAN — cari label atau fallback
  // ============================================================
  // Label: "STATUS PERKAWINAN" → stop di "STATUS HUB" atau end
  const skMatch = afterNik.match(/STATUS\s*(?:PERKAWINAN)?\s*[:\s]*(?:KAWIN|BELUM\s*MENIKAH|CERAI\s*HIDUP|CERAI\s*MATI|BELUM\s*KAWIN|KAWIN\s*TERCATAT|KAWIN\s*BELUM\s*TERCATAT)/i);
  if (skMatch) {
    member.statusPerkawinan = mapValue(skMatch[0].replace(/^STATUS\s*(?:PERKAWINAN)?\s*[:\s]*/i, '').toUpperCase(), STATUS_KAWIN_MAP);
    markConsumed(afterNik, skMatch.index!, skMatch[0].length, consumedRanges);
  }
  if (!member.statusPerkawinan) {
    member.statusPerkawinan = mapValueFromText(afterNik, STATUS_KAWIN_MAP);
  }

  // ============================================================
  // 8. STATUS KELUARGA — cari label atau fallback
  // ============================================================
  const sklMatch = afterNik.match(/(?:STATUS\s*HUB(?:UNGAN)?\s*(?:DALAM)?\s*KELUARGA|HUB(?:UNGAN)?\s*(?:DALAM)?\s*KELUARGA)\s*[:\s]*(KEPALA\s*KELUARGA|ISTRI|ANAK|MERTUA|MENANTU|CUCU|LAINNYA)/i);
  if (sklMatch) {
    member.statusKeluarga = sklMatch[1].toUpperCase().replace(/\s+/g, ' ');
    markConsumed(afterNik, sklMatch.index!, sklMatch[0].length, consumedRanges);
  }
  if (!member.statusKeluarga) {
    if (/KEPALA\s*KELUARGA/i.test(afterNik)) member.statusKeluarga = 'KEPALA KELUARGA';
    else if (/\bMENANTU\b/i.test(afterNik)) member.statusKeluarga = 'MENANTU';
    else if (/\bMERTUA\b/i.test(afterNik)) member.statusKeluarga = 'MERTUA';
    else if (/\bCUCU\b/i.test(afterNik)) member.statusKeluarga = 'CUCU';
    else if (/\bISTRI\b/i.test(afterNik)) member.statusKeluarga = 'ISTRI';
    else if (/\bANAK\b/i.test(afterNik)) member.statusKeluarga = 'ANAK';
  }

  // ============================================================
  // 9. KEWARGANEGARAAN
  // ============================================================
  member.kewarganegaraan = /\bWNA\b/i.test(afterNik) ? 'WNA' : 'WNI';

  // ============================================================
  // 10. NAMA — jika belum ketemu dari label, extract dari sisa teks
  // ============================================================
  if (!member.namaLengkap) {
    member.namaLengkap = extractNameFromRemaining(afterNik, consumedRanges);
  }

  // Fallback: ambil kata kapital pertama yang bukan stop word
  if (!member.namaLengkap || member.namaLengkap.length < 2) {
    const words = afterNik.split(/\s+/);
    for (const w of words.slice(0, 5)) {
      const u = w.toUpperCase();
      if (/^[A-Z][A-Z.'\-]+$/.test(u) && u.length >= 3 && !NAME_STOP_WORDS.has(u)) {
        member.namaLengkap = u;
        break;
      }
    }
  }

  if (!member.namaLengkap || member.namaLengkap.length < 2) return null;

  console.log(`[parseKK] NIK ${nik}: nama="${member.namaLengkap}", JK=${member.jenisKelamin}, TTL=${member.tempatLahir} ${member.tanggalLahir}, agama=${member.agama}, pend=${member.pendidikan}, pkrj=${member.pekerjaan}, kawin=${member.statusPerkawinan}, status=${member.statusKeluarga}, WN=${member.kewarganegaraan}`);

  return member;
}

// ============================================================
// Helper: Extract nama dari sisa teks yang belum di-consume
// ============================================================
function extractNameFromRemaining(text: string, consumed: [number, number][]): string {
  // Hapus semua consumed ranges dari text
  let remaining = text;
  // Sort consumed ranges in reverse order
  const sorted = [...consumed].sort((a, b) => b[0] - a[0]);
  for (const [start, end] of sorted) {
    remaining = remaining.substring(0, start) + ' ' + remaining.substring(start + end);
  }

  // Hapus tanggal, angka, karakter non-huruf
  remaining = remaining.replace(/\d{2}[-/.]\d{2}[-/.]\d{4}/g, ' ');
  remaining = remaining.replace(/\b\d{1,4}\b/g, ' ');
  remaining = remaining.replace(/[^A-Za-z\s.'\-]/g, ' ');

  // Hapus semua keyword yang sudah dikenali
  const allKeywords = [
    'LAKI-LAKI', 'LAKI LAKI', 'LAKILAKI', 'PEREMPUAN',
    'ISLAM', 'KRISTEN', 'BUDHA', 'HINDU', 'KONGHUCU', 'KATOLIK',
    'TIDAK', 'BELUM', 'SEKOLAH', 'TAMAT', 'SD', 'SEDERAJAT', 'SMP', 'SMA',
    'PAKET', 'SLB', 'D1', 'D2', 'D3', 'S1', 'S2', 'S3',
    'DIPLOMA', 'SARJANA', 'PASCA',
    'PELAJAR', 'MAHASISWA', 'PNS', 'SOPIR', 'PEDAGANG', 'BURUH', 'HARIAN', 'LEPAS',
    'WIRASWASTA', 'WIRASWASTI', 'PEGAWAI', 'ASN', 'KARYAWAN', 'SWASTA',
    'TNI', 'POLRI', 'PETANI', 'PEKEBUN', 'USTADZ', 'MUBALIGH',
    'MENGURUS', 'RUMAH', 'TANGGA', 'BEKERJA', 'NEGERI',
    'KAWIN', 'CERAI', 'MENIKAH', 'HIDUP', 'MATI', 'TERCATAT',
    'WNI', 'WNA',
    'KEPALA', 'KELUARGA', 'ISTRI', 'ANAK', 'MERTUA', 'MENANTU', 'CUCU',
    'AGAMA', 'PENDIDIKAN', 'PEKERJAAN', 'STATUS', 'PERKAWINAN',
    'HUBUNGAN', 'DALAM', 'KEWARGANEGARAAN', 'JENIS', 'KELAMIN',
    'NAMA', 'NIK', 'NO', 'TEMPAT', 'TANGGAL', 'LAHIR', 'TTL',
    'RT', 'RW', 'ALAMAT', 'DESA', 'KEL', 'KEC',
  ];
  for (const kw of allKeywords) {
    const regex = new RegExp(`\\b${esc(kw)}\\b`, 'gi');
    remaining = remaining.replace(regex, ' ');
  }

  // Ambil kata yang tersisa — harus huruf, min 2 char, bukan stop word
  const words = remaining.split(/\s+/).filter(w => w.length >= 2);
  const nameWords: string[] = [];
  for (const w of words) {
    const u = w.toUpperCase();
    if (/^[A-Z][A-Z.'\-]+$/.test(u) && !NAME_STOP_WORDS.has(u)) {
      nameWords.push(u);
    }
  }

  return nameWords.join(' ').trim();
}

// ============================================================
// Helper: Mark range as consumed (for tracking which text is parsed)
// ============================================================
function markConsumed(text: string, start: number, length: number, ranges: [number, number][]) {
  if (start >= 0 && length > 0) {
    ranges.push([start, Math.min(length, text.length - start)]);
  }
}

// ============================================================
// Helper: Map raw text ke valid value menggunakan mapping table
// ============================================================
function mapValue(raw: string, map: Record<string, string>): string {
  // Cek exact match dulu
  if (map[raw]) return map[raw];

  // Cek uppercase normalized
  const upper = raw.toUpperCase().replace(/\s+/g, ' ').trim();
  if (map[upper]) return map[upper];

  // Cek tanpa spasi/strip
  const stripped = upper.replace(/[\s\/\-]+/g, '');
  for (const [key, val] of Object.entries(map)) {
    if (key.replace(/[\s\/\-]+/g, '') === stripped) return val;
  }

  // Cek substring — apakah raw mengandung key atau sebaliknya
  for (const [key, val] of Object.entries(map)) {
    if (upper.includes(key) || key.includes(upper)) return val;
    // Jika raw mengandung keyword utama (misal "SEDERAJAT" dalam "SMA/SEDERAJAT")
    const keywords = key.split(/[\s\/]+/).filter(k => k.length >= 3);
    for (const kw of keywords) {
      if (upper.includes(kw)) return val;
    }
  }

  return '';
}

// ============================================================
// Helper: Cari value dari teks menggunakan mapping table (fallback)
// ============================================================
function mapValueFromText(text: string, map: Record<string, string>): string {
  const upper = text.toUpperCase();

  // Cek dari yang terpanjang dulu (biar spesifik match dulu)
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  for (const [key, val] of entries) {
    const keyEsc = esc(key);
    if (new RegExp(`\\b${keyEsc}\\b`, 'i').test(upper)) {
      return val;
    }
  }

  // Cek keyword-based
  let bestMatch = '';
  let bestScore = 0;
  for (const [key, val] of entries) {
    const keywords = key.split(/[\s\/]+/).filter(k => k.length >= 3);
    if (keywords.length === 0) continue;
    let matchCount = 0;
    for (const kw of keywords) {
      if (new RegExp(esc(kw), 'i').test(upper)) matchCount++;
    }
    const score = matchCount / keywords.length;
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = val;
    }
  }

  return bestMatch;
}
