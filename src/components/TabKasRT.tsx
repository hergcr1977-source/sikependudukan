'use client';

import { useEffect, useState, useCallback } from 'react';
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
import {
  Plus, Pencil, Trash2, Wallet, ArrowUpCircle, ArrowDownCircle,
  TrendingUp, Download, ChevronDown, ChevronUp, Filter, Save,
  Archive, Eye, CheckCircle2, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { BULAN } from '@/lib/constants';
import { apiFetch } from '@/lib/api';
import * as XLSX from 'xlsx';

interface KasEntry {
  id: number;
  tanggal: string;
  jenis: string;
  jumlah: number;
  keterangan: string;
  createdAt: string;
  updatedAt: string;
}

interface BackupItem {
  id: number;
  bulan: number;
  tahun: number;
  label: string;
  summary: {
    totalPemasukan?: number;
    totalPengeluaran?: number;
    saldo?: number;
    jumlahTransaksi?: number;
    transactions?: any[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface TabKasRTProps {
  isAdmin?: boolean;
  isActive?: boolean;
}

function formatRupiah(angka: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(angka);
}

function formatTanggal(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export default function TabKasRT({ isAdmin = true, isActive = false }: TabKasRTProps) {
  const now = new Date();
  const [data, setData] = useState<KasEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formType, setFormType] = useState<'PEMASUKAN' | 'PENGELUARAN'>('PEMASUKAN');
  const [formTanggal, setFormTanggal] = useState(now.toISOString().split('T')[0]);
  const [formJumlah, setFormJumlah] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KasEntry | null>(null);
  const [savingBackup, setSavingBackup] = useState(false);
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [backupList, setBackupList] = useState<BackupItem[]>([]);
  const [viewingBackup, setViewingBackup] = useState<BackupItem | null>(null);
  const [loadingBackup, setLoadingBackup] = useState(false);

  // Filter
  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1));
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()));
  const [showFilter, setShowFilter] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('bulan', filterBulan);
      params.set('tahun', filterTahun);
      const res = await apiFetch(`/api/kas-rt?${params}`);
      if (res.ok) {
        const result = await res.json();
        // Sort berdasarkan tanggal
        const sorted = sortAsc
          ? result.sort((a: KasEntry, b: KasEntry) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
          : result.sort((a: KasEntry, b: KasEntry) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
        setData(sorted);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filterBulan, filterTahun, sortAsc]);

  // Setup database dulu, baru fetch data
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
    if (dbReady) fetchData();
  }, [dbReady, fetchData]);

  // Listen for data changes
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('sikependudukan-data-changed', handler);
    return () => window.removeEventListener('sikependudukan-data-changed', handler);
  }, [fetchData]);

  useEffect(() => {
    if (isActive) fetchData();
  }, [isActive, fetchData]);

  // Calculate totals
  const totalPemasukan = data
    .filter(d => d.jenis === 'PEMASUKAN')
    .reduce((sum, d) => sum + d.jumlah, 0);
  const totalPengeluaran = data
    .filter(d => d.jenis === 'PENGELUARAN')
    .reduce((sum, d) => sum + d.jumlah, 0);
  const saldo = totalPemasukan - totalPengeluaran;

  // Jumlah transaksi
  const jumlahPemasukan = data.filter(d => d.jenis === 'PEMASUKAN').length;
  const jumlahPengeluaran = data.filter(d => d.jenis === 'PENGELUARAN').length;

  const openAddForm = (type: 'PEMASUKAN' | 'PENGELUARAN') => {
    setEditingId(null);
    setFormError('');
    setFormType(type);
    setFormTanggal(now.toISOString().split('T')[0]);
    setFormJumlah('');
    setFormKeterangan('');
    setShowForm(true);
  };

  const openEditForm = (entry: KasEntry) => {
    setEditingId(entry.id);
    setFormError('');
    setFormType(entry.jenis as 'PEMASUKAN' | 'PENGELUARAN');
    setFormTanggal(entry.tanggal.split('T')[0]);
    setFormJumlah(String(entry.jumlah));
    setFormKeterangan(entry.keterangan);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!formTanggal) {
      setFormError('Tanggal wajib diisi');
      return;
    }
    if (!formJumlah || Number(formJumlah) <= 0) {
      setFormError('Jumlah harus lebih dari 0');
      return;
    }

    setSubmitting(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId
        ? { tanggal: formTanggal, jenis: formType, jumlah: Number(formJumlah), keterangan: formKeterangan }
        : { tanggal: formTanggal, jenis: formType, jumlah: Number(formJumlah), keterangan: formKeterangan };

      const url = editingId ? `/api/kas-rt/${editingId}` : '/api/kas-rt';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editingId ? 'Data kas berhasil diupdate' : `${formType === 'PEMASUKAN' ? 'Pemasukan' : 'Pengeluaran'} berhasil ditambahkan`);
        setShowForm(false);
        fetchData();
        window.dispatchEvent(new CustomEvent('sikependudukan-data-changed'));
      } else {
        const err = await res.json();
        setFormError(err.error || 'Gagal menyimpan');
      }
    } catch {
      setFormError('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiFetch(`/api/kas-rt/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Data kas berhasil dihapus');
        setDeleteTarget(null);
        fetchData();
        window.dispatchEvent(new CustomEvent('sikependudukan-data-changed'));
      }
    } catch {
      toast.error('Gagal menghapus data');
    }
  };

  const loadBackupList = async () => {
    try {
      const res = await apiFetch('/api/kas-rt/backup');
      if (res.ok) {
        const data = await res.json();
        setBackupList(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error(error);
      setBackupList([]);
    }
  };

  useEffect(() => {
    loadBackupList();
  }, []);

  useEffect(() => {
    if (isActive) loadBackupList();
  }, [isActive]);

  const handleSaveBackup = async () => {
    setSavingBackup(true);
    try {
      const res = await apiFetch('/api/kas-rt/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulan: Number(filterBulan), tahun: Number(filterTahun) }),
      });
      if (res.ok) {
        toast.success('Backup kas berhasil disimpan');
        loadBackupList();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Gagal menyimpan backup', { duration: 8000 });
      }
    } catch (e) {
      console.error('Save backup error:', e);
      toast.error('Gagal menyimpan backup');
    } finally {
      setSavingBackup(false);
    }
  };

  const handleDeleteBackup = async (id: number) => {
    if (!confirm('Hapus backup ini?')) return;
    try {
      const res = await apiFetch(`/api/kas-rt/backup?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Backup berhasil dihapus');
        loadBackupList();
        if (viewingBackup?.id === id) setViewingBackup(null);
      }
    } catch {
      toast.error('Gagal menghapus backup');
    }
  };

  const handleRestoreBackup = (backup: BackupItem) => {
    if (!backup.summary?.transactions) return;
    const restored: KasEntry[] = backup.summary.transactions.map((t: any) => ({
      id: t.id || 0,
      tanggal: t.tanggal,
      jenis: t.jenis,
      jumlah: Number(t.jumlah),
      keterangan: t.keterangan || '',
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: t.updatedAt || new Date().toISOString(),
    }));
    setData(restored);
    setViewingBackup(null);
    setShowRiwayat(false);
    toast.success(`Data backup ${backup.label} berhasil ditampilkan`);
  };

  const handleExportExcel = () => {
    const headers = ['No', 'Tanggal', 'Jenis', 'Jumlah', 'Keterangan'];
    const rows = data.map((d, i) => [
      i + 1, formatTanggal(d.tanggal), d.jenis === 'PEMASUKAN' ? 'Pemasukan' : 'Pengeluaran', d.jumlah, d.keterangan,
    ]);

    // Tambahkan baris total
    rows.push([]);
    rows.push(['', '', 'TOTAL PEMASUKAN', totalPemasukan, '']);
    rows.push(['', '', 'TOTAL PENGELUARAN', totalPengeluaran, '']);
    rows.push(['', '', 'SALDO', saldo, '']);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kas RT');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const bulanName = BULAN[parseInt(filterBulan) - 1];
    link.download = `Kas_RT_${bulanName}_${filterTahun}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('File Excel berhasil didownload');
  };

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
          <Wallet className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-emerald-800">Kas RT</h2>
          <Badge variant="secondary" className="text-xs">{data.length} transaksi</Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRiwayat(!showRiwayat)}
              className="text-xs gap-1"
            >
              <Archive className="h-3.5 w-3.5" />
              Riwayat ({backupList.length})
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleSaveBackup} disabled={savingBackup}>
              <Save className="h-3.5 w-3.5 mr-1" />
              {savingBackup ? 'Menyimpan...' : 'Simpan'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export Excel
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => openAddForm('PEMASUKAN')}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <ArrowUpCircle className="h-4 w-4 mr-1" /> Pemasukan
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => openAddForm('PENGELUARAN')}
            >
              <ArrowDownCircle className="h-4 w-4 mr-1" /> Pengeluaran
            </Button>
          )}
        </div>
      </div>

      {/* Riwayat Backup */}
      {showRiwayat && (
        <Card className="border-emerald-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-emerald-800">Riwayat Backup Kas</h3>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]" onClick={() => setShowRiwayat(false)}>
                Tutup
              </Button>
            </div>
            {backupList.length === 0 ? (
              <p className="text-xs text-gray-500">Belum ada backup tersimpan. Klik &quot;Simpan&quot; untuk menyimpan data kas saat ini.</p>
            ) : (
              <div className="space-y-1">
                {backupList.filter(b => b && b.id).map(b => {
                  const summary = b.summary || {};
                  return (
                    <div key={b.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-50 rounded px-2 py-1.5 text-xs gap-1">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="font-medium truncate">{b.label || '-'}</span>
                        {summary.jumlahTransaksi !== undefined && (
                          <span className="text-gray-400 shrink-0">
                            ({summary.jumlahTransaksi || 0} transaksi · Saldo: {formatRupiah(summary.saldo || 0)})
                          </span>
                        )}
                        <span className="text-gray-400 shrink-0">
                          disimpan: {b.updatedAt ? new Date(b.updatedAt).toLocaleDateString('id-ID') : '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {summary.transactions && summary.transactions.length > 0 && (
                          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-blue-600 hover:text-blue-800" onClick={() => handleRestoreBackup(b)}>
                            <RotateCcw className="h-3 w-3 mr-0.5" /> Tampilkan
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-red-500 hover:text-red-700" onClick={() => handleDeleteBackup(b.id)}>
                          <Trash2 className="h-3 w-3 mr-0.5" /> Hapus
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-600 transition-colors"
            >
              <Filter className="h-4 w-4" />
              <span>Filter Periode</span>
              {showFilter ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="text-xs text-muted-foreground hover:text-emerald-600 flex items-center gap-1"
              title={sortAsc ? 'Urutkan terlama' : 'Urutkan terbaru'}
            >
              {sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>{sortAsc ? 'Terlama' : 'Terbaru'}</span>
            </button>
          </div>

          {showFilter && (
            <div className="flex gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Bulan</label>
                <Select value={filterBulan} onValueChange={setFilterBulan}>
                  <SelectTrigger className="w-32 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Semua</SelectItem>
                    {BULAN.map((b, i) => (
                      <SelectItem key={b} value={String(i + 1)}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Tahun</label>
                <Select value={filterTahun} onValueChange={setFilterTahun}>
                  <SelectTrigger className="w-24 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-[10px] font-semibold text-emerald-700">PEMASUKAN</span>
            </div>
            <p className="text-sm font-bold text-emerald-700">{formatRupiah(totalPemasukan)}</p>
            <p className="text-[10px] text-emerald-600">{jumlahPemasukan} transaksi</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <ArrowDownCircle className="h-4 w-4 text-red-500" />
              <span className="text-[10px] font-semibold text-red-700">PENGELUARAN</span>
            </div>
            <p className="text-sm font-bold text-red-700">{formatRupiah(totalPengeluaran)}</p>
            <p className="text-[10px] text-red-600">{jumlahPengeluaran} transaksi</p>
          </CardContent>
        </Card>
        <Card className={`border-blue-200 ${saldo >= 0 ? 'bg-blue-50/50' : 'bg-orange-50/50'}`}>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className={`h-4 w-4 ${saldo >= 0 ? 'text-blue-600' : 'text-orange-500'}`} />
              <span className={`text-[10px] font-semibold ${saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>SALDO</span>
            </div>
            <p className={`text-sm font-bold ${saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatRupiah(saldo)}</p>
            <p className={`text-[10px] ${saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {saldo >= 0 ? 'Surplus' : 'Defisit'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Data Kas RT */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[calc(100vh-420px)]">
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-[40px_100px_1fr_120px_1fr_70px] gap-0 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-600 uppercase tracking-wider sticky top-0 z-10">
              <span>No</span>
              <span>Tanggal</span>
              <span>Keterangan</span>
              <span className="text-right">Jumlah</span>
              <span>Jenis</span>
              <span className="text-center">Aksi</span>
            </div>

            {/* Table Rows */}
            {data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Belum ada data kas</p>
                <p className="text-xs mt-1">
                  Klik &quot;Pemasukan&quot; atau &quot;Pengeluaran&quot; untuk menambahkan data
                </p>
              </div>
            ) : (
              data.map((entry, index) => (
                <div key={entry.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/80 transition-colors">
                  {/* Desktop Row */}
                  <div className="hidden sm:grid grid-cols-[40px_100px_1fr_120px_1fr_70px] gap-0 px-3 py-2.5 items-center">
                    <span className="text-[11px] text-muted-foreground">{index + 1}</span>
                    <span className="text-[11px] text-gray-700">{formatTanggal(entry.tanggal)}</span>
                    <span className="text-xs text-gray-900 truncate" title={entry.keterangan}>
                      {entry.keterangan || '-'}
                    </span>
                    <div className="text-right">
                      <span className={`text-xs font-semibold ${entry.jenis === 'PEMASUKAN' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {entry.jenis === 'PEMASUKAN' ? '+' : '-'}{formatRupiah(entry.jumlah)}
                      </span>
                    </div>
                    <div className="flex justify-center">
                      <Badge
                        className={`text-[9px] px-2 py-0 ${
                          entry.jenis === 'PEMASUKAN'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                            : 'bg-red-100 text-red-800 hover:bg-red-100'
                        }`}
                      >
                        {entry.jenis === 'PEMASUKAN' ? 'Masuk' : 'Keluar'}
                      </Badge>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => openEditForm(entry)}
                          className="p-1 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-800 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(entry)}
                          className="p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Mobile Row */}
                  <div className="sm:hidden px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] text-muted-foreground">{index + 1}.</span>
                        <Badge
                          className={`text-[9px] px-1.5 py-0 ${
                            entry.jenis === 'PEMASUKAN'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-red-100 text-red-800 hover:bg-red-100'
                          }`}
                        >
                          {entry.jenis === 'PEMASUKAN' ? 'Masuk' : 'Keluar'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{formatTanggal(entry.tanggal)}</span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEditForm(entry)} className="p-1 text-blue-600">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(entry)} className="p-1 text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-900 truncate">{entry.keterangan || '-'}</p>
                    <p className={`text-sm font-bold ${entry.jenis === 'PEMASUKAN' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {entry.jenis === 'PEMASUKAN' ? '+' : '-'}{formatRupiah(entry.jumlah)}
                    </p>
                  </div>
                </div>
              ))
            )}

            {/* Table Footer - Totals */}
            {data.length > 0 && (
              <div className="bg-gray-50 border-t-2 border-gray-300">
                <div className="hidden sm:grid grid-cols-[40px_100px_1fr_120px_1fr_70px] gap-0 px-3 py-2.5 items-center">
                  <span />
                  <span />
                  <span className="text-xs font-bold text-gray-700">TOTAL PEMASUKAN</span>
                  <span className="text-xs font-bold text-emerald-700 text-right">{formatRupiah(totalPemasukan)}</span>
                  <span />
                  <span />
                </div>
                <div className="sm:hidden px-3 py-1.5 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700">TOTAL PEMASUKAN</span>
                  <span className="text-xs font-bold text-emerald-700">{formatRupiah(totalPemasukan)}</span>
                </div>
                <div className="hidden sm:grid grid-cols-[40px_100px_1fr_120px_1fr_70px] gap-0 px-3 py-2.5 items-center">
                  <span />
                  <span />
                  <span className="text-xs font-bold text-gray-700">TOTAL PENGELUARAN</span>
                  <span className="text-xs font-bold text-red-700 text-right">{formatRupiah(totalPengeluaran)}</span>
                  <span />
                  <span />
                </div>
                <div className="sm:hidden px-3 py-1.5 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700">TOTAL PENGELUARAN</span>
                  <span className="text-xs font-bold text-red-700">{formatRupiah(totalPengeluaran)}</span>
                </div>
                <div className={`grid sm:grid-cols-[40px_100px_1fr_120px_1fr_70px] gap-0 px-3 py-2.5 items-center ${saldo >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                  <span />
                  <span />
                  <span className="text-xs font-bold text-gray-800">SALDO</span>
                  <span className={`text-xs font-bold text-right ${saldo >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                    {formatRupiah(saldo)}
                  </span>
                  <span />
                  <span />
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ==================== FORM DIALOG ==================== */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingId ? (
                <>
                  <Pencil className="h-4 w-4 text-emerald-600" />
                  Edit Data Kas
                </>
              ) : formType === 'PEMASUKAN' ? (
                <>
                  <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                  Tambah Pemasukan
                </>
              ) : (
                <>
                  <ArrowDownCircle className="h-4 w-4 text-red-500" />
                  Tambah Pengeluaran
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded">{formError}</div>
            )}

            {!editingId && (
              <div className="space-y-1">
                <Label className="text-xs">Jenis Transaksi</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('PEMASUKAN')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border-2 p-2.5 text-xs font-semibold transition-all ${
                      formType === 'PEMASUKAN'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('PENGELUARAN')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border-2 p-2.5 text-xs font-semibold transition-all ${
                      formType === 'PENGELUARAN'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <ArrowDownCircle className="h-4 w-4" />
                    Pengeluaran
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Tanggal *</Label>
              <Input
                type="date"
                className="text-sm"
                value={formTanggal}
                onChange={e => setFormTanggal(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                {formType === 'PEMASUKAN' ? 'Keterangan Asal Pemasukan' : 'Keterangan Tujuan Pengeluaran'} *
              </Label>
              <Input
                className="text-sm uppercase"
                placeholder={formType === 'PEMASUKAN' ? 'Contoh: Iuran warga bulanan' : 'Contoh: Pembelian alat kebersihan'}
                value={formKeterangan}
                onChange={e => setFormKeterangan(e.target.value.toUpperCase())}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Jumlah (Rp) *</Label>
              <Input
                type="number"
                className="text-sm text-right font-mono text-lg"
                placeholder="0"
                value={formJumlah}
                onChange={e => setFormJumlah(e.target.value.replace(/[^0-9]/g, ''))}
                min="1"
              />
              {formJumlah && Number(formJumlah) > 0 && (
                <p className={`text-xs font-medium ${formType === 'PEMASUKAN' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatRupiah(Number(formJumlah))}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className={`flex-1 ${
                  formType === 'PEMASUKAN'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? 'Menyimpan...' : editingId ? 'Simpan' : 'Tambah'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== DELETE DIALOG ==================== */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Kas?</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus data <strong>{deleteTarget?.keterangan}</strong> senilai{' '}
              <strong>{deleteTarget ? formatRupiah(deleteTarget.jumlah) : ''}</strong> ({deleteTarget?.tanggal.split('T')[0]})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
