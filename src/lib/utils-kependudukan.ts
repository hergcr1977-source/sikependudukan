import { differenceInMonths, differenceInYears, parseISO } from 'date-fns';

export function hitungUmur(tanggalLahir: string | Date, refDate?: Date) {
  const birth = typeof tanggalLahir === 'string' ? parseISO(tanggalLahir) : tanggalLahir;
  const ref = refDate || new Date();
  const months = differenceInMonths(ref, birth);
  
  if (months < 1) return { umurTahun: 0, umurBulan: 0, label: '0-11 BLN', isBayi: true };
  if (months < 12) return { umurTahun: 0, umurBulan: months, label: '0-11 BLN', isBayi: true };
  
  const years = differenceInYears(ref, birth);
  return { umurTahun: years, umurBulan: 0, label: String(years), isBayi: false };
}

export function isWajibKTP(tanggalLahir: string | Date, refDate?: Date): boolean {
  const birth = typeof tanggalLahir === 'string' ? parseISO(tanggalLahir) : tanggalLahir;
  const ref = refDate || new Date();
  const years = differenceInYears(ref, birth);
  // Hanya yang tepat berusia 17 tahun (baru masuk 17 tahun, belum 18)
  return years === 17;
}

export function formatTanggal(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
