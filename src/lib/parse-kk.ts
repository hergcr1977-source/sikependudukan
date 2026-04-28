// ============================================================
// parse-kk.ts — Parser OCR Kartu Keluarga (client-side)
// Menggunakan sequential column parsing: setelah NIK, field
// di-parse berurutan sesuai urutan kolom di KK asli.
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
const STATUS_KELUARGA_VALUES = ['KEPALA KELUARGA', 'ISTRI', 'ANAK', 'MERTUA', 'MENANTU', 'CUCU', 'LAINNYA'];

// ============================================================
// Keyword yang menandakan akhir dari nama (bukan bagian nama)
// ============================================================
const NAME_STOP_WORDS = new Set([
  'LAKI-LAKI', 'LAKI', 'PEREMPUAN', 'P',
  'ISLAM', 'KRISTEN', 'BUDHA', 'HINDU', 'KONGHUCU', 'KATOLIK',
  'SMA', 'SMP', 'SD', 'SLTA', 'SLTP', 'SEDERAJAT', 'SLB',
  'PELAJAR', 'MAHASISWA', 'PNS', 'SOPIR', 'PEDAGANG', 'BURUH',
  'WIRASWASTA', 'PEGAWAI', 'KARYAWAN', 'TNI', 'POLRI', 'PETANI',
  'MENGURUS', 'RUMAH', 'TANGGA', 'BELUM', 'TIDAK', 'BEKERJA',
  'KAWIN', 'CERAI', 'MENIKAH', 'WNI', 'WNA',
  'KEPALA', 'ISTRI', 'ANAK', 'MERTUA', 'MENANTU', 'CUCU',
  'D1', 'D2', 'D3', 'S1', 'S2', 'S3',
  'PAKET', 'DIPLOMA', 'SARJANA', 'PASCA',
  'USTADZ', 'MUBALIGH', 'NEGERI', 'ASN', 'HARIAN', 'LEPAS',
  'PEKEBUN', 'KETENAGAKERJAAN',
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

  // 6. Cari anggota keluarga (sequential parsing)
  result.anggota = extractAllMembers(text, lines);

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
    if (m && m[1] && m[1].length > 3) return m[1].trim();
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
    // Pattern: "NAMA AYAH : JOKO" atau "NAMA AYAH JOKO"
    if (!ayah) {
      const mAyah = line.match(/NAMA\s*AYAH\s*[:\s\-]*\[?\s*([A-Z][A-Z\s.'\-]{2,40})\s*\]?/i);
      if (mAyah && mAyah[1].trim().length > 2) {
        ayah = mAyah[1].trim();
        // Bersihkan dari suffix yang bukan nama
        ayah = cleanName(ayah);
      }
    }

    if (!ibu) {
      const mIbu = line.match(/NAMA\s*IBU\s*[:\s\-]*\[?\s*([A-Z][A-Z\s.'\-]{2,40})\s*\]?/i);
      if (mIbu && mIbu[1].trim().length > 2) {
        ibu = mIbu[1].trim();
        ibu = cleanName(ibu);
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
  // Hapus suffix setelah keyword yang jelas bukan nama
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
// Helper: Cari semua anggota keluarga — Sequential Parsing
// ============================================================
function extractAllMembers(fullText: string, lines: string[]): KKMember[] {
  const normalized = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const normalizedNoSpaces = normalized.replace(/(\d)\s+(\d)/g, '$1$2');

  const members: KKMember[] = [];
  const usedNiks = new Set<string>();

  // Cari semua NIK (16 digit)
  const nikMatches: { nik: string; startIdx: number }[] = [];
  const nikRegex = /\b(\d{16})\b/g;
  let match;
  while ((match = nikRegex.exec(normalizedNoSpaces)) !== null) {
    nikMatches.push({ nik: match[1], startIdx: match.index });
  }

  if (nikMatches.length === 0) return members;

  // Untuk setiap NIK, ambil teks DARI NIK tersebut SAMPAI NIK berikutnya
  // Ini memastikan tidak ada kontaminasi data antar anggota
  for (let i = 0; i < nikMatches.length; i++) {
    const nikInfo = nikMatches[i];
    if (usedNiks.has(nikInfo.nik)) continue;

    // Batas akhir: awal NIK berikutnya, atau end of text
    const nextNikStart = (i + 1 < nikMatches.length) ? nikMatches[i + 1].startIdx : normalizedNoSpaces.length;

    // Ambil teks dari NIK ini sampai NIK berikutnya
    const segment = normalizedNoSpaces.substring(nikInfo.startIdx, nextNikStart);

    const member = parseMemberSequential(segment, nikInfo.nik);
    if (member && member.namaLengkap) {
      members.push(member);
      usedNiks.add(nikInfo.nik);
    }
  }

  return members;
}

// ============================================================
// Parser per-anggota: Sequential parsing dari segment teks
// Setelah NIK, field di-parse berurutan sesuai kolom KK:
// NIK → Nama → JK → Tempat Lahir → Tgl Lahir → Agama →
// Pendidikan → Pekerjaan → Status Kawin → Status Keluarga → WN
// ============================================================
function parseMemberSequential(segment: string, nik: string): KKMember | null {
  const text = segment.replace(/\s+/g, ' ').trim();

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

  // Cari posisi NIK dalam segment
  const nikIdx = text.indexOf(nik);
  if (nikIdx < 0) return null;

  // Teks setelah NIK — ini berisi semua field anggota
  const afterNik = text.substring(nikIdx + nik.length).trim();

  // ========================================
  // 1. Extract Nama (teks kapital setelah NIK)
  // Berhenti di keyword yang bukan nama
  // ========================================
  const words = afterNik.split(/\s+/);
  let nameWords: string[] = [];
  let nameEnded = false;

  for (const word of words) {
    if (nameEnded) break;

    // Skip angka (nomor urut, tanggal, dll)
    if (/^\d+$/.test(word)) { nameEnded = true; continue; }

    // Cek apakah ini tanggal (DD-MM-YYYY)
    if (/^\d{2}[\-\/\.]\d{2}[\-\/\.]\d{2,4}$/.test(word)) { nameEnded = true; continue; }

    // Cek apakah ini tanggal parsial (DD-MM)
    if (/^\d{2}[\-\/\.]\d{2}$/.test(word)) { nameEnded = true; continue; }

    // Cek apakah ini stop word (keyword field lain)
    const upper = word.toUpperCase();
    if (NAME_STOP_WORDS.has(upper)) { nameEnded = true; continue; }

    // Cek apakah ini nama (huruf kapital, bisa mengandung titik/tanda hubung)
    if (/^[A-Z][A-Z.'\-]+$/.test(upper) && upper.length >= 2) {
      nameWords.push(upper);
    } else if (/^[A-Z][a-z]+$/.test(word) && word.length >= 3) {
      // Nama yang kapital hanya di huruf pertama (jarang terjadi di KK)
      nameWords.push(word.toUpperCase());
    } else {
      // Karakter tidak dikenali — berhenti
      nameEnded = true;
    }
  }

  member.namaLengkap = nameWords.join(' ').trim();

  // Jika nama kurang dari 2 karakter, coba ambil 1-2 kata pertama yang kapital
  if (member.namaLengkap.length < 2) {
    for (const w of words.slice(0, 3)) {
      if (/^[A-Z][A-Z.'\-]+$/.test(w) && w.length >= 3 && !NAME_STOP_WORDS.has(w)) {
        member.namaLengkap = w;
        break;
      }
    }
  }

  if (!member.namaLengkap || member.namaLengkap.length < 2) return null;

  // ========================================
  // 2. Jenis Kelamin
  // ========================================
  if (/LAKI[\s\-]*LAKI|LAKILAKI/i.test(afterNik)) {
    member.jenisKelamin = 'LAKI-LAKI';
  } else if (/\bPEREMPUAN\b/i.test(afterNik)) {
    member.jenisKelamin = 'PEREMPUAN';
  }

  // ========================================
  // 3. Tanggal Lahir — DD-MM-YYYY atau DD/MM/YYYY
  // ========================================
  const datePatterns = [
    /(\d{2})\s*[\-\/\.]\s*(\d{2})\s*[\-\/\.]\s*(\d{4})/,
  ];
  for (const pat of datePatterns) {
    const dm = afterNik.match(pat);
    if (dm) {
      const d = dm[1], m = dm[2], y = dm[3];
      const dd = parseInt(d), mm = parseInt(m), yy = parseInt(y);
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2025) {
        member.tanggalLahir = `${y}-${m}-${d}`;
        break;
      }
    }
  }

  // ========================================
  // 4. Tempat Lahir — kata kota SEBELUM tanggal lahir
  // ========================================
  if (member.tanggalLahir) {
    const dateRegex = /\d{2}\s*[\-\/\.]\s*\d{2}\s*[\-\/\.]\s*\d{4}/;
    const dateIdx = afterNik.search(dateRegex);
    if (dateIdx > 0) {
      // Ambil teks sebelum tanggal, cari kata terakhir yang mirip nama kota
      const beforeDate = afterNik.substring(0, dateIdx).trim();
      const beforeWords = beforeDate.split(/\s+/);

      // Cari dari belakang — skip JK keywords
      for (let i = beforeWords.length - 1; i >= 0; i--) {
        const w = beforeWords[i].toUpperCase();
        if (w.length >= 2 && w.length <= 20 && /^[A-Z]+$/.test(w)) {
          if (NAME_STOP_WORDS.has(w)) continue;
          if (/^(LAKI|PEREMP|KEPALA|ISTRI|ANAK|KAWIN|ISLAM|KRISTEN|BUDHA|HINDU|SMA|SD|SMP|SLTA|SLTP|SEDERAJAT|PELAJAR|BURUH|PEDAGANG|WIRASWASTA|PNS|PEGAWAI|BELUM|SUDAH|CERAI|MENIKAH|WNI|WNA|MENGURUS|RUMAH|TANGGA|SOPIR|USTADZ|MUBALIGH|NEGERI|ASN|HARIAN|LEPAS|PEKEBUN|D1|D2|D3|S1|S2|S3)$/i.test(w)) continue;
          member.tempatLahir = w;
          break;
        }
      }
    }
  }

  // ========================================
  // 5. Agama
  // ========================================
  for (const agama of AGAMA_VALUES) {
    const agamaClean = agama.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${agamaClean}\\b`, 'i').test(afterNik)) {
      member.agama = agama;
      break;
    }
  }

  // ========================================
  // 6. Pendidikan — fuzzy match
  // ========================================
  member.pendidikan = fuzzyMatchList(afterNik, PENDIDIKAN_VALUES);

  // ========================================
  // 7. Pekerjaan — fuzzy match
  // ========================================
  member.pekerjaan = fuzzyMatchList(afterNik, PEKERJAAN_VALUES);

  // ========================================
  // 8. Status Perkawinan
  // ========================================
  if (/KAWIN\s*(BELUM|TIDAK)\s*(TERCATAT)?/i.test(afterNik)) {
    member.statusPerkawinan = 'KAWIN';
  } else if (/KAWIN\s*TERCATAT/i.test(afterNik)) {
    member.statusPerkawinan = 'KAWIN';
  } else {
    member.statusPerkawinan = fuzzyMatchList(afterNik, STATUS_KAWIN_VALUES);
  }

  // ========================================
  // 9. Status Keluarga
  // ========================================
  if (/KEPALA\s*KELUARGA/i.test(afterNik)) member.statusKeluarga = 'KEPALA KELUARGA';
  else if (/MENANTU/i.test(afterNik)) member.statusKeluarga = 'MENANTU';
  else if (/MERTUA/i.test(afterNik)) member.statusKeluarga = 'MERTUA';
  else if (/CUCU/i.test(afterNik)) member.statusKeluarga = 'CUCU';
  else if (/\bISTRI\b/i.test(afterNik)) member.statusKeluarga = 'ISTRI';
  else if (/\bANAK\b/i.test(afterNik)) member.statusKeluarga = 'ANAK';

  // ========================================
  // 10. Kewarganegaraan
  // ========================================
  member.kewarganegaraan = /\bWNA\b/i.test(afterNik) ? 'WNA' : 'WNI';

  // ========================================
  // 11. Nama Ayah & Ibu (dalam segment anggota)
  // Beberapa KK format lama menaruh nama ayah/ibu per anggota
  // ========================================
  const mAyah = afterNik.match(/NAMA\s*AYAH\s*[:\s\-]*\[?\s*([A-Z][A-Z\s.'\-]{2,30})\s*\]?/i);
  if (mAyah) member.namaAyah = cleanName(mAyah[1].trim());

  const mIbu = afterNik.match(/NAMA\s*IBU\s*[:\s\-]*\[?\s*([A-Z][A-Z\s.'\-]{2,30})\s*\]?/i);
  if (mIbu) member.namaIbu = cleanName(mIbu[1].trim());

  return member;
}

// ============================================================
// Helper: Fuzzy match — cocokkan teks dengan daftar nilai
// ============================================================
function fuzzyMatchList(text: string, values: string[]): string {
  let bestMatch = '';
  let bestScore = 0;

  for (const val of values) {
    const valRegex = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Exact match (paling tinggi skor)
    if (new RegExp(`\\b${valRegex}\\b`, 'i').test(text)) {
      return val;
    }

    // Substring match berdasarkan keyword
    if (valRegex.length >= 3) {
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
