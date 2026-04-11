'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Search,
  Shield,
  ExternalLink,
  CheckCircle,
  Copy,
  Users,
  Pencil,
  Info,
  Download,
  Eye,
  ListFilter,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X,
  UserCheck,
  AlertTriangle,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';
import { BANTUAN_OPTIONS, BPJS_OPTIONS } from '@/lib/constants';
import { hitungUmur } from '@/lib/utils-kependudukan';

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
  keterangan: string | null;
}

interface TabBantuanProps {
  isAdmin?: boolean;
}

type SectionType = 'cek' | 'daftar' | 'rekap' | 'bpjs';

export default function TabBantuan({ isAdmin = true }: TabBantuanProps) {
  const [penduduk, setPenduduk] = useState<Penduduk[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionType>('daftar');
  const [filterBantuan, setFilterBantuan] = useState('');
  const [filterBPJS, setFilterBPJS] = useState('');
  const [filterKK, setFilterKK] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [expandKK, setExpandKK] = useState<string | null>(null);
  const [showKKOnly, setShowKKOnly] = useState(false);

  // Update Dialog
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<Penduduk | null>(null);
  const [updateBantuan, setUpdateBantuan] = useState<string[]>([]);
  const [updateBPJS, setUpdateBPJS] = useState('');
  const [updateAnggotaToo, setUpdateAnggotaToo] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Detail Dialog
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Penduduk | null>(null);

  const fetchPenduduk = useCallback(async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/penduduk${params}`);
      if (res.ok) {
        const data = await res.json();
        setPenduduk(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchPenduduk();
  }, [fetchPenduduk]);

  // Group penduduk by KK
  const kkGroups = useMemo(() => {
    const groups = new Map<string, Penduduk[]>();
    for (const p of penduduk) {
      const list = groups.get(p.noKK) || [];
      list.push(p);
      groups.set(p.noKK, list);
    }
    return groups;
  }, [penduduk]);

  // Filtered penduduk
  const filteredPenduduk = useMemo(() => {
    return penduduk.filter(p => {
      // Filter bantuan
      if (filterBantuan && filterBantuan !== 'ALL') {
        const arr = JSON.parse(p.bantuan || '[]');
        if (filterBantuan === 'TIDAK') {
          if (arr.length > 0 && !arr.includes('TIDAK')) return false;
        } else {
          if (!arr.includes(filterBantuan)) return false;
        }
      }
      // Filter BPJS
      if (filterBPJS && filterBPJS !== 'ALL') {
        if (filterBPJS === 'TIDAK') {
          if (p.bpjs && p.bpjs !== 'TIDAK') return false;
        } else {
          if (p.bpjs !== filterBPJS) return false;
        }
      }
      // Filter KK
      if (filterKK) {
        if (!p.noKK.includes(filterKK) && !p.namaLengkap.toLowerCase().includes(filterKK.toLowerCase())) return false;
      }
      return true;
    });
  }, [penduduk, filterBantuan, filterBPJS, filterKK]);

  // Statistik
  const rekapBantuan = useMemo(() => {
    return BANTUAN_OPTIONS.map(opt => {
      const count = penduduk.filter(p => {
        const arr = JSON.parse(p.bantuan || '[]');
        if (opt === 'TIDAK') return arr.length === 0 || arr.includes('TIDAK');
        return arr.includes(opt);
      }).length;
      return { nama: opt, count };
    });
  }, [penduduk]);

  const rekapBPJS = useMemo(() => {
    return BPJS_OPTIONS.map(opt => {
      const count = penduduk.filter(p => {
        if (opt === 'TIDAK') return !p.bpjs || p.bpjs === 'TIDAK' || p.bpjs === '';
        return p.bpjs === opt;
      }).length;
      return { nama: opt, count };
    });
  }, [penduduk]);

  const totalPenerima = useMemo(() => {
    return penduduk.filter(p => {
      const arr = JSON.parse(p.bantuan || '[]');
      return arr.some((b: string) => b !== 'TIDAK' && b !== '');
    }).length;
  }, [penduduk]);

  const totalBPJS = useMemo(() => {
    return penduduk.filter(p => p.bpjs && p.bpjs !== 'TIDAK' && p.bpjs !== '').length;
  }, [penduduk]);

  // Unique KK yang punya bantuan
  const kkPenerimaBantuan = useMemo(() => {
    const kkSet = new Set<string>();
    for (const p of penduduk) {
      const arr = JSON.parse(p.bantuan || '[]');
      if (arr.some((b: string) => b !== 'TIDAK' && b !== '')) {
        kkSet.add(p.noKK);
      }
    }
    return kkSet.size;
  }, [penduduk]);

  // Dialog handlers
  const openUpdateDialog = (p: Penduduk) => {
    setUpdateTarget(p);
    setUpdateBantuan(JSON.parse(p.bantuan || '[]'));
    setUpdateBPJS(p.bpjs || 'TIDAK');
    setUpdateAnggotaToo(true);
    setShowUpdateDialog(true);
  };

  const openDetailDialog = (p: Penduduk) => {
    setDetailTarget(p);
    setShowDetailDialog(true);
  };

  const handleUpdateBantuan = async () => {
    if (!updateTarget) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/penduduk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: updateTarget.id, bantuan: updateBantuan, bpjs: updateBPJS }),
      });

      if (res.ok) {
        if (updateAnggotaToo && updateTarget.statusKeluarga === 'KEPALA KELUARGA') {
          const allPenduduk = await fetch('/api/penduduk').then(r => r.json());
          const anggota = allPenduduk.filter(
            (p: Penduduk) =>
              p.noKK === updateTarget.noKK &&
              p.id !== updateTarget.id &&
              p.statusKeluarga !== 'KEPALA KELUARGA',
          );

          for (const a of anggota) {
            await fetch('/api/penduduk', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: a.id, bantuan: updateBantuan, bpjs: updateBPJS }),
            });
          }
        }

        const anggotaInfo = updateAnggotaToo && updateTarget.statusKeluarga === 'KEPALA KELUARGA'
          ? ' + semua anggota KK'
          : '';
        toast.success(`Data berhasil diupdate${anggotaInfo}`);
        setShowUpdateDialog(false);
        fetchPenduduk();
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

  const toggleBantuanItem = (item: string) => {
    setUpdateBantuan(prev =>
      prev.includes(item)
        ? prev.filter(b => b !== item)
        : [...prev, item],
    );
  };

  // Export CSV
  const handleExportCSV = () => {
    const header = 'No,No KK,NIK,Nama Lengkap,Jenis Kelamin,Status Keluarga,Umur,Bantuan,BPJS,No HP,Keterangan\n';
    const rows = filteredPenduduk.map((p, i) => {
      const umur = hitungUmur(p.tanggalLahir);
      const bantuanArr = JSON.parse(p.bantuan || '[]').filter((b: string) => b !== 'TIDAK' && b !== '');
      const bantuanStr = bantuanArr.join('; ') || '-';
      const bpjsStr = (p.bpjs && p.bpjs !== 'TIDAK') ? p.bpjs : '-';
      return `${i + 1},"${p.noKK}","${p.nik}","${p.namaLengkap}","${p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}","${p.statusKeluarga}","${umur.label}","${bantuanStr}","${bpjsStr}","${p.noHP || '-'}","${p.keterangan || '-'}"`;
    }).join('\n');

    const csv = '\uFEFF' + header + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daftar_bantuan_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('File CSV berhasil didownload');
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
          <Shield className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-emerald-800">Bantuan Sosial & BPJS</h2>
        </div>
        <a
          href="https://cekbansos.kemensos.go.id/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          cekbansos.kemensos.go.id
        </a>
      </div>

      {/* Section Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'cek' as SectionType, label: 'Cek Bansos', icon: Search },
          { key: 'daftar' as SectionType, label: 'Daftar', icon: Users },
          { key: 'rekap' as SectionType, label: 'Rekap', icon: BarChart3 },
          { key: 'bpjs' as SectionType, label: 'BPJS', icon: UserCheck },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex items-center justify-center gap-1 px-2 py-2 rounded-md text-[10px] sm:text-xs font-medium transition-colors ${
              activeSection === tab.key
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ==================== CEK BANSOS SECTION ==================== */}
      {activeSection === 'cek' && (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-emerald-800 flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Cek Data Bantuan Sosial
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Cek status bantuan sosial langsung di website resmi Kemensos RI
                </p>
              </div>

              {/* Langkah-langkah */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-blue-800 space-y-2">
                    <p className="font-semibold">Cara Cek Bantuan Sosial:</p>
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>Klik tombol <strong>&quot;Buka Cekbansos&quot;</strong> di bawah ini</li>
                      <li>Di website Kemensos, masukkan <strong>NIK</strong> atau <strong>No. KK</strong></li>
                      <li>Lihat hasilnya: program bantuan apa saja yang terdaftar</li>
                      <li>Kembali ke sini, cari penduduk di tab <strong>&quot;Daftar&quot;</strong></li>
                      <li>Klik icon <Pencil className="h-3 w-3 inline" /> untuk update data bantuan di database lokal</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Tombol buka cekbansos */}
              <a
                href="https://cekbansos.kemensos.go.id/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Buka Cekbansos Kemensos
              </a>
            </CardContent>
          </Card>

          {/* Quick Search */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Cari Penduduk untuk Update Data Bantuan</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 text-sm"
                    placeholder="Cari NIK atau nama..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setActiveSection('daftar');
                      }
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setActiveSection('daftar')}
                >
                  Lihat Daftar
                </Button>
              </div>

              {/* Quick result */}
              {search && search.length >= 3 && (
                <div className="mt-2 space-y-1.5">
                  {penduduk.slice(0, 5).map(p => {
                    const bantuanArr = JSON.parse(p.bantuan || '[]');
                    const activeBantuan = bantuanArr.filter((b: string) => b !== 'TIDAK' && b !== '');
                    const umur = hitungUmur(p.tanggalLahir);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                        onClick={() => openUpdateDialog(p)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{p.namaLengkap}</p>
                          <p className="text-[10px] text-muted-foreground">
                            NIK: {p.nik} · {p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'} · {umur.label} · {p.statusKeluarga}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {activeBantuan.length > 0 ? (
                              activeBantuan.map((b: string) => (
                                <Badge key={b} className="text-[9px] px-1 py-0 bg-orange-100 text-orange-700 hover:bg-orange-100">
                                  {b}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[10px] text-gray-400 italic">Belum ada bantuan</span>
                            )}
                            {p.bpjs && p.bpjs !== 'TIDAK' && (
                              <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700 hover:bg-blue-100">
                                BPJS {p.bpjs}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isAdmin && (
                          <Pencil className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                  {penduduk.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-2">
                      Tidak ditemukan di database lokal
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== DAFTAR PENERIMA SECTION ==================== */}
      {activeSection === 'daftar' && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 text-sm"
                placeholder="Cari NIK, nama, No. KK..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterBantuan || 'ALL'} onValueChange={v => setFilterBantuan(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="text-xs w-[120px]">
                <SelectValue placeholder="Bantuan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                {BANTUAN_OPTIONS.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterBPJS || 'ALL'} onValueChange={v => setFilterBPJS(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="text-xs w-[120px]">
                <SelectValue placeholder="BPJS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                {BPJS_OPTIONS.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => setShowKKOnly(!showKKOnly)}
            >
              <Home className="h-3 w-3 mr-1" />
              {showKKOnly ? 'Tampilkan Semua' : 'Lihat per KK'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
            >
              {viewMode === 'card' ? <ListFilter className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              {viewMode === 'card' ? 'Tabel' : 'Kartu'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={handleExportCSV}
            >
              <Download className="h-3 w-3 mr-1" />
              Export CSV
            </Button>
            {(filterBantuan || filterBPJS || filterKK) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-red-500 hover:text-red-700"
                onClick={() => { setFilterBantuan(''); setFilterBPJS(''); setFilterKK(''); }}
              >
                <X className="h-3 w-3 mr-1" />
                Reset Filter
              </Button>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {filteredPenduduk.length} dari {penduduk.length} penduduk
            </span>
          </div>

          {/* List per KK view */}
          {showKKOnly ? (
            <ScrollArea className="max-h-[calc(100vh-360px)]">
              <div className="space-y-3">
                {Array.from(kkGroups.entries())
                  .filter(([, members]) =>
                    members.some(p => {
                      const arr = JSON.parse(p.bantuan || '[]');
                      return arr.some((b: string) => b !== 'TIDAK' && b !== '');
                    })
                  )
                  .map(([noKK, members]) => {
                    const kkHead = members.find(p => p.statusKeluarga === 'KEPALA KELUARGA');
                    const allBantuan = new Set<string>();
                    members.forEach(p => {
                      JSON.parse(p.bantuan || '[]').forEach((b: string) => {
                        if (b !== 'TIDAK' && b !== '') allBantuan.add(b);
                      });
                    });
                    const isExpanded = expandKK === noKK;

                    return (
                      <Card key={noKK} className="overflow-hidden border-emerald-200">
                        <CardContent className="p-0">
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-emerald-50/50 transition-colors"
                            onClick={() => setExpandKK(isExpanded ? null : noKK)}
                          >
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium truncate">{kkHead?.namaLengkap || '-'}</span>
                                <Badge className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                  KK
                                </Badge>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                KK: {noKK} · {members.length} anggota
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Array.from(allBantuan).map(b => (
                                  <Badge key={b} className="text-[9px] px-1.5 py-0 bg-orange-100 text-orange-700 hover:bg-orange-100">
                                    {b}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isAdmin && kkHead && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={e => { e.stopPropagation(); openUpdateDialog(kkHead); }}
                                  title="Update Bantuan KK"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-gray-100 px-3 py-2 space-y-1 bg-gray-50/50">
                              {members.map(p => {
                                const bantuanArr = JSON.parse(p.bantuan || '[]').filter((b: string) => b !== 'TIDAK' && b !== '');
                                const umur = hitungUmur(p.tanggalLahir);
                                return (
                                  <div
                                    key={p.id}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white transition-colors cursor-pointer"
                                    onClick={() => openDetailDialog(p)}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium truncate">{p.namaLengkap}</span>
                                        <span className="text-[9px] text-muted-foreground">{p.statusKeluarga}</span>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground">
                                        NIK: {p.nik} · {p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'} · {umur.label}
                                      </p>
                                      {bantuanArr.length > 0 && (
                                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                                          {bantuanArr.map((b: string) => (
                                            <Badge key={b} className="text-[8px] px-1 py-0 bg-orange-50 text-orange-600 hover:bg-orange-50">
                                              {b}
                                            </Badge>
                                          ))}
                                          {p.bpjs && p.bpjs !== 'TIDAK' && (
                                            <Badge className="text-[8px] px-1 py-0 bg-blue-50 text-blue-600 hover:bg-blue-50">
                                              BPJS {p.bpjs}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {isAdmin && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={e => { e.stopPropagation(); openUpdateDialog(p); }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                {kkPenerimaBantuan === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-orange-300" />
                    <p className="text-sm">Belum ada data penerima bantuan</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : viewMode === 'card' ? (
            /* Card View */
            <ScrollArea className="max-h-[calc(100vh-360px)]">
              <div className="space-y-1.5">
                {filteredPenduduk.map(p => {
                  const bantuanArr = JSON.parse(p.bantuan || '[]');
                  const activeBantuan = bantuanArr.filter((b: string) => b !== 'TIDAK' && b !== '');
                  const umur = hitungUmur(p.tanggalLahir);
                  const isKK = p.statusKeluarga === 'KEPALA KELUARGA';

                  return (
                    <Card key={p.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex items-center gap-2 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium truncate">{p.namaLengkap}</span>
                              {isKK && (
                                <Badge className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">KK</Badge>
                              )}
                              {!isKK && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0">{p.statusKeluarga}</Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              NIK: {p.nik} · {p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'} · Umur: {umur.label}
                            </p>
                            {activeBantuan.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {activeBantuan.map((b: string) => (
                                  <Badge key={b} className="text-[9px] px-1.5 py-0 bg-orange-100 text-orange-700 hover:bg-orange-100">
                                    {b}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {activeBantuan.length === 0 && (
                              <p className="text-[10px] text-gray-400 mt-0.5 italic">Tidak menerima bantuan</p>
                            )}
                            {p.bpjs && p.bpjs !== 'TIDAK' && (
                              <Badge className="text-[9px] px-1.5 py-0 bg-blue-100 text-blue-700 hover:bg-blue-100 mt-1">
                                BPJS {p.bpjs}
                              </Badge>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openDetailDialog(p)} title="Detail">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openUpdateDialog(p)} title="Update Bantuan">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {filteredPenduduk.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Tidak ada data ditemukan</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            /* Table View */
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-emerald-50 border-b border-emerald-200">
                        <th className="px-3 py-2 text-left font-semibold text-emerald-800 whitespace-nowrap">No</th>
                        <th className="px-3 py-2 text-left font-semibold text-emerald-800 whitespace-nowrap">Nama</th>
                        <th className="px-3 py-2 text-left font-semibold text-emerald-800 whitespace-nowrap">NIK</th>
                        <th className="px-3 py-2 text-left font-semibold text-emerald-800 whitespace-nowrap">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-emerald-800 whitespace-nowrap">JK</th>
                        <th className="px-3 py-2 text-left font-semibold text-emerald-800 whitespace-nowrap">Umur</th>
                        <th className="px-3 py-2 text-left font-semibold text-emerald-800 whitespace-nowrap">Bantuan</th>
                        <th className="px-3 py-2 text-left font-semibold text-emerald-800 whitespace-nowrap">BPJS</th>
                        {isAdmin && <th className="px-3 py-2 text-center font-semibold text-emerald-800 whitespace-nowrap">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPenduduk.map((p, i) => {
                        const bantuanArr = JSON.parse(p.bantuan || '[]').filter((b: string) => b !== 'TIDAK' && b !== '');
                        const umur = hitungUmur(p.tanggalLahir);
                        return (
                          <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => openDetailDialog(p)}>
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2 font-medium">
                              {p.namaLengkap}
                              {p.statusKeluarga === 'KEPALA KELUARGA' && (
                                <Badge className="text-[8px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 ml-1">KK</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground font-mono">{p.nik}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.statusKeluarga}</td>
                            <td className="px-3 py-2">{p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}</td>
                            <td className="px-3 py-2">{umur.label}</td>
                            <td className="px-3 py-2">
                              {bantuanArr.length > 0 ? (
                                <div className="flex flex-wrap gap-0.5">
                                  {bantuanArr.map((b: string) => (
                                    <Badge key={b} className="text-[8px] px-1 py-0 bg-orange-100 text-orange-700 hover:bg-orange-100">{b}</Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {p.bpjs && p.bpjs !== 'TIDAK' ? (
                                <Badge className="text-[8px] px-1 py-0 bg-blue-100 text-blue-700 hover:bg-blue-100">{p.bpjs}</Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            {isAdmin && (
                              <td className="px-3 py-2 text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={e => { e.stopPropagation(); openUpdateDialog(p); }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredPenduduk.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Tidak ada data ditemukan</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ==================== REKAP SECTION ==================== */}
      {activeSection === 'rekap' && (
        <div className="space-y-3">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-emerald-700">{penduduk.length}</p>
                <p className="text-[10px] text-muted-foreground">Total Penduduk</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-orange-600">{totalPenerima}</p>
                <p className="text-[10px] text-muted-foreground">Penerima Bansos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-blue-600">{totalBPJS}</p>
                <p className="text-[10px] text-muted-foreground">Pengguna BPJS</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-purple-600">{kkPenerimaBantuan}</p>
                <p className="text-[10px] text-muted-foreground">KK Penerima</p>
              </CardContent>
            </Card>
          </div>

          {/* Rekap Bantuan */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm text-emerald-800 mb-3">Rekap per Jenis Bantuan</h3>
              <div className="space-y-2.5">
                {rekapBantuan.map(item => {
                  const pct = penduduk.length > 0 ? (item.count / penduduk.length) * 100 : 0;
                  const isTidak = item.nama === 'TIDAK';
                  return (
                    <div key={item.nama} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${isTidak ? 'text-gray-500' : 'text-emerald-800'}`}>
                          {item.nama}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.count} orang ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isTidak ? 'bg-gray-300' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                          }`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Rekap BPJS */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm text-blue-800 mb-3">Rekap BPJS Kesehatan</h3>
              <div className="space-y-2.5">
                {rekapBPJS.map(item => {
                  const pct = penduduk.length > 0 ? (item.count / penduduk.length) * 100 : 0;
                  const isTidak = item.nama === 'TIDAK';
                  return (
                    <div key={item.nama} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${isTidak ? 'text-gray-500' : 'text-blue-800'}`}>
                          {item.nama}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.count} orang ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isTidak ? 'bg-gray-300' : 'bg-gradient-to-r from-blue-400 to-blue-600'
                          }`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* KK Penerima Bantuan */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm text-emerald-800 mb-3">Daftar KK Penerima Bantuan ({kkPenerimaBantuan})</h3>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1.5">
                  {Array.from(kkGroups.entries())
                    .filter(([, members]) =>
                      members.some(p => {
                        const arr = JSON.parse(p.bantuan || '[]');
                        return arr.some((b: string) => b !== 'TIDAK' && b !== '');
                      })
                    )
                    .sort((a, b) => {
                      const headA = a[1].find(p => p.statusKeluarga === 'KEPALA KELUARGA');
                      const headB = b[1].find(p => p.statusKeluarga === 'KEPALA KELUARGA');
                      return (headA?.namaLengkap || '').localeCompare(headB?.namaLengkap || '');
                    })
                    .map(([noKK, members]) => {
                      const kkHead = members.find(p => p.statusKeluarga === 'KEPALA KELUARGA');
                      const allBantuan = new Set<string>();
                      members.forEach(p => {
                        JSON.parse(p.bantuan || '[]').forEach((b: string) => {
                          if (b !== 'TIDAK') allBantuan.add(b);
                        });
                      });
                      return (
                        <div
                          key={noKK}
                          className="flex items-center gap-2 px-3 py-2 bg-orange-50/50 rounded-lg border border-orange-100 cursor-pointer hover:bg-orange-50 transition-colors"
                          onClick={() => {
                            setExpandKK(noKK);
                            setShowKKOnly(true);
                            setActiveSection('daftar');
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-medium truncate">{kkHead?.namaLengkap || '-'}</p>
                              <Badge className="text-[8px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">KK</Badge>
                              <span className="text-[9px] text-muted-foreground">{members.length} orang</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">KK: {noKK}</p>
                          </div>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {Array.from(allBantuan).map(b => (
                              <Badge key={b} className="text-[9px] px-1.5 py-0 bg-orange-100 text-orange-700 hover:bg-orange-100">
                                {b}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== BPJS SECTION ==================== */}
      {activeSection === 'bpjs' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 text-sm"
                placeholder="Cari nama atau NIK..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterBPJS || 'ALL'} onValueChange={v => setFilterBPJS(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="text-xs w-[130px]">
                <SelectValue placeholder="Status BPJS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                {BPJS_OPTIONS.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="max-h-[calc(100vh-340px)]">
            <div className="space-y-1.5">
              {filteredPenduduk
                .filter(p => p.bpjs && p.bpjs !== 'TIDAK' && p.bpjs !== '')
                .map(p => {
                  const umur = hitungUmur(p.tanggalLahir);
                  const isKK = p.statusKeluarga === 'KEPALA KELUARGA';
                  return (
                    <Card key={p.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex items-center gap-2 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium truncate">{p.namaLengkap}</span>
                              {isKK && (
                                <Badge className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">KK</Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              NIK: {p.nik} · {p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'} · Umur: {umur.label}
                            </p>
                            <Badge className="text-[9px] px-1.5 py-0 bg-blue-100 text-blue-700 hover:bg-blue-100 mt-1">
                              BPJS {p.bpjs}
                            </Badge>
                          </div>
                          {isAdmin && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openUpdateDialog(p)} title="Update BPJS">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              {filteredPenduduk.filter(p => p.bpjs && p.bpjs !== 'TIDAK' && p.bpjs !== '').length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Tidak ada data BPJS ditemukan</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* ==================== UPDATE DIALOG ==================== */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Data Bantuan & BPJS</DialogTitle>
          </DialogHeader>
          {updateTarget && (
            <div className="space-y-4">
              {/* Info penduduk */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{updateTarget.namaLengkap}</p>
                <p className="text-[11px] text-muted-foreground">
                  NIK: {updateTarget.nik} · {updateTarget.statusKeluarga}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  No. KK: {updateTarget.noKK}
                </p>
              </div>

              {/* Bantuan */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Jenis Bantuan</Label>
                <p className="text-[10px] text-muted-foreground">
                  Sesuaikan dengan data dari cekbansos.kemensos.go.id
                </p>
                <div className="flex flex-wrap gap-3">
                  {BANTUAN_OPTIONS.map(b => (
                    <label key={b} className="flex items-center gap-1.5 cursor-pointer">
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
                <Label className="text-xs font-semibold">Status BPJS Kesehatan</Label>
                <Select value={updateBPJS} onValueChange={v => setUpdateBPJS(v)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Pilih Status BPJS" />
                  </SelectTrigger>
                  <SelectContent>
                    {BPJS_OPTIONS.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-propagate */}
              {updateTarget.statusKeluarga === 'KEPALA KELUARGA' && (
                <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <Checkbox
                    checked={updateAnggotaToo}
                    onCheckedChange={v => setUpdateAnggotaToo(v as boolean)}
                  />
                  <div>
                    <span className="text-xs font-medium text-emerald-800">Update semua anggota keluarga juga</span>
                    <p className="text-[10px] text-muted-foreground">
                      Bantuan & BPJS akan diterapkan ke seluruh anggota KK {updateTarget.noKK}
                    </p>
                  </div>
                </label>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleUpdateBantuan}
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button variant="outline" onClick={() => setShowUpdateDialog(false)} disabled={submitting}>
                  Batal
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== DETAIL DIALOG ==================== */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Detail Penduduk</DialogTitle>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{detailTarget.namaLengkap}</p>
                  {detailTarget.statusKeluarga === 'KEPALA KELUARGA' && (
                    <Badge className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">KK</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-muted-foreground">NIK</span>
                  <span className="font-mono">{detailTarget.nik}</span>
                  <span className="text-muted-foreground">No. KK</span>
                  <span className="font-mono">{detailTarget.noKK}</span>
                  <span className="text-muted-foreground">Jenis Kelamin</span>
                  <span>{detailTarget.jenisKelamin === 'LAKI-LAKI' ? 'Laki-laki' : 'Perempuan'}</span>
                  <span className="text-muted-foreground">Status Keluarga</span>
                  <span>{detailTarget.statusKeluarga}</span>
                  <span className="text-muted-foreground">Tempat/Tgl Lahir</span>
                  <span>{detailTarget.tempatLahir}, {new Date(detailTarget.tanggalLahir).toLocaleDateString('id-ID')}</span>
                  <span className="text-muted-foreground">Umur</span>
                  <span>{hitungUmur(detailTarget.tanggalLahir).label}</span>
                  <span className="text-muted-foreground">Agama</span>
                  <span>{detailTarget.agama}</span>
                  <span className="text-muted-foreground">Pendidikan</span>
                  <span>{detailTarget.pendidikan}</span>
                  <span className="text-muted-foreground">Pekerjaan</span>
                  <span>{detailTarget.pekerjaan}</span>
                  <span className="text-muted-foreground">Status Kawin</span>
                  <span>{detailTarget.statusPerkawinan}</span>
                  <span className="text-muted-foreground">No. HP</span>
                  <span>{detailTarget.noHP || '-'}</span>
                  <span className="text-muted-foreground">Keterangan</span>
                  <span>{detailTarget.keterangan || '-'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-emerald-800">Bantuan Sosial</p>
                {(() => {
                  const arr = JSON.parse(detailTarget.bantuan || '[]').filter((b: string) => b !== 'TIDAK' && b !== '');
                  return arr.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {arr.map((b: string) => (
                        <Badge key={b} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 hover:bg-orange-100">{b}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400 italic">Tidak menerima bantuan</p>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-blue-800">BPJS Kesehatan</p>
                {detailTarget.bpjs && detailTarget.bpjs !== 'TIDAK' ? (
                  <Badge className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 hover:bg-blue-100">BPJS {detailTarget.bpjs}</Badge>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">Tidak terdaftar BPJS</p>
                )}
              </div>

              {isAdmin && (
                <Button
                  onClick={() => {
                    setShowDetailDialog(false);
                    openUpdateDialog(detailTarget);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Update Data
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
