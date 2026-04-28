'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, FileUp, FileDown, Pencil, Trash2, ChevronDown, ChevronRight, ChevronUp, Users, X, Filter, SlidersHorizontal, Printer, Camera, Loader2, RotateCw, RotateCcw, FlipHorizontal, FlipVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
  AGAMA, PENDIDIKAN, PEKERJAAN, STATUS_PERKAWINAN, BANTUAN_OPTIONS,
  BPJS_OPTIONS,
  ALAMAT_DEFAULT, RT_DEFAULT, RW_DEFAULT, KELURAHAN_DEFAULT,
  KECAMATAN_DEFAULT, KABUPATEN_DEFAULT, PROVINSI_DEFAULT,
  STATUS_KTP, STATUS_KELUARGA, JENIS_KELAMIN,
} from '@/lib/constants';
import { hitungUmur, isWajibKTP, formatTanggal, validateNIK, validateNoKK } from '@/lib/utils-kependudukan';
import { apiFetch } from '@/lib/api';
import * as XLSX from 'xlsx';
import { preprocessImageForOCR, parseKKFromOCR } from '@/lib/parse-kk';

interface Penduduk {
  id: number;
  noKK: string;
  nik: string;
  namaLengkap: string;
  jenisKelamin: string;
  statusKeluarga: string;
  tempatLahir: string;
  tanggalLahir: string;
  agama: string;
  pendidikan: string;
  pekerjaan: string;
  statusPerkawinan: string;
  kewarganegaraan: string;
  namaAyah: string;
  namaIbu: string;
  namaPanggilan: string | null;
  noHP: string | null;
  punyaKTP: string;
  bantuan: string;
  bpjs: string | null;
  alamat: string;
  rt: string;
  rw: string;
  kelurahan: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  keterangan: string | null;
}

interface KKGroup {
  noKK: string;
  kepala: Penduduk;
  anggota: Penduduk[];
}

const defaultFormData = {
  noKK: '',
  nik: '',
  namaLengkap: '',
  jenisKelamin: '',
  statusKeluarga: '',
  tempatLahir: '',
  tanggalLahir: '',
  agama: '',
  pendidikan: '',
  pekerjaan: '',
  statusPerkawinan: '',
  kewarganegaraan: 'WNI',
  namaAyah: '',
  namaIbu: '',
  namaPanggilan: '',
  noHP: '',
  punyaKTP: 'BELUM',
  bantuan: [] as string[],
  bpjs: '',
  alamat: ALAMAT_DEFAULT,
  rt: RT_DEFAULT,
  rw: RW_DEFAULT,
  kelurahan: KELURAHAN_DEFAULT,
  kecamatan: KECAMATAN_DEFAULT,
  kabupaten: KABUPATEN_DEFAULT,
  provinsi: PROVINSI_DEFAULT,
  keterangan: '',
};

interface TabPendudukProps {
  isAdmin?: boolean;
  isActive?: boolean;
}

export default function TabPenduduk({ isAdmin = true, isActive = false }: TabPendudukProps) {
  const [penduduk, setPenduduk] = useState<Penduduk[]>([]);
  const [kkGroups, setKKGroups] = useState<KKGroup[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedKK, setExpandedKK] = useState<Set<string>>(new Set());

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [formError, setFormError] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Penduduk | null>(null);

  // Import
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  // Export
  const [exporting, setExporting] = useState(false);

  // Add menu
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [addMode, setAddMode] = useState<'KK_BARU' | 'ANGGOTA'>('KK_BARU');

  // Filter
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const FILTER_OPTIONS = [
    { value: 'KK_PEREMPUAN', label: 'KK Perempuan', description: 'Kepala keluarga perempuan' },
    { value: 'KK_LAKI', label: 'KK Laki-laki', description: 'Kepala keluarga laki-laki' },
    { value: 'WAJIB_KTP_17', label: 'Wajib KTP 17 Thn', description: 'Usia 17-18 tahun yang belum punya KTP' },
    { value: 'USIA_75', label: 'Usia 75+ Thn', description: 'Usia 75 tahun ke atas' },
    { value: 'LANSIA_60', label: 'Lansia 60+ Thn', description: 'Usia 60 tahun ke atas' },
    { value: 'BPJS_TIDAK_ADA', label: 'BPJS Tidak Ada', description: 'Tidak memiliki BPJS' },
    { value: 'BELUM_KTP', label: 'Belum Punya KTP', description: 'Status KTP belum' },
    { value: 'BELUM_BANTUAN', label: 'Belum Ada Bantuan', description: 'Belum memiliki bantuan apapun' },
  ];

  // Anggota list for KK_BARU mode
  const [anggotaList, setAnggotaList] = useState<typeof defaultFormData[]>([]);
  const [expandedAnggota, setExpandedAnggota] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Scan KK
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanRotation, setScanRotation] = useState(0);
  const [scanFlipH, setScanFlipH] = useState(false);
  const [scanFlipV, setScanFlipV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rotasi gambar secara real di canvas
  const rotateScanPreview = (direction: 'cw' | 'ccw') => {
    if (!scanPreview) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const newRotation = direction === 'cw' ? scanRotation + 90 : scanRotation - 90;
      // Jika rotasi 90/270, swap width/height
      if (newRotation % 180 !== 0) { [w, h] = [h, w]; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((newRotation * Math.PI) / 180);
      if (scanFlipH) ctx.scale(-1, 1);
      if (scanFlipV) ctx.scale(1, -1);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setScanPreview(dataUrl);
      setScanRotation(newRotation);
    };
    img.src = scanPreview;
  };

  // Flip gambar (cermin)
  const flipScanPreview = (axis: 'h' | 'v') => {
    if (!scanPreview) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (scanRotation % 180 !== 0) { [w, h] = [h, w]; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((scanRotation * Math.PI) / 180);
      const newFlipH = axis === 'h' ? !scanFlipH : scanFlipH;
      const newFlipV = axis === 'v' ? !scanFlipV : scanFlipV;
      if (newFlipH) ctx.scale(-1, 1);
      if (newFlipV) ctx.scale(1, -1);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setScanPreview(dataUrl);
      setScanFlipH(newFlipH);
      setScanFlipV(newFlipV);
    };
    img.src = scanPreview;
  };

  // Reset rotasi ke gambar original
  const resetScanTransform = () => {
    if (originalScanRef.current) {
      setScanPreview(originalScanRef.current);
    }
    setScanRotation(0);
    setScanFlipH(false);
    setScanFlipV(false);
  };

  // Original preview untuk reset rotasi
  const originalScanRef = useRef<string | null>(null);

  // KK options for anggota mode
  const kkList = kkGroups.map(g => ({ noKK: g.noKK, namaKepala: g.kepala?.namaLengkap || '-' }));

  useEffect(() => {
    if (!showAddMenu) return;
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddMenu]);

  const fetchPenduduk = useCallback(async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiFetch(`/api/penduduk${params}`);
      if (res.ok) {
        const data = await res.json();
        setPenduduk(data);
        groupByKK(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const groupByKK = (data: Penduduk[]) => {
    const map = new Map<string, KKGroup>();
    for (const p of data) {
      let group = map.get(p.noKK);
      if (!group) {
        group = { noKK: p.noKK, kepala: null as unknown as Penduduk, anggota: [] };
        map.set(p.noKK, group);
      }
      if (p.statusKeluarga === 'KEPALA KELUARGA') {
        group.kepala = p;
      } else {
        group.anggota.push(p);
      }
    }
    const groups = Array.from(map.values());
    // Urutkan KK berdasarkan nama kepala keluarga A-Z
    groups.sort((a, b) => {
      const nameA = a.kepala?.namaLengkap || '';
      const nameB = b.kepala?.namaLengkap || '';
      return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' });
    });
    // Urutkan anggota dalam setiap KK A-Z
    for (const group of groups) {
      group.anggota.sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap, 'id', { sensitivity: 'base' }));
    }
    setKKGroups(groups);
  };

  useEffect(() => {
    fetchPenduduk();
  }, [fetchPenduduk]);

  // Listen for data changes from other tabs
  useEffect(() => {
    const handler = () => fetchPenduduk();
    window.addEventListener('sikependudukan-data-changed', handler);
    return () => window.removeEventListener('sikependudukan-data-changed', handler);
  }, [fetchPenduduk]);

  useEffect(() => {
    if (isActive) fetchPenduduk();
  }, [isActive, fetchPenduduk]);

  const handleScanKK = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (JPG, PNG, dll)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 10MB');
      return;
    }

    // Resize gambar jika terlalu besar (maks 1600px, JPEG quality 0.8)
    const MAX_DIM = 1600;
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        originalScanRef.current = dataUrl;
        setScanPreview(dataUrl);
        setScanRotation(0);
        setScanFlipH(false);
        setScanFlipV(false);
        setShowScanDialog(true);
      }
    };
    img.onerror = () => {
      toast.error('Gagal memuat gambar');
    };
    img.src = URL.createObjectURL(file);
  };

  const processScanKK = async () => {
    if (!scanPreview) return;
    setScanning(true);
    try {
      // Step 1: Preprocessing gambar (grayscale + kontras + threshold) untuk OCR lebih akurat
      toast.loading('Preprocessing gambar...', { id: 'scan-kk-progress' });
      const preprocessed = await preprocessImageForOCR(scanPreview);

      // Step 2: OCR dengan Tesseract.js (gratis, tanpa API key, client-side)
      toast.loading('Membaca teks dari foto KK (Tesseract OCR)...', { id: 'scan-kk-progress' });
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(preprocessed, 'ind+eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round((m.progress || 0) * 100);
            toast.loading(`Membaca teks... ${pct}%`, { id: 'scan-kk-progress' });
          }
        },
      });
      const ocrText = result.data.text;

      if (!ocrText || ocrText.trim().length < 20) {
        toast.dismiss('scan-kk-progress');
        toast.error('Tidak dapat membaca teks dari gambar. Pastikan foto KK jelas dan tidak blur.');
        return;
      }

      console.log('[Scan KK] OCR raw text:\n', ocrText);

      // Step 3: Parsing teks OCR (client-side, tanpa API)
      toast.loading('Menganalisis data KK...', { id: 'scan-kk-progress' });
      const data = parseKKFromOCR(ocrText);

      if (!data || !data.noKK) {
        toast.dismiss('scan-kk-progress');
        toast.error('Gagal mengenali format Kartu Keluarga. Pastikan foto KK jelas dan lengkap.');
        return;
      }

      toast.dismiss('scan-kk-progress');

      // Buka form KK Baru
      setShowScanDialog(false);
      setScanPreview(null);
      setScanRotation(0);
      setScanFlipH(false);
      setScanFlipV(false);
      originalScanRef.current = null;
      setEditingId(null);
      setFormError('');
      setShowAddMenu(false);
      setAddMode('KK_BARU');

      // Mapping KK header ke form kepala
      const kepala = data.anggota.find((a: any) => a.statusKeluarga === 'KEPALA KELUARGA') || data.anggota[0];
      const otherAnggota = data.anggota.filter((a: any) => a.statusKeluarga !== 'KEPALA KELUARGA');

      const mappedKepala: typeof defaultFormData = {
        noKK: data.noKK || '',
        nik: kepala?.nik || '',
        namaLengkap: kepala?.namaLengkap || data.namaKepala || '',
        jenisKelamin: kepala?.jenisKelamin || '',
        statusKeluarga: 'KEPALA KELUARGA',
        tempatLahir: kepala?.tempatLahir || '',
        tanggalLahir: kepala?.tanggalLahir || '',
        agama: kepala?.agama || '',
        pendidikan: kepala?.pendidikan || '',
        pekerjaan: kepala?.pekerjaan || '',
        statusPerkawinan: kepala?.statusPerkawinan || '',
        kewarganegaraan: kepala?.kewarganegaraan || 'WNI',
        namaAyah: '',
        namaIbu: '',
        namaPanggilan: '',
        noHP: '',
        punyaKTP: kepala?.tanggalLahir && hitungUmur(kepala.tanggalLahir).umurTahun >= 19 ? 'PUNYA' : 'BELUM',
        bantuan: [],
        bpjs: '',
        alamat: data.alamat || ALAMAT_DEFAULT,
        rt: data.rt || RT_DEFAULT,
        rw: data.rw || RW_DEFAULT,
        kelurahan: data.desa || KELURAHAN_DEFAULT,
        kecamatan: data.kecamatan || KECAMATAN_DEFAULT,
        kabupaten: data.kabupaten || KABUPATEN_DEFAULT,
        provinsi: data.provinsi || PROVINSI_DEFAULT,
        keterangan: '',
      };

      setFormData(mappedKepala);

      // Mapping anggota keluarga lainnya
      const mappedAnggota = otherAnggota.map((a: any) => ({
        noKK: data.noKK || '',
        nik: a.nik || '',
        namaLengkap: a.namaLengkap || '',
        jenisKelamin: a.jenisKelamin || '',
        statusKeluarga: a.statusKeluarga || 'ANAK',
        tempatLahir: a.tempatLahir || '',
        tanggalLahir: a.tanggalLahir || '',
        agama: a.agama || '',
        pendidikan: a.pendidikan || '',
        pekerjaan: a.pekerjaan || '',
        statusPerkawinan: a.statusPerkawinan || '',
        kewarganegaraan: a.kewarganegaraan || 'WNI',
        namaAyah: '',
        namaIbu: '',
        namaPanggilan: '',
        noHP: '',
        punyaKTP: a.tanggalLahir && hitungUmur(a.tanggalLahir).umurTahun >= 19 ? 'PUNYA' : 'BELUM',
        bantuan: [],
        bpjs: '',
        alamat: data.alamat || ALAMAT_DEFAULT,
        rt: data.rt || RT_DEFAULT,
        rw: data.rw || RW_DEFAULT,
        kelurahan: data.desa || KELURAHAN_DEFAULT,
        kecamatan: data.kecamatan || KECAMATAN_DEFAULT,
        kabupaten: data.kabupaten || KABUPATEN_DEFAULT,
        provinsi: data.provinsi || PROVINSI_DEFAULT,
        keterangan: '',
      }));

      setAnggotaList(mappedAnggota);
      setExpandedAnggota(new Set(mappedAnggota.map((_, i: number) => i)));
      setShowForm(true);

      const namaDisplay = kepala?.namaLengkap || data.namaKepala || 'Kepala Keluarga';
      toast.success(`KK berhasil dibaca: ${namaDisplay} (${data.anggota.length} anggota). Silakan periksa dan lengkapi data.`);
    } catch (err: any) {
      toast.dismiss('scan-kk-progress');
      console.error('[Scan KK] Error:', err);
      toast.error('Gagal memproses gambar KK: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setScanning(false);
    }
  };

  const openAddForm = (noKK?: string, isAnggota?: boolean) => {
    setEditingId(null);
    setFormError('');
    setShowAddMenu(false);
    setAddMode(isAnggota ? 'ANGGOTA' : 'KK_BARU');
    setFormData({
      ...defaultFormData,
      noKK: noKK || '',
      bantuan: [],
      statusKeluarga: isAnggota ? '' : 'KEPALA KELUARGA',
    });
    setAnggotaList([]);
    setExpandedAnggota(new Set());
    setShowForm(true);
  };

  const addAnggota = () => {
    setAnggotaList(prev => [...prev, {
      ...defaultFormData,
      noKK: formData.noKK || '',
      statusKeluarga: '',
      bantuan: [],
      alamat: formData.alamat || ALAMAT_DEFAULT,
      rt: formData.rt || RT_DEFAULT,
      rw: formData.rw || RW_DEFAULT,
      kelurahan: formData.kelurahan || KELURAHAN_DEFAULT,
      kecamatan: formData.kecamatan || KECAMATAN_DEFAULT,
      kabupaten: formData.kabupaten || KABUPATEN_DEFAULT,
      provinsi: formData.provinsi || PROVINSI_DEFAULT,
      kewarganegaraan: formData.kewarganegaraan || 'WNI',
      namaAyah: formData.namaAyah || '',
      namaIbu: formData.namaIbu || '',
      keterangan: formData.keterangan || '',
    }]);
    setExpandedAnggota(prev => new Set([...prev, anggotaList.length]));
  };

  const removeAnggota = (index: number) => {
    setAnggotaList(prev => prev.filter((_, i) => i !== index));
    setExpandedAnggota(prev => {
      const next = new Set<number>();
      for (const v of prev) {
        if (v === index) continue;
        if (v > index) next.add(v - 1);
        else next.add(v);
      }
      return next;
    });
  };

  const updateAnggotaField = (index: number, field: string, value: string | string[]) => {
    setAnggotaList(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [field]: value };
      // Auto-set punyaKTP = PUNYA jika usia >= 19 tahun
      if (field === 'tanggalLahir' && value) {
        const umur = hitungUmur(value as string);
        if (umur.umurTahun >= 19) {
          next.punyaKTP = 'PUNYA';
        } else {
          next.punyaKTP = 'BELUM';
        }
      }
      return next;
    }));
  };

  const toggleAnggotaExpand = (index: number) => {
    setExpandedAnggota(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAnggotaBantuan = (index: number, item: string) => {
    setAnggotaList(prev => prev.map((a, i) => {
      if (i !== index) return a;
      return {
        ...a,
        bantuan: a.bantuan.includes(item)
          ? a.bantuan.filter(b => b !== item)
          : [...a.bantuan, item],
      };
    }));
  };

  const openEditForm = (p: Penduduk) => {
    setEditingId(p.id);
    setFormError('');
    setFormData({
      noKK: p.noKK,
      nik: p.nik,
      namaLengkap: p.namaLengkap,
      jenisKelamin: p.jenisKelamin,
      statusKeluarga: p.statusKeluarga,
      tempatLahir: p.tempatLahir,
      tanggalLahir: p.tanggalLahir.split('T')[0],
      agama: p.agama,
      pendidikan: p.pendidikan,
      pekerjaan: p.pekerjaan,
      statusPerkawinan: p.statusPerkawinan,
      kewarganegaraan: p.kewarganegaraan,
      namaAyah: p.namaAyah,
      namaIbu: p.namaIbu,
      namaPanggilan: p.namaPanggilan || '',
      noHP: p.noHP || '',
      punyaKTP: (() => {
        if (p.punyaKTP === 'RUSAK' || p.punyaKTP === 'HILANG') return p.punyaKTP;
        const umur = hitungUmur(p.tanggalLahir);
        return umur.umurTahun >= 19 ? 'PUNYA' : p.punyaKTP;
      })(),
      bantuan: JSON.parse(p.bantuan || '[]'),
      bpjs: p.bpjs || '',
      alamat: p.alamat || ALAMAT_DEFAULT,
      rt: p.rt || RT_DEFAULT,
      rw: p.rw || RW_DEFAULT,
      kelurahan: p.kelurahan || KELURAHAN_DEFAULT,
      kecamatan: p.kecamatan || KECAMATAN_DEFAULT,
      kabupaten: p.kabupaten || KABUPATEN_DEFAULT,
      provinsi: p.provinsi || PROVINSI_DEFAULT,
      keterangan: p.keterangan || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError('');
    setSubmitting(true);

    try {
      // --- Submit KK Head or Edit ---
      if (editingId) {
        const res = await apiFetch('/api/penduduk', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...formData }),
        });
        if (res.ok) {
          toast.success('Data berhasil diupdate');
          setShowForm(false);
          fetchPenduduk();
          window.dispatchEvent(new CustomEvent('sikependudukan-data-changed'));
        } else {
          const err = await res.json();
          setFormError(err.error || 'Gagal menyimpan data');
        }
        setSubmitting(false);
        return;
      }

      // --- Tambah Anggota mode ---
      if (addMode === 'ANGGOTA') {
        if (!validateNIK(formData.nik)) {
          setFormError('NIK harus 16 digit angka');
          setSubmitting(false);
          return;
        }
        if (!formData.namaLengkap || !formData.tanggalLahir || !formData.jenisKelamin || !formData.statusKeluarga) {
          setFormError('Data wajib belum lengkap');
          setSubmitting(false);
          return;
        }
        const res = await apiFetch('/api/penduduk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          toast.success('Anggota keluarga berhasil ditambahkan');
          setShowForm(false);
          fetchPenduduk();
          window.dispatchEvent(new CustomEvent('sikependudukan-data-changed'));
        } else {
          const err = await res.json();
          setFormError(err.error || 'Gagal menyimpan data');
        }
        setSubmitting(false);
        return;
      }

      // --- Tambah KK Baru mode ---
      if (!validateNoKK(formData.noKK)) {
        setFormError('No. KK harus 16 digit angka');
        setSubmitting(false);
        return;
      }
      if (!validateNIK(formData.nik)) {
        setFormError('NIK Kepala Keluarga harus 16 digit angka');
        setSubmitting(false);
        return;
      }
      if (!formData.namaLengkap || !formData.tanggalLahir || !formData.jenisKelamin) {
        setFormError('Data Kepala Keluarga wajib belum lengkap');
        setSubmitting(false);
        return;
      }

      // Validate anggota list
      for (let i = 0; i < anggotaList.length; i++) {
        const a = anggotaList[i];
        a.noKK = formData.noKK;
        if (!validateNIK(a.nik)) {
          setFormError(`NIK anggota #${i + 1} (${a.namaLengkap || 'belum diisi'}) harus 16 digit angka`);
          setSubmitting(false);
          return;
        }
        if (!a.namaLengkap || !a.tanggalLahir || !a.jenisKelamin || !a.statusKeluarga) {
          setFormError(`Data anggota #${i + 1} (${a.namaLengkap || 'belum diisi'}) belum lengkap (NIK, Nama, JK, Status, Tgl Lahir wajib)`);
          setSubmitting(false);
          return;
        }
      }

      // Submit KK head
      const headRes = await apiFetch('/api/penduduk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!headRes.ok) {
        const err = await headRes.json();
        setFormError(err.error || 'Gagal menambah Kepala Keluarga');
        setSubmitting(false);
        return;
      }

      // Submit each anggota
      let successCount = 1;
      let errorMsg = '';
      for (let i = 0; i < anggotaList.length; i++) {
        const a = { ...anggotaList[i], noKK: formData.noKK };
        try {
          const res = await apiFetch('/api/penduduk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(a),
          });
          if (res.ok) {
            successCount++;
          } else {
            const err = await res.json();
            errorMsg += `Anggota #${i + 1} (${a.namaLengkap}): ${err.error || 'gagal'}; `;
          }
        } catch {
          errorMsg += `Anggota #${i + 1} (${a.namaLengkap}): error jaringan; `;
        }
      }

      if (anggotaList.length > 0) {
        if (errorMsg) {
          toast.warning(`KK + ${successCount - 1} anggota tersimpan. ${errorMsg}`);
        } else {
          toast.success(`KK + ${anggotaList.length} anggota berhasil ditambahkan!`);
        }
      } else {
        toast.success('Kepala Keluarga berhasil ditambahkan');
      }

      setShowForm(false);
      fetchPenduduk();
      window.dispatchEvent(new CustomEvent('sikependudukan-data-changed'));
    } catch {
      setFormError('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiFetch(`/api/penduduk?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Data berhasil dihapus');
        setDeleteTarget(null);
        fetchPenduduk();
        window.dispatchEvent(new CustomEvent('sikependudukan-data-changed'));
      }
    } catch {
      toast.error('Gagal menghapus data');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formDataImport = new FormData();
    formDataImport.append('file', file);

    try {
      const res = await apiFetch('/api/penduduk/import', { method: 'POST', body: formDataImport });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        if (data.dateParseFails && data.dateParseFails > 0) {
          toast.error(`⚠ ${data.dateParseFails} tanggal lahir tidak valid! Periksa format kolom Tgl Lahir di Excel.`, { duration: 8000 });
        }
        if (data.skipped > 0 && !data.dateParseFails) {
          toast.info(`${data.skipped} data dilewati (duplikat atau tidak valid)`);
        }
        if (data.errors?.length > 0) {
          const sampleErrors = data.errors.slice(0, 3).join('; ');
          toast.warning(`⚠ ${data.errors.length} data gagal: ${sampleErrors}`, { duration: 10000 });
          console.warn('Import errors:', data.errors);
        }
        fetchPenduduk();
        setShowImport(false);
        window.dispatchEvent(new CustomEvent('sikependudukan-data-changed'));
      } else {
        const err = await res.json();
        toast.error(`Gagal mengimpor: ${err.error || 'Unknown error'}`, { duration: 8000 });
        console.error('Import failed:', err);
      }
    } catch {
      toast.error('Gagal mengimpor file');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // Tentukan data yang diekspor berdasarkan filter aktif
      let exportData: Penduduk[] = [];
      let fileName = 'data-penduduk';

      if (activeFilter) {
        const filterLabel = FILTER_OPTIONS.find(f => f.value === activeFilter)?.label || activeFilter;
        fileName = `data-penduduk-${filterLabel.toLowerCase().replace(/\s+/g, '-')}`;

        if (isFlatFilter) {
          exportData = flatFilteredList;
        } else {
          // KK group filter — gabungkan kepala + anggota dari filtered groups
          exportData = [];
          for (const g of filteredGroups) {
            if (g.kepala) exportData.push(g.kepala);
            exportData.push(...g.anggota);
          }
        }
      } else {
        exportData = penduduk;
      }

      if (exportData.length === 0) {
        toast.error('Tidak ada data untuk diekspor');
        setExporting(false);
        return;
      }

      const headers = [
        'NO. KK', 'NAMA', 'NIK', 'JK', 'STATUS KK',
        'TEMPAT', 'TGL LAHIR', 'AGAMA', 'PENDIDIKAN', 'PEKERJAAN',
        'STATUS KAWIN', 'WARGANEGARAAN', 'AYAH', 'IBU', 'PANGGILAN', 'KETERANGAN',
      ];

      const rows = exportData.map(p => [
        p.noKK, p.namaLengkap, p.nik,
        p.jenisKelamin === 'LAKI-LAKI' ? 'L' : p.jenisKelamin === 'PEREMPUAN' ? 'P' : p.jenisKelamin,
        p.statusKeluarga, p.tempatLahir, formatTanggal(p.tanggalLahir),
        p.agama, p.pendidikan, p.pekerjaan, p.statusPerkawinan,
        p.kewarganegaraan, p.namaAyah, p.namaIbu,
        p.namaPanggilan || '', p.keterangan || '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 5 }, { wch: 20 },
        { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 25 }, { wch: 25 },
        { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 25 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data Penduduk');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Data berhasil diekspor (${exportData.length} orang)`);
    } catch {
      toast.error('Gagal mengekspor data');
    } finally {
      setExporting(false);
    }
  };

  const handlePrintLabel = () => {
    // Kumpulkan data label: nama KK & istri, Di, Tepat
    const labels: { text: string }[] = [];
    kkGroups.forEach(g => {
      const kkName = g.kepala?.namaLengkap || '';
      const istri = g.anggota.find(a => a.statusKeluarga === 'ISTRI');
      const istriName = istri?.namaLengkap || '';
      let text = kkName;
      if (istriName) {
        text = `${kkName} & ${istriName}`;
      }
      if (text) labels.push({ text });
    });

    if (labels.length === 0) {
      toast.error('Tidak ada data untuk dicetak');
      return;
    }

    // Buat halaman label per 12 label (3 kolom x 4 baris)
    const LABELS_PER_PAGE = 12;
    const pages: { text: string }[][] = [];
    for (let i = 0; i < labels.length; i += LABELS_PER_PAGE) {
      pages.push(labels.slice(i, i + LABELS_PER_PAGE));
    }

    // Generate HTML untuk setiap halaman
    const pagesHtml = pages.map((pageLabels, pageIdx) => {
      const rows: string[] = [];
      for (let row = 0; row < 4; row++) {
        const cells: string[] = [];
        for (let col = 0; col < 3; col++) {
          const idx = row * 3 + col;
          const label = pageLabels[idx];
          cells.push(`
            <div style="
              width: 88mm; height: 48mm;
              display: flex; flex-direction: column;
              align-items: center; justify-content: center;
              font-family: 'Times New Roman', Times, serif;
              font-weight: bold; text-align: center;
              border: 0.5px solid #ccc;
              box-sizing: border-box;
            ">
              <p style="font-size: 12pt; margin: 1px 0;">${label ? label.text : ''}</p>
              <p style="font-size: 11pt; margin: 1px 0;">Di</p>
              <p style="font-size: 11pt; margin: 1px 0;">Tepat</p>
            </div>
          `);
        }
        rows.push(`<div style="display: flex; gap: 0;">${cells.join('')}</div>`);
      }
      return `<div class="page">${rows.join('')}</div>`;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up diblokir. Izinkan pop-up untuk mencetak label.');
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Label Undangan</title>
  <style>
    @page { size: A4 landscape; margin: 5mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; }
    .page {
      width: 287mm; height: 200mm;
      display: flex; flex-direction: column;
      justify-content: center; align-items: center;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    @media print {
      .no-print { display: none !important; }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="padding: 10px; text-align: center; font-family: sans-serif;">
    <button onclick="window.print()" style="padding: 8px 24px; font-size: 14px; cursor: pointer; margin-right: 10px; background: #059669; color: white; border: none; border-radius: 6px;">Cetak Label</button>
    <button onclick="window.close()" style="padding: 8px 24px; font-size: 14px; cursor: pointer; border: 1px solid #ccc; border-radius: 6px;">Tutup</button>
    <p style="font-size: 12px; color: #666; margin-top: 8px;">Atur ukuran kertas ke A4 Landscape, margin Minimal, lalu klik Cetak Label</p>
  </div>
  ${pagesHtml}
</body>
</html>`);
    printWindow.document.close();
  };

  const toggleExpand = (noKK: string) => {
    const next = new Set(expandedKK);
    if (next.has(noKK)) next.delete(noKK);
    else next.add(noKK);
    setExpandedKK(next);
  };

  const updateField = (field: string, value: string | string[]) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      // Auto-set punyaKTP = PUNYA jika usia >= 19 tahun
      if (field === 'tanggalLahir' && value) {
        const umur = hitungUmur(value as string);
        if (umur.umurTahun >= 19) {
          next.punyaKTP = 'PUNYA';
        } else {
          next.punyaKTP = 'BELUM';
        }
      }
      // Auto-propagate ke semua anggota (mode KK_BARU)
      if (!editingId && addMode === 'KK_BARU' && anggotaList.length > 0) {
        const addrFields = ['alamat', 'rt', 'rw', 'kelurahan', 'kecamatan', 'kabupaten', 'provinsi'];
        if (addrFields.includes(field)) {
          setAnggotaList(prev => prev.map(a => ({ ...a, [field]: value })));
        }
      }
      return next;
    });
    // Auto-propagate keterangan dari KK head ke semua anggota (mode KK_BARU)
    if (field === 'keterangan' && !editingId && addMode === 'KK_BARU' && anggotaList.length > 0) {
      setAnggotaList(prev => prev.map(a => ({ ...a, keterangan: value as string })));
    }
    // Auto-fill keterangan dan alamat dari KK head saat pilih KK (mode ANGGOTA)
    if (field === 'noKK' && !editingId && addMode === 'ANGGOTA' && value) {
      const group = kkGroups.find(g => g.noKK === value);
      if (group?.kepala) {
        setFormData(prev => ({ ...prev,
          keterangan: group.kepala.keterangan || '',
          alamat: group.kepala.alamat || ALAMAT_DEFAULT,
          rt: group.kepala.rt || RT_DEFAULT,
          rw: group.kepala.rw || RW_DEFAULT,
          kelurahan: group.kepala.kelurahan || KELURAHAN_DEFAULT,
          kecamatan: group.kepala.kecamatan || KECAMATAN_DEFAULT,
          kabupaten: group.kepala.kabupaten || KABUPATEN_DEFAULT,
          provinsi: group.kepala.provinsi || PROVINSI_DEFAULT,
        }));
      }
    }
  };

  const toggleBantuan = (item: string) => {
    setFormData(prev => ({
      ...prev,
      bantuan: prev.bantuan.includes(item)
        ? prev.bantuan.filter(b => b !== item)
        : [...prev.bantuan, item],
    }));
  };

  // Filter logic: filter penduduk data based on activeFilter
  // isFlatFilter: true = filter menghasilkan daftar individu (bukan KK groups)
  const isFlatFilter = ['WAJIB_KTP_17', 'USIA_75', 'LANSIA_60', 'BPJS_TIDAK_ADA', 'BELUM_KTP'].includes(activeFilter);

  const filteredGroups = (() => {
    if (!activeFilter) return kkGroups;

    switch (activeFilter) {
      case 'KK_PEREMPUAN':
        return kkGroups.filter(g => g.kepala?.jenisKelamin === 'PEREMPUAN');
      case 'KK_LAKI':
        return kkGroups.filter(g => g.kepala?.jenisKelamin === 'LAKI-LAKI');
      case 'BELUM_BANTUAN':
        return kkGroups.filter(g => {
          if (!g.kepala) return false;
          try {
            const arr = JSON.parse(g.kepala.bantuan || '[]');
            const filtered = arr.filter((b: string) => b !== 'TIDAK' && b !== '');
            return filtered.length === 0;
          } catch {
            return true;
          }
        });
      default:
        return kkGroups;
    }
  })();

  // Flat list untuk filter individu (usia, BPJS) — tanpa duplikasi KK card
  const flatFilteredList = (() => {
    if (!isFlatFilter) return [];

    return penduduk.filter(p => {
      switch (activeFilter) {
        case 'WAJIB_KTP_17': {
          if (p.punyaKTP === 'PUNYA') return false;
          if (!p.tanggalLahir) return false;
          const u = hitungUmur(p.tanggalLahir);
          return u.umurTahun === 17 || u.umurTahun === 18;
        }
        case 'USIA_75': {
          const u = p.tanggalLahir ? hitungUmur(p.tanggalLahir) : null;
          return u ? u.umurTahun >= 75 : false;
        }
        case 'LANSIA_60': {
          const u = p.tanggalLahir ? hitungUmur(p.tanggalLahir) : null;
          return u ? u.umurTahun >= 60 : false;
        }
        case 'BPJS_TIDAK_ADA':
          return !p.bpjs || p.bpjs === '' || p.bpjs === 'TIDAK ADA';
        case 'BELUM_KTP':
          return p.punyaKTP === 'BELUM';
        default:
          return false;
      }
    }).sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap, 'id', { sensitivity: 'base' }));
  })();

  const filteredCount = isFlatFilter
    ? flatFilteredList.length
    : filteredGroups.reduce((sum, g) => {
        const members = g.kepala ? [g.kepala, ...g.anggota] : g.anggota;
        return sum + members.length;
      }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-emerald-800">Data Penduduk</h2>
          <Badge variant="secondary" className="text-xs">{activeFilter ? `${filteredCount}` : `${penduduk.length}`} orang</Badge>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-1" />
              ) : (
                <FileDown className="h-4 w-4 mr-1" />
              )} Ekspor
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <FileUp className="h-4 w-4 mr-1" /> Impor
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrintLabel}>
            <Printer className="h-4 w-4 mr-1" /> Cetak Label
          </Button>
          {isAdmin && (
            <div ref={addMenuRef} className="relative">
              <Button
                size="sm"
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="bg-emerald-600 hover:bg-emerald-700 min-w-[120px] justify-between"
              >
                <span className="flex items-center">
                  <Plus className="h-4 w-4 mr-1" /> Tambah
                </span>
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
              {showAddMenu && (
                <div className="absolute right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 w-48">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition-colors flex items-center gap-2"
                    onClick={() => openAddForm(undefined, false)}
                  >
                    <Users className="h-4 w-4 text-emerald-600" />
                    Tambah KK Baru
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
                    onClick={() => openAddForm(undefined, true)}
                  >
                    <Plus className="h-4 w-4 text-blue-600" />
                    Tambah Anggota Keluarga
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 transition-colors flex items-center gap-2"
                    onClick={() => {
                      setShowAddMenu(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <Camera className="h-4 w-4 text-purple-600" />
                    Scan KK (Foto)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, NIK, No. KK..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Button
            variant={activeFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className={activeFilter ? 'bg-orange-500 hover:bg-orange-600 min-w-[100px] justify-between' : 'min-w-[100px] justify-between'}
          >
            <span className="flex items-center gap-1">
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </span>
            {activeFilter && (
              <X className="h-3.5 w-3.5 ml-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); setActiveFilter(''); }} />
            )}
            {!activeFilter && <ChevronDown className="h-3.5 w-3.5 ml-1" />}
          </Button>
          {showFilterMenu && (
            <div className="absolute right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 w-56">
              <button
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${!activeFilter ? 'bg-emerald-50 text-emerald-700 font-medium' : ''}`}
                onClick={() => { setActiveFilter(''); setShowFilterMenu(false); }}
              >
                Semua Data
              </button>
              <div className="border-t border-gray-100 my-1" />
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${activeFilter === opt.value ? 'bg-orange-50 text-orange-700 font-medium' : ''}`}
                  onClick={() => { setActiveFilter(opt.value); setShowFilterMenu(false); }}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {activeFilter && (
        <div className="flex items-center gap-2">
          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border border-orange-200 text-xs px-2 py-1">
            {FILTER_OPTIONS.find(f => f.value === activeFilter)?.label || activeFilter}
            <X className="h-3 w-3 ml-1.5 cursor-pointer" onClick={() => setActiveFilter('')} />
          </Badge>
          <span className="text-xs text-muted-foreground">Menampilkan {filteredCount} dari {penduduk.length} penduduk</span>
        </div>
      )}

      {/* KK List */}
      <ScrollArea className="max-h-[calc(100vh-260px)]">
        <div className="space-y-2">
          {isFlatFilter ? (
            // Tampilan flat list untuk filter individu (usia, BPJS)
            <>
              {flatFilteredList.length > 0 ? (
                flatFilteredList.map(p => (
                  <Card key={p.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <PendudukRow
                        penduduk={p}
                        isKK={p.statusKeluarga === 'KEPALA KELUARGA'}
                        isAdmin={isAdmin}
                        onEdit={openEditForm}
                        onDelete={setDeleteTarget}
                        onAddMember={p.statusKeluarga === 'KEPALA KELUARGA' ? () => openAddForm(p.noKK, true) : undefined}
                      />
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Tidak ada data yang sesuai filter</p>
                </div>
              )}
            </>
          ) : (
            // Tampilan KK groups (normal atau filter KK)
            filteredGroups.map(group => {
              const isExpanded = expandedKK.has(group.noKK);
              const totalL = (group.kepala?.jenisKelamin === 'LAKI-LAKI' ? 1 : 0) + group.anggota.filter(a => a.jenisKelamin === 'LAKI-LAKI').length;
              const totalP = (group.kepala?.jenisKelamin === 'PEREMPUAN' ? 1 : 0) + group.anggota.filter(a => a.jenisKelamin === 'PEREMPUAN').length;

              return (
                <Card key={group.noKK} className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* KK Header */}
                    <button
                      onClick={() => toggleExpand(group.noKK)}
                      className="w-full flex items-center gap-2 p-3 hover:bg-emerald-50 transition-colors text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{group.kepala?.namaLengkap || '-'}</p>
                        <p className="text-[11px] text-muted-foreground">KK: {group.noKK}</p>
                      </div>
                      <div className="flex gap-1 items-center shrink-0">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">L:{totalL}</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">P:{totalP}</Badge>
                      </div>
                    </button>

                    {/* Expanded Members */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/50">
                        {group.kepala && (
                          <PendudukRow
                            penduduk={group.kepala}
                            isKK
                            isAdmin={isAdmin}
                            onEdit={openEditForm}
                            onDelete={setDeleteTarget}
                            onAddMember={() => openAddForm(group.noKK, true)}
                          />
                        )}
                        {group.anggota.map(a => (
                          <PendudukRow
                            key={a.id}
                            penduduk={a}
                            isKK={false}
                            isAdmin={isAdmin}
                            onEdit={openEditForm}
                            onDelete={setDeleteTarget}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
          {kkGroups.length === 0 && !isFlatFilter && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Tidak ada data penduduk</p>
              {isAdmin && <p className="text-xs mt-1">Klik &quot;Tambah&quot; untuk menambahkan data baru</p>}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Data Penduduk' : addMode === 'ANGGOTA' ? 'Tambah Anggota Keluarga' : 'Tambah KK Baru & Anggota Keluarga'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded">{formError}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {!editingId && addMode === 'ANGGOTA' ? (
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Pilih KK *</Label>
                  <Select value={formData.noKK} onValueChange={v => updateField('noKK', v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Pilih KK..." />
                    </SelectTrigger>
                    <SelectContent>
                      {kkList.map(kk => (
                        <SelectItem key={kk.noKK} value={kk.noKK}>
                          <span className="font-mono text-xs">{kk.noKK}</span> — {kk.namaKepala}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">No. KK *</Label>
                    <Input
                      className="text-sm"
                      value={formData.noKK}
                      onChange={e => updateField('noKK', e.target.value)}
                      placeholder="16 digit"
                      maxLength={16}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">NIK *</Label>
                    <Input
                      className="text-sm"
                      value={formData.nik}
                      onChange={e => updateField('nik', e.target.value)}
                      placeholder="16 digit"
                      maxLength={16}
                    />
                  </div>
                </>
              )}
              {!editingId && addMode === 'ANGGOTA' && (
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">NIK *</Label>
                  <Input
                    className="text-sm"
                    value={formData.nik}
                    onChange={e => updateField('nik', e.target.value)}
                    placeholder="16 digit"
                    maxLength={16}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nama Lengkap *</Label>
              <Input
                className="text-sm uppercase"
                value={formData.namaLengkap}
                onChange={e => updateField('namaLengkap', e.target.value.toUpperCase())}
                placeholder="NAMA LENGKAP"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Jenis Kelamin *</Label>
                <Select value={formData.jenisKelamin} onValueChange={v => updateField('jenisKelamin', v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {JENIS_KELAMIN.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status Keluarga</Label>
                {(!editingId && addMode === 'ANGGOTA') ? (
                  <Select value={formData.statusKeluarga} onValueChange={v => updateField('statusKeluarga', v)}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                    <SelectContent>
                      {STATUS_KELUARGA.filter(s => s !== 'KEPALA KELUARGA').map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : !editingId ? (
                  <Input className="text-sm bg-gray-50" value="KEPALA KELUARGA" disabled />
                ) : (
                  <Select value={formData.statusKeluarga} onValueChange={v => updateField('statusKeluarga', v)}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                    <SelectContent>
                      {STATUS_KELUARGA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tempat Lahir</Label>
                <Input
                  className="text-sm uppercase"
                  value={formData.tempatLahir}
                  onChange={e => updateField('tempatLahir', e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tanggal Lahir *</Label>
                <Input
                  type="date"
                  className="text-sm"
                  value={formData.tanggalLahir}
                  onChange={e => updateField('tanggalLahir', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Agama</Label>
                <Select value={formData.agama} onValueChange={v => updateField('agama', v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {AGAMA.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pendidikan</Label>
                <Select value={formData.pendidikan} onValueChange={v => updateField('pendidikan', v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {PENDIDIKAN.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Pekerjaan</Label>
                <Select value={formData.pekerjaan} onValueChange={v => updateField('pekerjaan', v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {PEKERJAAN.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status Perkawinan</Label>
                <Select value={formData.statusPerkawinan} onValueChange={v => updateField('statusPerkawinan', v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_PERKAWINAN.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nama Ayah</Label>
                <Input
                  className="text-sm uppercase"
                  value={formData.namaAyah}
                  onChange={e => updateField('namaAyah', e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nama Ibu</Label>
                <Input
                  className="text-sm uppercase"
                  value={formData.namaIbu}
                  onChange={e => updateField('namaIbu', e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nama Panggilan</Label>
                <Input
                  className="text-sm uppercase"
                  value={formData.namaPanggilan}
                  onChange={e => updateField('namaPanggilan', e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">No. HP</Label>
                <Input
                  className="text-sm"
                  value={formData.noHP}
                  onChange={e => updateField('noHP', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status KTP</Label>
                <Select value={formData.punyaKTP} onValueChange={v => updateField('punyaKTP', v)}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_KTP.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kewarganegaraan</Label>
                <Input
                  className="text-sm uppercase"
                  value={formData.kewarganegaraan}
                  onChange={e => updateField('kewarganegaraan', e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Bantuan</Label>
              <div className="flex flex-wrap gap-2">
                {BANTUAN_OPTIONS.map(b => (
                  <label key={b} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={formData.bantuan.includes(b)}
                      onCheckedChange={() => toggleBantuan(b)}
                    />
                    <span className="text-xs">{b}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Alamat</Label>
              <Input
                className="text-sm uppercase"
                value={formData.alamat}
                onChange={e => updateField('alamat', e.target.value.toUpperCase())}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">RT</Label>
                <Input
                  className="text-sm uppercase"
                  value={formData.rt}
                  onChange={e => updateField('rt', e.target.value.toUpperCase())}
                  maxLength={3}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">RW</Label>
                <Input
                  className="text-sm uppercase"
                  value={formData.rw}
                  onChange={e => updateField('rw', e.target.value.toUpperCase())}
                  maxLength={3}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kelurahan/Desa</Label>
                <Input
                  className="text-sm uppercase"
                  value={formData.kelurahan}
                  onChange={e => updateField('kelurahan', e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kecamatan</Label>
                <Input
                  className="text-sm uppercase"
                  value={formData.kecamatan}
                  onChange={e => updateField('kecamatan', e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kabupaten/Kota</Label>
                <Input
                  className="text-sm uppercase"
                  value={formData.kabupaten}
                  onChange={e => updateField('kabupaten', e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Provinsi</Label>
                <Input
                  className="text-sm uppercase"
                  value={formData.provinsi}
                  onChange={e => updateField('provinsi', e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">BPJS</Label>
                <Select value={formData.bpjs} onValueChange={v => updateField('bpjs', v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {BPJS_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Keterangan</Label>
                <Input
                  className="text-sm"
                  value={formData.keterangan}
                  onChange={e => updateField('keterangan', e.target.value)}
                />
                {editingId && formData.statusKeluarga === 'KEPALA KELUARGA' && (
                  <p className="text-[10px] text-orange-600 mt-1">* Keterangan akan otomatis diterapkan ke semua anggota keluarga</p>
                )}
                {!editingId && addMode === 'KK_BARU' && anggotaList.length > 0 && (
                  <p className="text-[10px] text-blue-600 mt-1">* Keterangan otomatis diterapkan ke {anggotaList.length} anggota keluarga</p>
                )}
              </div>
            </div>

            {/* Anggota Keluarga Section - hanya di mode KK_BARU */}
            {!editingId && addMode === 'KK_BARU' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <Label className="text-sm font-semibold text-blue-700">Anggota Keluarga</Label>
                    {anggotaList.length > 0 && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">{anggotaList.length} orang</Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addAnggota}
                    className="text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Anggota
                  </Button>
                </div>

                {anggotaList.length === 0 && (
                  <div className="text-center py-4 bg-blue-50/50 rounded-lg border border-dashed border-blue-200">
                    <p className="text-xs text-blue-500">Belum ada anggota. Klik &quot;Tambah Anggota&quot; untuk menambahkan.</p>
                    <p className="text-[10px] text-blue-400 mt-1">Anda bisa menambahkan anggota nanti melalui tombol + pada KK.</p>
                  </div>
                )}

                {anggotaList.map((anggota, idx) => {
                  const isExp = expandedAnggota.has(idx);
                  return (
                    <div key={idx} className="border border-blue-200 rounded-lg overflow-hidden bg-white">
                      {/* Anggota Header Row */}
                      <div
                        className="flex items-center gap-2 px-3 py-2 bg-blue-50/80 cursor-pointer hover:bg-blue-100/80 transition-colors"
                        onClick={() => toggleAnggotaExpand(idx)}
                      >
                        {isExp ? (
                          <ChevronUp className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        )}
                        <span className="text-xs font-medium text-blue-700">Anggota #{idx + 1}</span>
                        {anggota.namaLengkap && (
                          <span className="text-xs text-blue-500">— {anggota.namaLengkap}</span>
                        )}
                        <div className="flex-1" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); removeAnggota(idx); }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Anggota Form Fields */}
                      {isExp && (
                        <div className="p-3 space-y-3 border-t border-blue-100">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">NIK *</Label>
                              <Input
                                className="text-sm"
                                value={anggota.nik}
                                onChange={e => updateAnggotaField(idx, 'nik', e.target.value)}
                                placeholder="16 digit"
                                maxLength={16}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Nama Lengkap *</Label>
                              <Input
                                className="text-sm uppercase"
                                value={anggota.namaLengkap}
                                onChange={e => updateAnggotaField(idx, 'namaLengkap', e.target.value.toUpperCase())}
                                placeholder="NAMA LENGKAP"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Jenis Kelamin *</Label>
                              <Select value={anggota.jenisKelamin} onValueChange={v => updateAnggotaField(idx, 'jenisKelamin', v)}>
                                <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                  {JENIS_KELAMIN.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Status Keluarga *</Label>
                              <Select value={anggota.statusKeluarga} onValueChange={v => updateAnggotaField(idx, 'statusKeluarga', v)}>
                                <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                  {STATUS_KELUARGA.filter(s => s !== 'KEPALA KELUARGA').map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Tanggal Lahir *</Label>
                              <Input
                                type="date"
                                className="text-sm"
                                value={anggota.tanggalLahir}
                                onChange={e => updateAnggotaField(idx, 'tanggalLahir', e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Tempat Lahir</Label>
                              <Input
                                className="text-sm uppercase"
                                value={anggota.tempatLahir}
                                onChange={e => updateAnggotaField(idx, 'tempatLahir', e.target.value.toUpperCase())}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Agama</Label>
                              <Select value={anggota.agama} onValueChange={v => updateAnggotaField(idx, 'agama', v)}>
                                <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                  {AGAMA.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Pendidikan</Label>
                              <Select value={anggota.pendidikan} onValueChange={v => updateAnggotaField(idx, 'pendidikan', v)}>
                                <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                  {PENDIDIKAN.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Pekerjaan</Label>
                              <Select value={anggota.pekerjaan} onValueChange={v => updateAnggotaField(idx, 'pekerjaan', v)}>
                                <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                  {PEKERJAAN.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Status Perkawinan</Label>
                              <Select value={anggota.statusPerkawinan} onValueChange={v => updateAnggotaField(idx, 'statusPerkawinan', v)}>
                                <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                  {STATUS_PERKAWINAN.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Kewarganegaraan</Label>
                              <Input
                                className="text-sm uppercase"
                                value={anggota.kewarganegaraan}
                                onChange={e => updateAnggotaField(idx, 'kewarganegaraan', e.target.value.toUpperCase())}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Nama Panggilan</Label>
                              <Input
                                className="text-sm uppercase"
                                value={anggota.namaPanggilan}
                                onChange={e => updateAnggotaField(idx, 'namaPanggilan', e.target.value.toUpperCase())}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">No. HP</Label>
                              <Input
                                className="text-sm"
                                value={anggota.noHP}
                                onChange={e => updateAnggotaField(idx, 'noHP', e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Status KTP</Label>
                              <Select value={anggota.punyaKTP} onValueChange={v => updateAnggotaField(idx, 'punyaKTP', v)}>
                                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {STATUS_KTP.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">BPJS</Label>
                              <Select value={anggota.bpjs} onValueChange={v => updateAnggotaField(idx, 'bpjs', v)}>
                                <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                  {BPJS_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Alamat Lengkap - Input Terpisah */}
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-blue-700">Alamat Lengkap</Label>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Alamat</Label>
                            <Input
                              className="text-sm uppercase"
                              value={anggota.alamat || ALAMAT_DEFAULT}
                              onChange={e => updateAnggotaField(idx, 'alamat', e.target.value.toUpperCase())}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">RT</Label>
                              <Input
                                className="text-sm uppercase"
                                value={anggota.rt || RT_DEFAULT}
                                onChange={e => updateAnggotaField(idx, 'rt', e.target.value.toUpperCase())}
                                maxLength={3}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">RW</Label>
                              <Input
                                className="text-sm uppercase"
                                value={anggota.rw || RW_DEFAULT}
                                onChange={e => updateAnggotaField(idx, 'rw', e.target.value.toUpperCase())}
                                maxLength={3}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Kelurahan/Desa</Label>
                              <Input
                                className="text-sm uppercase"
                                value={anggota.kelurahan || KELURAHAN_DEFAULT}
                                onChange={e => updateAnggotaField(idx, 'kelurahan', e.target.value.toUpperCase())}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Kecamatan</Label>
                              <Input
                                className="text-sm uppercase"
                                value={anggota.kecamatan || KECAMATAN_DEFAULT}
                                onChange={e => updateAnggotaField(idx, 'kecamatan', e.target.value.toUpperCase())}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Kabupaten/Kota</Label>
                              <Input
                                className="text-sm uppercase"
                                value={anggota.kabupaten || KABUPATEN_DEFAULT}
                                onChange={e => updateAnggotaField(idx, 'kabupaten', e.target.value.toUpperCase())}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Provinsi</Label>
                              <Input
                                className="text-sm uppercase"
                                value={anggota.provinsi || PROVINSI_DEFAULT}
                                onChange={e => updateAnggotaField(idx, 'provinsi', e.target.value.toUpperCase())}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Bantuan</Label>
                            <div className="flex flex-wrap gap-2">
                              {BANTUAN_OPTIONS.map(b => (
                                <label key={b} className="flex items-center gap-1.5 cursor-pointer">
                                  <Checkbox
                                    checked={anggota.bantuan.includes(b)}
                                    onCheckedChange={() => toggleAnggotaBantuan(idx, b)}
                                  />
                                  <span className="text-xs">{b}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Keterangan</Label>
                            <Input
                              className="text-sm"
                              value={anggota.keterangan}
                              onChange={e => updateAnggotaField(idx, 'keterangan', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Menyimpan...
                  </span>
                ) : editingId ? 'Simpan Perubahan' : addMode === 'ANGGOTA' ? 'Tambah Anggota' : `Simpan KK${anggotaList.length > 0 ? ` + ${anggotaList.length} Anggota` : ''}`}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={submitting}>Batal</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Impor Data dari Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload file Excel (.xlsx) sesuai format import. Data keluarga akan dikelompokkan berdasarkan No. KK.
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              disabled={importing}
            />
            {importing && (
              <div className="flex items-center gap-2 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600" />
                <span>Mengimpor data...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus data <strong>{deleteTarget?.namaLengkap}</strong> ({deleteTarget?.nik})?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden file input for Scan KK */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleScanKK(file);
          e.target.value = '';
        }}
      />

      {/* Scan KK Dialog */}
      <Dialog open={showScanDialog} onOpenChange={(open) => {
        if (!open && !scanning) {
          setShowScanDialog(false);
          setScanPreview(null);
          setScanRotation(0);
          setScanFlipH(false);
          setScanFlipV(false);
          originalScanRef.current = null;
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-purple-600" />
              Scan Kartu Keluarga
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {scanPreview && (
              <div className="relative rounded-lg overflow-hidden border border-gray-200">
                <img src={scanPreview} alt="Preview KK" className="w-full h-auto max-h-[50vh] object-contain bg-gray-50" />
                {/* Tombol rotasi — overlay di atas gambar */}
                {!scanning && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
                    <button
                      onClick={() => rotateScanPreview('ccw')}
                      className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                      title="Putar Kiri"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => rotateScanPreview('cw')}
                      className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                      title="Putar Kanan"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <div className="w-px h-5 bg-white/30 mx-0.5" />
                    <button
                      onClick={() => flipScanPreview('h')}
                      className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                      title="Cermin Horizontal"
                    >
                      <FlipHorizontal className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => flipScanPreview('v')}
                      className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                      title="Cermin Vertikal"
                    >
                      <FlipVertical className="h-4 w-4" />
                    </button>
                    <div className="w-px h-5 bg-white/30 mx-0.5" />
                    <button
                      onClick={resetScanTransform}
                      className="px-2 py-1 rounded-full hover:bg-white/20 text-white text-xs transition-colors"
                      title="Reset"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              {scanning
                ? 'Sedang membaca teks dari foto KK. Proses ini memakan waktu beberapa detik...'
                : 'Pastikan foto KK jelas, tidak blur, dan semua teks terlihat. OCR akan memproses gambar secara otomatis (gratis).'
              }
            </p>
            <div className="flex gap-2">
              <Button
                onClick={processScanKK}
                disabled={scanning}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {scanning ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Membaca KK...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Proses Scan
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowScanDialog(false);
                  setScanPreview(null);
                }}
                disabled={scanning}
              >
                Batal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PendudukRow({
  penduduk,
  isKK,
  isAdmin = true,
  onEdit,
  onDelete,
  onAddMember,
}: {
  penduduk: Penduduk;
  isKK: boolean;
  isAdmin?: boolean;
  onEdit: (p: Penduduk) => void;
  onDelete: (p: Penduduk) => void;
  onAddMember?: () => void;
}) {
  let umur = { label: '-' };
  try { umur = hitungUmur(penduduk.tanggalLahir); } catch { /* skip */ }

  let bantuanArr: string[] = [];
  try { bantuanArr = JSON.parse(penduduk.bantuan || '[]').filter((b: string) => b !== 'TIDAK' && b !== ''); } catch { /* skip */ }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-white/80 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{penduduk.namaLengkap}</span>
          {isKK && <Badge className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">KK</Badge>}
          {!isKK && (
            <Badge variant="outline" className="text-[9px] px-1 py-0">{penduduk.statusKeluarga}</Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          NIK: {penduduk.nik} · {penduduk.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'} · Umur: {umur.label}
        </p>
        {/* Bantuan, BPJS, Keterangan */}
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {bantuanArr.length > 0 && (
            bantuanArr.map((b: string) => (
              <Badge key={b} variant="outline" className="text-[9px] px-1.5 py-0 border-orange-300 text-orange-600">{b}</Badge>
            ))
          )}
          {penduduk.bpjs && penduduk.bpjs !== 'TIDAK' && (
            <Badge className="text-[9px] px-1.5 py-0 bg-blue-100 text-blue-700 hover:bg-blue-100">BPJS {penduduk.bpjs}</Badge>
          )}
          {penduduk.keterangan && (
            <span className="text-[9px] text-gray-500 italic truncate max-w-[200px]">{penduduk.keterangan}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {isAdmin && isKK && onAddMember && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onAddMember}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
        {isAdmin && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(penduduk)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {isAdmin && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => onDelete(penduduk)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
