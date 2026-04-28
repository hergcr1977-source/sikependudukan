import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (isAuthError(session)) return session;

  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Teks diperlukan' }, { status: 400 });
    }

    const result = parseKKText(text);

    if (!result || !result.noKK) {
      return NextResponse.json({ error: 'Gagal mengenali format Kartu Keluarga. Pastikan foto KK jelas.', raw: text.substring(0, 500) }, { status: 422 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Parse KK] Error:', error);
    return NextResponse.json({ error: 'Gagal memproses teks KK', detail: error.message }, { status: 500 });
  }
}

function parseKKText(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const result: any = {
    noKK: '',
    alamat: '',
    rt: '',
    rw: '',
    desa: '',
    kecamatan: '',
    kabupaten: '',
    provinsi: '',
    anggota: [],
  };

  // --- Parse No. KK ---
  const kkPatterns = [
    /NO\s*\.?\s*KK\s*[:\s]*\[?(\d{16})\]?/i,
    /N0\s*\.?\s*KK\s*[:\s]*\[?(\d{16})\]?/i,
    /(\d{16})/,
  ];
  for (const pat of kkPatterns) {
    const m = text.match(pat);
    if (m) { result.noKK = m[1].replace(/\D/g, ''); break; }
  }

  // --- Parse Alamat & RT/RW ---
  const alamatIdx = findLineIndex(lines, [/alamat/i, /ALAMAT/i]);
  if (alamatIdx >= 0 && alamatIdx + 1 < lines.length) {
    result.alamat = lines[alamatIdx + 1];
    // Cek RT/RW di baris setelah alamat
    const rtRwLine = lines[alamatIdx + 2] || '';
    const rtRwMatch = rtRwLine.match(/(\d{3})\s*[\/\\]\s*(\d{3})/);
    if (rtRwMatch) {
      result.rt = rtRwMatch[1];
      result.rw = rtRwMatch[2];
    }
  }

  // --- Parse Kelurahan/Desa ---
  const kelIdx = findLineIndex(lines, [/KEL[\s.\/\\]+DES/i, /KELURAHAN/i, /DESA/i]);
  if (kelIdx >= 0 && kelIdx + 1 < lines.length) {
    result.desa = lines[kelIdx + 1];
  }

  // --- Parse Kecamatan ---
  const kecIdx = findLineIndex(lines, [/KEC[\s.\/\\]+/i, /KECAMATAN/i]);
  if (kecIdx >= 0 && kecIdx + 1 < lines.length) {
    result.kecamatan = lines[kecIdx + 1];
  }

  // --- Parse Kabupaten/Kota ---
  const kabIdx = findLineIndex(lines, [/KAB[\s.\/\\]+/i, /KABUPATEN/i, /KOTA/i]);
  if (kabIdx >= 0 && kabIdx + 1 < lines.length) {
    result.kabupaten = lines[kabIdx + 1];
  }

  // --- Parse Provinsi ---
  const provIdx = findLineIndex(lines, [/PROV[\s.\/\\]+/i, /PROVINSI/i]);
  if (provIdx >= 0 && provIdx + 1 < lines.length) {
    result.provinsi = lines[provIdx + 1];
  }

  // --- Parse anggota keluarga ---
  // Cari header tabel anggota
  const headerPatterns = [/NIK/i, /^NO$/];
  let tableStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerPatterns.some(p => p.test(lines[i]))) {
      tableStart = i + 1;
      break;
    }
  }

  if (tableStart >= 0) {
    // Parse setiap baris anggota (tab-separated)
    for (let i = tableStart; i < lines.length; i++) {
      const line = lines[i];
      // Lewati baris yang bukan data anggota (terlalu pendek atau header)
      if (line.length < 16) continue;
      // Cek apakah baris ini mengandung NIK (16 digit)
      const nikMatch = line.match(/(\d{16})/);
      if (!nikMatch) continue;

      const nik = nikMatch[1];
      const anggota = parseAnggotaLine(line, nik);
      if (anggota) result.anggota.push(anggota);
    }
  }

  // Fallback: jika tidak ketemu tabel, coba parse baris demi baris
  if (result.anggota.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const nikMatch = lines[i].match(/(\d{16})/);
      if (nikMatch) {
        const nik = nikMatch[1];
        // Skip NIK yang sama dengan No KK
        if (nik === result.noKK) continue;
        const anggota = parseAnggotaLine(lines[i], nik);
        if (anggota) result.anggota.push(anggota);
      }
    }
  }

  return result;
}

function parseAnggotaLine(line: string, nik: string) {
  // Split line by tab, multiple spaces, or pipe
  const parts = line.split(/[\t|]+/).map(s => s.trim()).filter(s => s.length > 0);

  // Jika hanya 1 part (tab-separated tidak jelas), coba split by multiple spaces
  let fields = parts;
  if (parts.length < 3) {
    fields = line.split(/\s{2,}/).map(s => s.trim()).filter(s => s.length > 0);
  }

  // Cari nama (biasanya berada setelah atau sebelum NIK, huruf kapital)
  let nama = '';
  for (const f of fields) {
    if (/^[A-Z\s.'\-]+$/.test(f) && f.length > 3 && f.length < 50 && !/^\d+$/.test(f)) {
      nama = f;
      break;
    }
  }

  // Cari tanggal lahir (format DD-MM-YYYY atau DD/MM/YYYY atau YYYY-MM-DD)
  let tanggalLahir = '';
  for (const f of fields) {
    const tglMatch = f.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (tglMatch) {
      const d = tglMatch[1], m = tglMatch[2], y = tglMatch[3];
      tanggalLahir = `${y}-${m}-${d}`;
      break;
    }
    // Format YYYY-MM-DD
    const tglMatch2 = f.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (tglMatch2) {
      tanggalLahir = f;
      break;
    }
  }

  // Cari jenis kelamin
  let jenisKelamin = '';
  if (/LAKI/i.test(line)) jenisKelamin = 'LAKI-LAKI';
  else if (/PEREMPUAN/i.test(line)) jenisKelamin = 'PEREMPUAN';
  else if (/\bL\b/.test(line)) jenisKelamin = 'LAKI-LAKI';
  else if (/\bP\b/.test(line)) jenisKelamin = 'PEREMPUAN';

  // Cari tempat lahir (kota sebelum tanggal lahir)
  let tempatLahir = '';
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.length > 2 && f.length < 20 && /^[A-Z\s]+$/.test(f) && !/KELUARGA|ISTRI|ANAK|KEPALA|LAKI|PEREMPUAN|KAWIN|BELUM|ISLAM|KRISTEN|KATOLIK|HINDU|BUDDHA/i.test(f)) {
      // Cek apakah baris berikutnya ada tanggal
      if (i + 1 < fields.length && /\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(fields[i + 1])) {
        tempatLahir = f;
        break;
      }
    }
  }

  // Cari agama
  let agama = '';
  if (/ISLAM/i.test(line)) agama = 'ISLAM';
  else if (/KRISTEN/i.test(line)) agama = 'KRISTEN';
  else if (/KATOLIK/i.test(line)) agama = 'KATOLIK';
  else if (/HINDU/i.test(line)) agama = 'HINDU';
  else if (/BUDDHA/i.test(line)) agama = 'BUDDHA';
  else if (/KONGHUCU/i.test(line)) agama = 'KONGHUCU';

  // Cari pendidikan
  let pendidikan = '';
  if (/SD\/SEDERAJAT|SEKOLAH DASAR/i.test(line)) pendidikan = 'TAMAT SD/SEDERAJAT';
  else if (/SLTP\/SEDERAJAT|SMP/i.test(line)) pendidikan = 'SLTP/SEDERAJAT';
  else if (/SLTA\/SEDERAJAT|SMA/i.test(line)) pendidikan = 'SLTA/SEDERAJAT';
  else if (/DIPLOMA|D1|D2|D3/i.test(line)) pendidikan = 'DIPLOMA I/II/III';
  else if (/SARJANA|S1/i.test(line)) pendidikan = 'SARJANA';
  else if (/PASCA/i.test(line)) pendidikan = 'PASCA SARJANA';

  // Cari status perkawinan
  let statusPerkawinan = '';
  if (/KAWIN BELUM TERCATAT|KAWIN TIDAK TERCATAT/i.test(line)) statusPerkawinan = 'KAWIN';
  else if (/KAWIN TERCATAT/i.test(line)) statusPerkawinan = 'KAWIN';
  else if (/BELUM KAWIN/i.test(line)) statusPerkawinan = 'BELUM KAWIN';
  else if (/CERAI HIDUP/i.test(line)) statusPerkawinan = 'CERAI HIDUP';
  else if (/CERAI MATI/i.test(line)) statusPerkawinan = 'CERAI MATI';

  // Cari pekerjaan
  let pekerjaan = '';
  if (/BURUH HARIAN/i.test(line)) pekerjaan = 'BURUH HARIAN LEPAS';
  else if (/PETANI/i.test(line)) pekerjaan = 'PETANI/PEKEBUN';
  else if (/PEDAGANG/i.test(line)) pekerjaan = 'PEDAGANG';
  else if (/PEGAWAI|PNS/i.test(line)) pekerjaan = 'PEGAWAI NEGERI';
  else if (/WIRASWASTA/i.test(line)) pekerjaan = 'WIRASWASTA';
  else if (/PELAJAR|MAHASISWA/i.test(line)) pekerjaan = 'PELAJAR/MAHASISWA';
  else if (/RUMAH TANGGA/i.test(line)) pekerjaan = 'MENGURUS RUMAH TANGGA';

  // Cari status dalam keluarga
  let statusKeluarga = '';
  if (/KEPALA KELUARGA/i.test(line)) statusKeluarga = 'KEPALA KELUARGA';
  else if (/ISTRI/i.test(line)) statusKeluarga = 'ISTRI';
  else if (/ANAK/i.test(line)) statusKeluarga = 'ANAK';
  else if (/ORANG TUA/i.test(line)) statusKeluarga = 'ORANG TUA';
  else if (/MERTUA/i.test(line)) statusKeluarga = 'MERTUA';
  else if (/MENANTU/i.test(line)) statusKeluarga = 'MENANTU';
  else if (/CUCU/i.test(line)) statusKeluarga = 'CUCU';

  // Cari kewarganegaraan
  const kewarganegaraan = /WNA/i.test(line) ? 'WNA' : 'WNI';

  if (!nik || !nama) return null;

  return {
    nik,
    namaLengkap: nama,
    jenisKelamin,
    tempatLahir,
    tanggalLahir,
    agama,
    pendidikan,
    pekerjaan,
    statusPerkawinan,
    statusKeluarga,
    kewarganegaraan,
  };
}

function findLineIndex(lines: string[], patterns: RegExp[]): number {
  for (let i = 0; i < lines.length; i++) {
    for (const p of patterns) {
      if (p.test(lines[i])) return i;
    }
  }
  return -1;
}
