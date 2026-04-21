'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  Search,
  Shield,
  ExternalLink,
  Pencil,
  Download,
  ChevronDown,
  ChevronRight,
  CheckCheck,
  Package,
  Plus,
  Trash2,
  UserPlus,
  X,
  Save,
  Eye,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { BANTUAN_OPTIONS, BPJS_OPTIONS, DESIL_OPTIONS } from '@/lib/constants';
import { hitungUmur } from '@/lib/utils-kependudukan';
import { apiFetch } from '@/lib/api';

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
  desil: string | null;
  keterangan: string | null;
  alamat?: string;
  rt?: string;
  rw?: string;
  // Internal marker
  _isSementara?: boolean;
}

interface KKGroup {
  noKK: string;
  kepala: Penduduk | null;
  anggota: Penduduk[];
}

interface PenerimaSembako {
  id: number;
  noKK: string;
  nik: string;
  namaLengkap: string;
  jenisKelamin: string;
  statusKeluarga: string;
  tanggalLahir: string;
  alamat: string;
  rt: string;
  rw: string;
  keterangan: string | null;
}

interface SavedSembako {
  id: number;
  nama: string;
  jumlahPenerima: number;
  createdAt: string;
  updatedAt: string;
}

interface TabBantuanProps {
  isAdmin?: boolean;
  isActive?: boolean;
}

export default function TabBantuan({ isAdmin = true, isActive = false }: TabBantuanProps) {
  // ==================== VIEW TOGGLE ====================
  const [activeView, setActiveView] = useState<'bansos' | 'sembako'>('bansos');

  // ==================== BANSOS STATE ====================
  const [penduduk, setPenduduk] = useState<Penduduk[]>([]);
  const [kkGroups, setKKGroups] = useState<KKGroup[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedKK, setExpandedKK] = useState<Set<string>>(new Set());

  // Update Dialog
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<Penduduk | null>(null);
  const [updateBantuan, setUpdateBantuan] = useState<string[]>([]);
  const [updateBPJS, setUpdateBPJS] = useState('');
  const [updateDesil, setUpdateDesil] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [dbReady, setDbReady] = useState(false);

  // ==================== SEMBAKO STATE ====================
  const [sembakoData, setSembakoData] = useState<PenerimaSembako[]>([]);
  const [sembakoLoading, setSembakoLoading] = useState(false);
  const [sembakoSearch, setSembakoSearch] = useState('');
  const [sembakoSearchResults, setSembakoSearchResults] = useState<Penduduk[]>([]);
  const [sembakoSearching, setSembakoSearching] = useState(false);
  const [sembakoAdding, setSembakoAdding] = useState<string | null>(null); // NIK being added
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [kkList, setKKList] = useState<Penduduk[]>([]); // KK heads for dropdown
  const [selectedNoKK, setSelectedNoKK] = useState(''); // selected KK in dropdown
  const [anggotaList, setAnggotaList] = useState<Penduduk[]>([]); // anggota KK selected

  // Sembako Save/Riwayat State
  const [savedSembako, setSavedSembako] = useState<SavedSembako[]>([]);
  const [sembakoSaving, setSembakoSaving] = useState(false);
  const [sembakoSaveMsg, setSembakoSaveMsg] = useState('');
  const [sembakoSaveName, setSembakoSaveName] = useState('');
  // Sembako Sub-tabs
  const [sembakoTab, setSembakoTab] = useState<'data' | 'simpan' | 'hapus'>('data');
  // Save tanggal penerimaan
  const [saveTanggal, setSaveTanggal] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  // ==================== BANSOS FUNCTIONS ====================
  const fetchPenduduk = useCallback(async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';

      // Fetch penduduk tetap
      const resTetap = await apiFetch(`/api/penduduk${params}`);
      const dataTetap: Penduduk[] = resTetap.ok ? await resTetap.json() : [];

      // Fetch penduduk sementara
      const resSem = await apiFetch(`/api/penduduk-sementara${params}`);
      const dataSem: Penduduk[] = resSem.ok ? await resSem.json() : [];

      // Tandai penduduk sementara
      dataSem.forEach(p => { p._isSementara = true; });

      // Gabungkan
      const allData = [...dataTetap, ...dataSem];
      setPenduduk(allData);
      groupByKK(allData);
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
        group = { noKK: p.noKK, kepala: null, anggota: [] };
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

  // Setup database dulu, baru fetch penduduk
  useEffect(() => {
    const init = async () => {
      try {
        await apiFetch('/api/setup-db');
      } catch { /* ignore */ }
      setDbReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (dbReady) fetchPenduduk();
  }, [dbReady, fetchPenduduk]);

  // Listen for data changes from other tabs
  useEffect(() => {
    const handler = () => fetchPenduduk();
    window.addEventListener('sikependudukan-data-changed', handler);
    return () => window.removeEventListener('sikependudukan-data-changed', handler);
  }, [fetchPenduduk]);

  useEffect(() => {
    if (isActive) fetchPenduduk();
  }, [isActive, fetchPenduduk]);

  const toggleExpand = (noKK: string) => {
    const next = new Set(expandedKK);
    if (next.has(noKK)) next.delete(noKK);
    else next.add(noKK);
    setExpandedKK(next);
  };

  // Cek Bansos - copy NIK + open site
  const handleCekBansos = async (p: Penduduk) => {
    try {
      await navigator.clipboard.writeText(p.nik);
      toast.success(`NIK ${p.nik} disalin ke clipboard!`, {
        description: 'Menuju cekbansos.kemensos.go.id...',
        duration: 2000,
      });
      window.open('https://cekbansos.kemensos.go.id/', '_blank');
    } catch {
      // Fallback: select text & open
      toast.success(`NIK: ${p.nik} — silakan salin manual`, { duration: 3000 });
      window.open('https://cekbansos.kemensos.go.id/', '_blank');
    }
  };

  // Update Dialog handlers
  const openUpdateDialog = (p: Penduduk) => {
    setUpdateTarget(p);
    try {
      setUpdateBantuan(JSON.parse(p.bantuan || '[]'));
    } catch {
      setUpdateBantuan([]);
    }
    setUpdateBPJS(p.bpjs || 'TIDAK');
    setUpdateDesil(p.desil || 'TIDAK_ADA');
    setShowUpdateDialog(true);
  };

  const toggleBantuanItem = (item: string) => {
    setUpdateBantuan(prev =>
      prev.includes(item) ? prev.filter(b => b !== item) : [...prev, item],
    );
  };

  const handleUpdate = async () => {
    if (!updateTarget) return;
    setSubmitting(true);

    try {
      const desilValue = updateDesil === 'TIDAK_ADA' ? '' : updateDesil;

      // Desil otomatis disimpan di keterangan
      // Jika ada keterangan lama, gabungkan (pisah dengan koma)
      let keteranganValue = updateTarget.keterangan || '';
      // Hapus desil lama dari keterangan (format: "DESIL X")
      keteranganValue = keteranganValue.replace(/,?\s*DESIL\s*\d+(-\d+)?/gi, '').replace(/^,|,$/g, '').trim();
      // Tambahkan desil baru ke keterangan
      if (desilValue) {
        keteranganValue = keteranganValue ? `${keteranganValue}, ${desilValue}` : desilValue;
      }

      const isSementara = updateTarget._isSementara || false;
      const apiUrl = isSementara ? '/api/penduduk-sementara' : '/api/penduduk';

      // 1. Update penduduk yang dipilih
      const bodyPayload: any = {
        id: updateTarget.id,
        bantuan: updateBantuan,
        bpjs: updateBPJS,
      };
      // Desil hanya untuk penduduk tetap
      if (!isSementara) {
        bodyPayload.desil = desilValue;
        bodyPayload.keterangan = keteranganValue || null;
      }

      const res = await apiFetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        // 2. Otomatis update semua anggota KK dengan data yang sama
        const allPenduduk = await apiFetch(apiUrl).then(r => r.json());
        const anggota = allPenduduk.filter(
          (p: Penduduk) =>
            p.noKK === updateTarget.noKK &&
            p.id !== updateTarget.id,
        );

        let updatedCount = 0;
        for (const a of anggota) {
          const aBody: any = {
            id: a.id,
            bantuan: updateBantuan,
            bpjs: updateBPJS,
          };
          if (!isSementara) {
            let ketAnggota = a.keterangan || '';
            ketAnggota = ketAnggota.replace(/,?\s*DESIL\s*\d+(-\d+)?/gi, '').replace(/^,|,$/g, '').trim();
            if (desilValue) {
              ketAnggota = ketAnggota ? `${ketAnggota}, ${desilValue}` : desilValue;
            }
            aBody.desil = desilValue;
            aBody.keterangan = ketAnggota || null;
          }

          const aRes = await apiFetch(apiUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aBody),
          });
          if (aRes.ok) updatedCount++;
        }

        const info = updatedCount > 0 ? ` + ${updatedCount} anggota KK` : '';
        toast.success(`Data bantuan berhasil diupdate${info}`);
        setShowUpdateDialog(false);
        fetchPenduduk();
        window.dispatchEvent(new CustomEvent('sikependudukan-data-changed'));
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal mengupdate');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const header = 'No,No KK,NIK,Nama Lengkap,Jenis Kelamin,Status Keluarga,Umur,Status Penduduk,Desil,Bantuan,BPJS,Keterangan\n';
    const rows = penduduk.map((p, i) => {
      let umur = { label: '-' };
      try { umur = hitungUmur(p.tanggalLahir); } catch { /* skip */ }
      let bantuanArr: string[] = [];
      try { bantuanArr = JSON.parse(p.bantuan || '[]').filter((b: string) => b !== 'TIDAK' && b !== ''); } catch { /* skip */ }
      const bantuanStr = bantuanArr.join('; ') || '-';
      const bpjsStr = (p.bpjs && p.bpjs !== 'TIDAK') ? p.bpjs : '-';
      const desilStr = (p.desil && p.desil !== 'TIDAK_ADA') ? p.desil : '-';
      const statusStr = p._isSementara ? 'Sementara' : 'Tetap';
      return `${i + 1},"${p.noKK}","${p.nik}","${p.namaLengkap}","${p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}","${p.statusKeluarga}","${umur.label}","${statusStr}","${desilStr}","${bantuanStr}","${bpjsStr}","${p.keterangan || '-'}"`;
    }).join('\n');

    const csv = '\uFEFF' + header + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data_bansos_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('File CSV berhasil didownload');
  };

  // Helper: render bantuan badges
  const renderBantuanBadges = (bantuanStr: string) => {
    let arr: string[] = [];
    try {
      arr = JSON.parse(bantuanStr || '[]').filter((b: string) => b !== 'TIDAK' && b !== '');
    } catch { arr = []; }
    if (arr.length === 0) return <span className="text-gray-400 text-[11px]">-</span>;
    return (
      <div className="flex flex-wrap gap-0.5">
        {arr.map((b: string) => (
          <Badge key={b} className="text-[9px] px-1.5 py-0 bg-orange-100 text-orange-700 hover:bg-orange-100">{b}</Badge>
        ))}
      </div>
    );
  };

  // Helper: render BPJS badge
  const renderBPJSBadge = (bpjs: string | null) => {
    if (!bpjs || bpjs === 'TIDAK') return <span className="text-gray-400 text-[11px]">-</span>;
    return <Badge className="text-[9px] px-1.5 py-0 bg-blue-100 text-blue-700 hover:bg-blue-100">{bpjs}</Badge>;
  };

  // Helper: render desil badge
  const renderDesilBadge = (desil: string | null) => {
    if (!desil || desil === 'TIDAK_ADA') return <span className="text-gray-400 text-[11px]">-</span>;
    return <Badge className="text-[9px] px-1.5 py-0 bg-purple-100 text-purple-700 hover:bg-purple-100">{desil}</Badge>;
  };

  // ==================== SEMBAKO FUNCTIONS ====================
  const fetchSembako = useCallback(async () => {
    setSembakoLoading(true);
    try {
      const res = await apiFetch('/api/sembako');
      if (res.ok) {
        const data: PenerimaSembako[] = await res.json();
        setSembakoData(data);
      }
    } catch (error) {
      console.error('[Sembako] Fetch error:', error);
    } finally {
      setSembakoLoading(false);
    }
  }, []);

  // Fetch sembako when switching to sembako view
  useEffect(() => {
    if (activeView === 'sembako') {
      fetchSembako();
      fetchKKList();
    }
  }, [activeView, fetchSembako]);

  // Fetch KK heads for dropdown
  const fetchKKList = useCallback(async () => {
    try {
      const res = await apiFetch('/api/penduduk');
      if (res.ok) {
        const data: Penduduk[] = await res.json();
        // Ambil semua KK heads, urutkan by nama
        const heads = data
          .filter(p => p.statusKeluarga === 'KEPALA KELUARGA')
          .sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap, 'id', { sensitivity: 'base' }));
        setKKList(heads);
      }
    } catch { /* ignore */ }
  }, []);

  // Handle select No KK from dropdown → show anggota
  const handleSelectKK = useCallback(async (noKK: string) => {
    setSelectedNoKK(noKK);
    if (!noKK) {
      setAnggotaList([]);
      return;
    }
    try {
      const res = await apiFetch(`/api/penduduk?noKK=${encodeURIComponent(noKK)}`);
      if (res.ok) {
        const data: Penduduk[] = await res.json();
        setAnggotaList(data);
        setShowSearchDropdown(true);
      }
    } catch {
      setAnggotaList([]);
    }
  }, []);

  // Search penduduk for sembako addition
  const handleSembakoSearch = useCallback(async (value: string) => {
    setSembakoSearch(value);
    if (value.length < 2) {
      setSembakoSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    setSembakoSearching(true);
    try {
      const res = await apiFetch(`/api/penduduk?search=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data: Penduduk[] = await res.json();
        setSembakoSearchResults(data.slice(0, 20)); // Limit results
        setShowSearchDropdown(data.length > 0);
      }
    } catch {
      setSembakoSearchResults([]);
    } finally {
      setSembakoSearching(false);
    }
  }, []);

  // Add penduduk as penerima sembako
  const handleAddSembako = async (p: Penduduk) => {
    setSembakoAdding(p.nik);
    try {
      const tglLahir = p.tanggalLahir
        ? new Date(p.tanggalLahir).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

      const res = await apiFetch('/api/sembako', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noKK: p.noKK,
          nik: p.nik,
          namaLengkap: p.namaLengkap,
          jenisKelamin: p.jenisKelamin,
          statusKeluarga: p.statusKeluarga,
          tanggalLahir: tglLahir,
          alamat: p.alamat || 'KP. CEMPLANG',
          rt: p.rt || '001',
          rw: p.rw || '002',
        }),
      });

      if (res.ok) {
        toast.success(`${p.namaLengkap} berhasil ditambahkan sebagai penerima sembako`);
        setSembakoSearch('');
        setSembakoSearchResults([]);
        setShowSearchDropdown(false);
        // Hapus KK dari dropdown & reset pilihan
        setKKList(prev => prev.filter(kk => kk.noKK !== p.noKK));
        setSelectedNoKK('');
        setAnggotaList([]);
        fetchSembako();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal menambahkan penerima');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSembakoAdding(null);
    }
  };

  // Delete single sembako recipient
  const handleDeleteSembako = async (id: number, nama: string) => {
    try {
      const res = await apiFetch(`/api/sembako?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`${nama} dihapus dari daftar penerima`);
        fetchSembako();
      } else {
        toast.error('Gagal menghapus');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }
  };

  // Delete all sembako recipients
  const handleDeleteAllSembako = async () => {
    try {
      const res = await apiFetch('/api/sembako?all=true', { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Semua data berhasil dihapus');
        fetchSembako();
      } else {
        toast.error('Gagal menghapus semua data');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }
  };

  // Export sembako Excel
  const handleExportSembako = async () => {
    try {
      const res = await apiFetch('/api/sembako/export');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const today = new Date().toISOString().split('T')[0];
        link.download = `penerima_sembako_desa_${today}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('File Excel berhasil didownload');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal mengekspor data');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }
  };

  // ==================== SEMBAKO SAVE/RIWAYAT FUNCTIONS ====================
  const loadSavedSembako = useCallback(async () => {
    try {
      const res = await apiFetch('/api/sembako/save');
      if (res.ok) setSavedSembako(await res.json());
    } catch (error) {
      console.error('[Sembako Riwayat] Load error:', error);
    }
  }, []);

  // Load saved list when switching to sembako view
  useEffect(() => {
    if (activeView === 'sembako') loadSavedSembako();
  }, [activeView, loadSavedSembako]);

  const handleSimpanSembako = async () => {
    if (sembakoData.length === 0) {
      toast.error('Tidak ada data penerima untuk disimpan');
      return;
    }
    const [year, month, day] = saveTanggal.split('-');
    const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const tanggalStr = `${parseInt(day)} ${monthNames[parseInt(month)]} ${year}`;
    const nama = sembakoSaveName.trim() || `Penerima Sembako ${tanggalStr}`;
    setSembakoSaving(true);
    setSembakoSaveMsg('');
    try {
      const res = await apiFetch('/api/sembako/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama, data: sembakoData }),
      });
      if (res.ok) {
        const result = await res.json();
        setSembakoSaveMsg(`Data berhasil disimpan: ${tanggalStr} (${result.jumlahPenerima} penerima)`);
        setSembakoSaveName('');
        loadSavedSembako();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal menyimpan');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSembakoSaving(false);
    }
  };

  const handleHapusSnapshot = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Hapus data tersimpan ini?')) return;
    try {
      const res = await apiFetch(`/api/sembako/save?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        const result = await res.json();
        toast.success(result.message);
        loadSavedSembako();
        setSembakoSaveMsg(result.message);
      } else {
        toast.error('Gagal menghapus data tersimpan');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }
  };

  const handleLihatSnapshot = async (snapshot: SavedSembako) => {
    try {
      const res = await apiFetch(`/api/sembako/save?id=${snapshot.id}&detail=true`);
      if (!res.ok) {
        toast.error('Gagal memuat data tersimpan');
        return;
      }
      const result = await res.json();
      if (result.data && Array.isArray(result.data)) {
        setSembakoData(result.data);
        toast.success(`Data "${snapshot.nama}" berhasil dimuat (${result.jumlahPenerima} penerima)`);
      } else {
        toast.error('Format data tidak valid');
      }
      setSembakoTab('data');
      setSembakoSaveMsg(`Data dari: ${snapshot.nama}`);
      fetchKKList();
    } catch {
      toast.error('Gagal memuat data tersimpan');
    }
  };

  // Close search dropdown when clicking outside
  useEffect(() => {
    if (!showSearchDropdown) return;
    const handleClick = () => setShowSearchDropdown(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showSearchDropdown]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ==================== VIEW TOGGLE ==================== */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveView('bansos')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeView === 'bansos'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          Data Bansos
        </button>
        <button
          onClick={() => setActiveView('sembako')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeView === 'sembako'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          Penerima Sembako Desa
        </button>
      </div>

      {/* ==================== BANSOS VIEW ==================== */}
      {activeView === 'bansos' && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-emerald-800">Bantuan Sosial & BPJS</h2>
              <Badge variant="secondary" className="text-xs">{penduduk.length} penduduk</Badge>
              <Badge className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700 hover:bg-amber-100">Tetap + Sementara</Badge>
            </div>
            <div className="flex gap-2 items-center">
              <a
                href="https://cekbansos.kemensos.go.id/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                cekbansos.kemensos.go.id
              </a>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleExportCSV}>
                <Download className="h-3 w-3 mr-1" /> Export CSV
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, NIK, No. KK..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* KK List */}
          <ScrollArea className="max-h-[calc(100vh-320px)]">
            <div className="space-y-2">
              {kkGroups.map(group => {
                const isExpanded = expandedKK.has(group.noKK);
                const totalL = (group.kepala?.jenisKelamin === 'LAKI-LAKI' ? 1 : 0) + group.anggota.filter(a => a.jenisKelamin === 'LAKI-LAKI').length;
                const totalP = (group.kepala?.jenisKelamin === 'PEREMPUAN' ? 1 : 0) + group.anggota.filter(a => a.jenisKelamin === 'PEREMPUAN').length;
                const allBantuan = new Set<string>();
                const allMembers = [group.kepala, ...group.anggota].filter(Boolean) as Penduduk[];
                const hasSementara = allMembers.some(p => p._isSementara);
                allMembers.forEach(p => {
                  try {
                    JSON.parse(p.bantuan || '[]').forEach((b: string) => {
                      if (b !== 'TIDAK' && b !== '') allBantuan.add(b);
                    });
                  } catch { /* skip invalid JSON */ }
                });

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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-sm truncate">{group.kepala?.namaLengkap || '-'}</p>
                            <Badge className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">KK</Badge>
                            {hasSementara && (
                              <Badge className="text-[9px] px-1.5 py-0 bg-amber-500 text-white hover:bg-amber-500">SEMENTARA</Badge>
                            )}
                            {allBantuan.size > 0 && (
                              <div className="flex flex-wrap gap-0.5">
                                {Array.from(allBantuan).map(b => (
                                  <Badge key={b} className="text-[8px] px-1 py-0 bg-orange-100 text-orange-700 hover:bg-orange-100">{b}</Badge>
                                ))}
                              </div>
                            )}
                            {group.kepala?.desil && (
                              <Badge className="text-[8px] px-1 py-0 bg-purple-100 text-purple-700 hover:bg-purple-100">{group.kepala.desil}</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            KK: {group.noKK} · NIK: {group.kepala?.nik || '-'}
                          </p>
                        </div>
                        <div className="flex gap-1 items-center shrink-0">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">L:{totalL}</Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">P:{totalP}</Badge>
                        </div>
                      </button>

                      {/* Expanded Members */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50/50">
                          {/* Table Header */}
                          <div className="hidden sm:grid grid-cols-[24px_1fr_60px_36px_52px_1fr_80px_52px] gap-2 px-3 py-1.5 bg-emerald-50 border-b border-emerald-100 text-[10px] font-semibold text-emerald-800">
                            <span>No</span>
                            <span>Nama / NIK</span>
                            <span className="text-center">Status</span>
                            <span className="text-center">JK</span>
                            <span className="text-center">Desil</span>
                            <span className="text-center">Bantuan</span>
                            <span className="text-center">BPJS</span>
                            <span></span>
                          </div>

                          {/* KK Head Row */}
                          {group.kepala && (
                            <PendudukRow
                              penduduk={group.kepala}
                              index={1}
                              isKK
                              isAdmin={isAdmin}
                              onUpdate={openUpdateDialog}
                              onCekBansos={handleCekBansos}
                              renderBantuanBadges={renderBantuanBadges}
                              renderBPJSBadge={renderBPJSBadge}
                              renderDesilBadge={renderDesilBadge}
                            />
                          )}
                          {/* Anggota Rows */}
                          {group.anggota.map((a, idx) => (
                            <PendudukRow
                              key={a.id}
                              penduduk={a}
                              index={idx + 2}
                              isKK={false}
                              isAdmin={isAdmin}
                              onUpdate={openUpdateDialog}
                              onCekBansos={handleCekBansos}
                              renderBantuanBadges={renderBantuanBadges}
                              renderBPJSBadge={renderBPJSBadge}
                              renderDesilBadge={renderDesilBadge}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {kkGroups.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Tidak ada data penduduk</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      )}

      {/* ==================== SEMBAKO VIEW ==================== */}
      {activeView === 'sembako' && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-emerald-800">Penerima Sembako Desa</h2>
              <Badge variant="secondary" className="text-xs">{sembakoData.length} penerima</Badge>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {sembakoTab === 'data' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={handleExportSembako}
                  disabled={sembakoData.length === 0}
                >
                  <Download className="h-3 w-3 mr-1" /> Export Excel
                </Button>
              )}
            </div>
          </div>

          {/* Sub-tabs: Data Penerima | Simpan | Hapus Semua Data */}
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setSembakoTab('data')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sembakoTab === 'data'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                Data Penerima
              </button>
              <button
                onClick={() => setSembakoTab('simpan')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sembakoTab === 'simpan'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Save className="h-3.5 w-3.5" />
                Simpan
              </button>
              <button
                onClick={() => setSembakoTab('hapus')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sembakoTab === 'hapus'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus Semua Data
              </button>
            </div>
          )}

          {/* ==================== TAB: DATA PENERIMA ==================== */}
          {sembakoTab === 'data' && (
            <>
              {/* Search Penduduk for Adding */}
              {isAdmin && (
                <div className="space-y-2">
                  {/* Pilih No KK dari dropdown */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Pilih No. KK</label>
                      <Select value={selectedNoKK} onValueChange={handleSelectKK}>
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="-- Pilih No. KK --" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {kkList.map(kk => (
                            <SelectItem key={kk.noKK} value={kk.noKK} className="text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{kk.namaLengkap}</span>
                                <span className="text-muted-foreground">- {kk.noKK}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Atau cari manual</label>
                      <div className="relative">
                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Cari nama, NIK, No. KK..."
                          value={sembakoSearch}
                          onChange={e => handleSembakoSearch(e.target.value)}
                          onFocus={e => { if (sembakoSearchResults.length > 0) setShowSearchDropdown(true); }}
                          className="pl-9 pr-8 text-xs"
                        />
                        {sembakoSearching && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600" />
                          </div>
                        )}
                        {sembakoSearch && !sembakoSearching && (
                          <button
                            onClick={() => { setSembakoSearch(''); setSembakoSearchResults([]); setShowSearchDropdown(false); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info KK terpilih */}
                  {selectedNoKK && anggotaList.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                      <p className="text-[11px] font-semibold text-emerald-800 mb-1.5">
                        Anggota KK: {anggotaList.find(a => a.statusKeluarga === 'KEPALA KELUARGA')?.namaLengkap} ({selectedNoKK})
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {anggotaList.map(p => {
                          const alreadyAdded = sembakoData.some(s => s.nik === p.nik);
                          return (
                            <div
                              key={p.nik}
                              className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-md border border-emerald-100"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium truncate">{p.namaLengkap}</span>
                                  <Badge className="text-[8px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                    {p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}
                                  </Badge>
                                  <Badge className="text-[8px] px-1 py-0 bg-gray-100 text-gray-600 hover:bg-gray-100">
                                    {p.statusKeluarga}
                                  </Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground">NIK: {p.nik}</p>
                              </div>
                              {alreadyAdded ? (
                                <Badge className="text-[9px] px-1.5 py-0 bg-gray-100 text-gray-400 shrink-0">Sudah Ada</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 shrink-0"
                                  onClick={() => handleAddSembako(p)}
                                  disabled={sembakoAdding === p.nik}
                                >
                                  {sembakoAdding === p.nik ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3 mr-0.5" />
                                      Tambah
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Search Dropdown (manual search) */}
                  {showSearchDropdown && sembakoSearchResults.length > 0 && !selectedNoKK && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {sembakoSearchResults.map(p => {
                        const alreadyAdded = sembakoData.some(s => s.nik === p.nik);
                        return (
                          <div
                            key={p.nik}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-emerald-50 border-b border-gray-50 last:border-b-0"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium truncate">{p.namaLengkap}</span>
                                <Badge className="text-[8px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                  {p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}
                                </Badge>
                                <Badge className="text-[8px] px-1 py-0 bg-gray-100 text-gray-600 hover:bg-gray-100">
                                  {p.statusKeluarga}
                                </Badge>
                                {p._isSementara && (
                                  <Badge className="text-[8px] px-1 py-0 bg-amber-500 text-white hover:bg-amber-500">SEM</Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                NIK: {p.nik} · KK: {p.noKK}
                              </p>
                            </div>
                            {alreadyAdded ? (
                              <Badge className="text-[9px] px-1.5 py-0 bg-gray-100 text-gray-400 shrink-0">Sudah Ada</Badge>
                            ) : (
                              <Button
                                size="sm"
                                className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 shrink-0"
                                onClick={() => handleAddSembako(p)}
                                disabled={sembakoAdding === p.nik}
                              >
                                {sembakoAdding === p.nik ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                                ) : (
                                  <>
                                    <Plus className="h-3 w-3 mr-0.5" />
                                    Tambah
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sembako Recipient List */}
              <ScrollArea className="max-h-[calc(100vh-380px)]">
                {sembakoLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                  </div>
                ) : sembakoData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground space-y-2">
                    <Package className="h-10 w-10 mx-auto text-gray-300" />
                    <p className="text-sm">Belum ada data penerima sembako desa</p>
                    {isAdmin && (
                      <p className="text-[11px]">Gunakan pencarian di atas untuk menambah penduduk</p>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      {/* Desktop Table */}
                      <div className="hidden sm:block">
                        {/* Table Header */}
                        <div className="grid grid-cols-[32px_1fr_1fr_52px_72px_1fr_40px] gap-2 px-3 py-2 bg-emerald-50 border-b border-emerald-100 text-[10px] font-semibold text-emerald-800">
                          <span>No</span>
                          <span>No KK</span>
                          <span>Nama Lengkap</span>
                          <span className="text-center">JK</span>
                          <span>Status KK</span>
                          <span>Alamat</span>
                          <span></span>
                        </div>
                        {sembakoData.map((s, i) => (
                          <div
                            key={s.id}
                            className="grid grid-cols-[32px_1fr_1fr_52px_72px_1fr_40px] gap-2 items-center px-3 py-2 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-[11px] text-muted-foreground">{i + 1}</span>
                            <div>
                              <span className="text-[10px] text-muted-foreground font-mono">{s.noKK}</span>
                              <p className="text-[10px] text-muted-foreground font-mono">{s.nik}</p>
                            </div>
                            <span className="text-xs font-medium truncate">{s.namaLengkap}</span>
                            <span className="text-[10px] text-center">
                              <Badge className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                {s.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}
                              </Badge>
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">{s.statusKeluarga}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{s.alamat}</span>
                            {isAdmin && (
                              <div className="shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteSembako(s.id, s.namaLengkap)}
                                  title="Hapus"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Mobile Cards */}
                      <div className="sm:hidden divide-y divide-gray-50">
                        {sembakoData.map((s, i) => (
                          <div key={s.id} className="px-3 py-2.5 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground">{i + 1}.</span>
                                  <span className="text-xs font-medium truncate">{s.namaLengkap}</span>
                                  <Badge className="text-[8px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                    {s.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}
                                  </Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{s.nik}</p>
                                <p className="text-[10px] text-muted-foreground">{s.statusKeluarga}</p>
                              </div>
                              {isAdmin && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-500 shrink-0"
                                  onClick={() => handleDeleteSembako(s.id, s.namaLengkap)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <div className="mt-1 pl-4">
                              <p className="text-[10px] text-muted-foreground">KK: {s.noKK}</p>
                              <p className="text-[10px] text-muted-foreground">{s.alamat} - RT {s.rt}/RW {s.rw}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </ScrollArea>
            </>
          )}

          {/* ==================== TAB: SIMPAN ==================== */}
          {sembakoTab === 'simpan' && (
            <>
              {/* Simpan Data Sembako */}
              <Card className="border-emerald-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Save className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-emerald-800">Simpan Data Penerima Sembako</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">Tanggal Penerimaan</Label>
                        <Input
                          type="date"
                          value={saveTanggal}
                          onChange={e => setSaveTanggal(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">Keterangan (opsional)</Label>
                        <Input
                          placeholder="Contoh: Sembako Ramadhan 2026"
                          value={sembakoSaveName}
                          onChange={e => setSembakoSaveName(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleSimpanSembako}
                      disabled={sembakoSaving || sembakoData.length === 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs w-full sm:w-auto"
                    >
                      {sembakoSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      {sembakoSaving ? 'Menyimpan...' : `Simpan ${sembakoData.length} Data Penerima`}
                    </Button>
                  </div>
                  {sembakoSaveMsg && (
                    <div className={`mt-2 text-xs flex items-center gap-1 ${sembakoSaveMsg.includes('berhasil') || sembakoSaveMsg.includes('Data dari') ? 'text-emerald-600' : 'text-red-500'}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {sembakoSaveMsg}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Simpan data penerima saat ini berdasarkan tanggal penerimaan. Daftar penerima akan berubah setiap periode, sehingga data perlu disimpan untuk setiap periode penerimaan.
                  </p>
                </CardContent>
              </Card>

              {/* Riwayat Data Tersimpan */}
              <Card className="border-emerald-200">
                <CardContent className="p-3">
                  <h3 className="text-sm font-semibold text-emerald-800 mb-2">Riwayat Data Tersimpan</h3>
                  {savedSembako.length === 0 ? (
                    <p className="text-xs text-gray-500">Belum ada data sembako yang tersimpan.</p>
                  ) : (
                    <div className="space-y-1">
                      {savedSembako.map(s => (
                        <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="font-medium">{s.nama}</span>
                            <Badge className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{s.jumlahPenerima} penerima</Badge>
                            <span className="text-gray-400">
                              (disimpan: {new Date(s.updatedAt).toLocaleDateString('id-ID')})
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]" onClick={() => handleLihatSnapshot(s)}>
                              <Eye className="h-3 w-3 mr-0.5" /> Muat
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-red-500 hover:text-red-700" onClick={(e) => handleHapusSnapshot(s.id, e)}>
                              <Trash2 className="h-3 w-3 mr-0.5" /> Hapus
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* ==================== TAB: HAPUS SEMUA DATA ==================== */}
          {sembakoTab === 'hapus' && (
            <Card className="border-red-200">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  <h3 className="text-sm font-semibold text-red-700">Hapus Semua Data Penerima Sembako</h3>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">{sembakoData.length}</Badge>
                    <p className="text-xs text-red-700 font-medium">data penerima saat ini</p>
                  </div>
                  <p className="text-[11px] text-red-600">
                    Tindakan ini akan menghapus semua data penerima sembako desa yang saat ini aktif.
                    Data yang sudah disimpan di riwayat tidak akan terhapus.
                  </p>
                  <p className="text-[11px] text-red-600 font-medium">
                    Data yang dihapus tidak dapat dikembalikan. Pastikan data sudah disimpan terlebih dahulu.
                  </p>
                </div>
                {sembakoData.length > 0 ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="bg-red-600 hover:bg-red-700 text-xs w-full sm:w-auto">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Hapus Semua {sembakoData.length} Data Penerima
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Hapus Semua Data</AlertDialogTitle>
                        <AlertDialogDescription>
                          Anda yakin ingin menghapus semua {sembakoData.length} data penerima sembako desa? Data yang dihapus tidak dapat dikembalikan. Pastikan Anda sudah menyimpan data yang diperlukan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => { handleDeleteAllSembako(); }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Ya, Hapus Semua
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-xs">Tidak ada data penerima untuk dihapus.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ==================== UPDATE DIALOG ==================== */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-emerald-600" />
              Update Bantuan & BPJS
            </DialogTitle>
          </DialogHeader>

          {updateTarget && (
            <div className="space-y-4">
              {/* Info penduduk */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-semibold">{updateTarget.namaLengkap}</p>
                <p className="text-[11px] text-muted-foreground">
                  NIK: {updateTarget.nik} · KK: {updateTarget.noKK}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {updateTarget.statusKeluarga} · {hitungUmur(updateTarget.tanggalLahir).label}
                </p>
              </div>

              {/* Desil */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Desil</Label>
                <Select value={updateDesil || 'TIDAK_ADA'} onValueChange={setUpdateDesil}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Pilih Desil..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIDAK_ADA">-- Tidak Ada --</SelectItem>
                    {DESIL_OPTIONS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Desil 1-5: keluarga paling tidak mampu. Desil 6-10: mampu.
                </p>
              </div>

              {/* Bantuan */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Jenis Bantuan</Label>
                <div className="flex flex-wrap gap-2">
                  {BANTUAN_OPTIONS.map(b => (
                    <label key={b} className="flex items-center gap-1.5 cursor-pointer bg-gray-50 hover:bg-emerald-50 rounded-lg px-3 py-2 transition-colors border">
                      <Checkbox
                        checked={updateBantuan.includes(b)}
                        onCheckedChange={() => toggleBantuanItem(b)}
                      />
                      <span className="text-xs">{b}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* BPJS */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">BPJS</Label>
                <Select value={updateBPJS} onValueChange={setUpdateBPJS}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Pilih BPJS..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BPJS_OPTIONS.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Info auto-propagate */}
              <div className="flex items-center gap-2 bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                <CheckCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-[11px] text-emerald-800">
                  Desil akan otomatis disimpan di <strong>keterangan</strong> dan diterapkan ke <strong>semua anggota KK</strong> ({kkGroups.find(g => g.noKK === updateTarget.noKK)?.anggota.length || 0} anggota)
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => setShowUpdateDialog(false)}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleUpdate}
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <>
                      <CheckCheck className="h-3.5 w-3.5 mr-1" />
                      Simpan
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== PENDUDUK ROW COMPONENT ====================
interface PendudukRowProps {
  penduduk: Penduduk;
  index: number;
  isKK: boolean;
  isAdmin: boolean;
  onUpdate: (p: Penduduk) => void;
  onCekBansos: (p: Penduduk) => void;
  renderBantuanBadges: (bantuanStr: string) => React.ReactNode;
  renderBPJSBadge: (bpjs: string | null) => React.ReactNode;
  renderDesilBadge: (desil: string | null) => React.ReactNode;
}

function PendudukRow({
  penduduk: p,
  index,
  isKK,
  isAdmin,
  onUpdate,
  onCekBansos,
  renderBantuanBadges,
  renderBPJSBadge,
  renderDesilBadge,
}: PendudukRowProps) {
  let umur = { label: '-' };
  try { umur = hitungUmur(p.tanggalLahir); } catch { /* skip */ }

  return (
    <div className={`border-b border-gray-100 last:border-b-0 hover:bg-white transition-colors${p._isSementara ? ' bg-amber-50/40' : ''}`}>
      {/* Desktop: Grid Row */}
      <div className="hidden sm:grid grid-cols-[24px_1fr_60px_36px_52px_1fr_80px_52px] gap-2 items-center px-3 py-2">
        <span className="text-[11px] text-muted-foreground">{index}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">{p.namaLengkap}</span>
            {isKK && (
              <Badge className="text-[8px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">KK</Badge>
            )}
            {p._isSementara && (
              <Badge className="text-[8px] px-1.5 py-0 bg-amber-500 text-white hover:bg-amber-500">SEM</Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">{p.nik}</p>
        </div>
        <span className="text-[10px] text-muted-foreground text-center">{p.statusKeluarga}</span>
        <span className="text-[10px] text-center">{p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}</span>
        <div className="text-center">{renderDesilBadge(p.desil)}</div>
        <div>{renderBantuanBadges(p.bantuan)}</div>
        <div className="text-center">{renderBPJSBadge(p.bpjs)}</div>
        {isAdmin && (
          <div className="flex gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
              onClick={() => onCekBansos(p)}
              title="Cek Bansos (salin NIK + buka situs)"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
              onClick={() => onUpdate(p)}
              title="Update Bantuan"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Mobile: Card Row */}
      <div className="sm:hidden px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-muted-foreground">{index}.</span>
            <span className="text-xs font-medium truncate">{p.namaLengkap}</span>
            {isKK && (
              <Badge className="text-[8px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">KK</Badge>
            )}
            {p._isSementara && (
              <Badge className="text-[8px] px-1.5 py-0 bg-amber-500 text-white hover:bg-amber-500">SEM</Badge>
            )}
          </div>
          {isAdmin && (
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-blue-600"
                onClick={() => onCekBansos(p)}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-emerald-600"
                onClick={() => onUpdate(p)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground font-mono pl-4">{p.nik}</p>
        <div className="flex items-center gap-2 pl-4 flex-wrap">
          <span className="text-[10px] text-muted-foreground">{p.statusKeluarga}</span>
          <span className="text-gray-300">|</span>
          <span className="text-[10px]">{p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}</span>
          <span className="text-gray-300">|</span>
          <span className="text-[10px]">{umur.label}</span>
        </div>
        <div className="flex items-center gap-1.5 pl-4 flex-wrap">
          {renderDesilBadge(p.desil)}
          {renderBantuanBadges(p.bantuan)}
          {renderBPJSBadge(p.bpjs)}
        </div>
      </div>
    </div>
  );
}
