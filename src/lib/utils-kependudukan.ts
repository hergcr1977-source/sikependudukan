import { differenceInMonths, differenceInYears, parseISO, format } from 'date-fns';

export function hitungUmur(tanggalLahir: string | Date, refDate?: Date) {
  const birth = typeof tanggalLahir === 'string' ? parseISO(tanggalLahir) : tanggalLahir;
  const ref = refDate || new Date();
  const months = differenceInMonths(ref, birth);
  
  if (months < 1) return { umurTahun: 0, umurBulan: 0, label: '0-11 BLN', isBayi: true };
  if (months < 12) return { umurTahun: 0, umurBulan: months, label: '0-11 BLN', isBayi: true };
  
  const years = differenceInYears(ref, birth);
  return { umurTahun: years, umurBulan: 0, label: String(years), isBayi: false };
}

export function isWajibKTP(tanggalLahir: string | Date, refDate?: Date, punyaKTP?: string | null): boolean {
  const birth = typeof tanggalLahir === 'string' ? parseISO(tanggalLahir) : tanggalLahir;
  const ref = refDate || new Date();
  const years = differenceInYears(ref, birth);
  // Wajib KTP: penduduk yang berusia tepat 17 tahun (baru masuk 17, belum 18)
  // Jika sudah punya KTP (PUNYA), tidak termasuk wajib KTP
  if (years !== 17) return false;
  if (punyaKTP === 'PUNYA') return false;
  return true;
}

export function formatTanggal(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd-MM-yyyy');
}

// Deteksi tanggal lahir yang bermasalah (epoch 1970 atau sebelum 01-01-1930)
export function isTanggalLahirInvalid(tanggalLahir: string | Date): boolean {
  const d = typeof tanggalLahir === 'string' ? parseISO(tanggalLahir) : tanggalLahir;
  // Tanggal 1970-01-01 = epoch error (data kosong)
  if (d.getFullYear() === 1970 && d.getMonth() === 0 && d.getDate() === 1) return true;
  // Tanggal sebelum 01-01-1930 tidak valid
  const minDate = new Date(1930, 0, 1);
  if (d < minDate) return true;
  return false;
}

export function validateNIK(nik: string): boolean {
  return /^\d{16}$/.test(nik);
}

export function validateNoKK(nkk: string): boolean {
  return /^\d{16}$/.test(nkk);
}

export function toUpperCase(str: string): string {
  return str.toUpperCase().trim();
}
