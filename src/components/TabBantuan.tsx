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
} from 'lucide-react';
import { toast } from 'sonner';
import { BANTUAN_OPTIONS, BPJS_OPTIONS, DESIL_OPTIONS } from '@/lib/constants';
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
  desil: string | null;
  keterangan: string | null;
}

interface KKGroup {
  noKK: string;
  kepala: Penduduk | null;
  anggota: Penduduk[];
}

interface TabBantuanProps {
  isAdmin?: boolean;
}

export default function TabBantuan({ isAdmin = true }: TabBantuanProps) {
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

  const fetchPenduduk = useCallback(async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/penduduk${params}`);
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
        group = { noKK: p.noKK, kepala: null, anggota: [] };
        map.set(p.noKK, group);
      }
      if (p.statusKeluarga === 'KEPALA KELUARGA') {
        group.kepala = p;
      } else {
        group.anggota.push(p);
      }
    }
    setKKGroups(Array.from(map.values()));
  };

  // Setup database dulu, baru fetch penduduk
  useEffect(() => {
    const init = async () => {
      try {
        await fetch('/api/setup-db');
      } catch { /* ignore */ }
      setDbReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (dbReady) fetchPenduduk();
  }, [dbReady, fetchPenduduk]);

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

      // 1. Update penduduk yang dipilih
      const res = await fetch('/api/penduduk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updateTarget.id,
          bantuan: updateBantuan,
          bpjs: updateBPJS,
          desil: desilValue,
          keterangan: keteranganValue || null,
        }),
      });

      if (res.ok) {
        // 2. Otomatis update semua anggota KK dengan data yang sama
        const allPenduduk = await fetch('/api/penduduk').then(r => r.json());
        const anggota = allPenduduk.filter(
          (p: Penduduk) =>
            p.noKK === updateTarget.noKK &&
            p.id !== updateTarget.id,
        );

        let updatedCount = 0;
        for (const a of anggota) {
          // Hitung keterangan untuk anggota (hapus desil lama, tambah desil baru)
          let ketAnggota = a.keterangan || '';
          ketAnggota = ketAnggota.replace(/,?\s*DESIL\s*\d+(-\d+)?/gi, '').replace(/^,|,$/g, '').trim();
          if (desilValue) {
            ketAnggota = ketAnggota ? `${ketAnggota}, ${desilValue}` : desilValue;
          }

          const aRes = await fetch('/api/penduduk', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: a.id,
              bantuan: updateBantuan,
              bpjs: updateBPJS,
              desil: desilValue,
              keterangan: ketAnggota || null,
            }),
          });
          if (aRes.ok) updatedCount++;
        }

        const info = updatedCount > 0 ? ` + ${updatedCount} anggota KK` : '';
        toast.success(`Data bantuan berhasil diupdate${info}`);
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

  // Export CSV
  const handleExportCSV = () => {
    const header = 'No,No KK,NIK,Nama Lengkap,Jenis Kelamin,Status Keluarga,Umur,Desil,Bantuan,BPJS,Keterangan\n';
    const rows = penduduk.map((p, i) => {
      let umur = { label: '-' };
      try { umur = hitungUmur(p.tanggalLahir); } catch { /* skip */ }
      let bantuanArr: string[] = [];
      try { bantuanArr = JSON.parse(p.bantuan || '[]').filter((b: string) => b !== 'TIDAK' && b !== ''); } catch { /* skip */ }
      const bantuanStr = bantuanArr.join('; ') || '-';
      const bpjsStr = (p.bpjs && p.bpjs !== 'TIDAK') ? p.bpjs : '-';
      const desilStr = (p.desil && p.desil !== 'TIDAK_ADA') ? p.desil : '-';
      return `${i + 1},"${p.noKK}","${p.nik}","${p.namaLengkap}","${p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}","${p.statusKeluarga}","${umur.label}","${desilStr}","${bantuanStr}","${bpjsStr}","${p.keterangan || '-'}"`;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-emerald-800">Bantuan Sosial & BPJS</h2>
          <Badge variant="secondary" className="text-xs">{penduduk.length} penduduk</Badge>
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
      <ScrollArea className="max-h-[calc(100vh-260px)]">
        <div className="space-y-2">
          {kkGroups.map(group => {
            const isExpanded = expandedKK.has(group.noKK);
            const totalL = (group.kepala?.jenisKelamin === 'LAKI-LAKI' ? 1 : 0) + group.anggota.filter(a => a.jenisKelamin === 'LAKI-LAKI').length;
            const totalP = (group.kepala?.jenisKelamin === 'PEREMPUAN' ? 1 : 0) + group.anggota.filter(a => a.jenisKelamin === 'PEREMPUAN').length;
            const allBantuan = new Set<string>();
            const allMembers = [group.kepala, ...group.anggota].filter(Boolean) as Penduduk[];
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
                      <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 px-3 py-1.5 bg-emerald-50 border-b border-emerald-100 text-[10px] font-semibold text-emerald-800">
                        <span className="w-6">No</span>
                        <span>Nama / NIK</span>
                        <span className="w-16 text-center">Status</span>
                        <span className="w-10 text-center">JK</span>
                        <span className="w-16 text-center">Desil</span>
                        <span className="w-32 text-center">Bantuan</span>
                        <span className="w-24 text-center">BPJS</span>
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
    <div className="border-b border-gray-100 last:border-b-0 hover:bg-white transition-colors">
      {/* Desktop: Grid Row */}
      <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-2 items-center px-3 py-2">
        <span className="text-[11px] text-muted-foreground w-6">{index}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">{p.namaLengkap}</span>
            {isKK && (
              <Badge className="text-[8px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">KK</Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">{p.nik}</p>
        </div>
        <span className="text-[10px] text-muted-foreground w-16 text-center">{p.statusKeluarga}</span>
        <span className="text-[10px] w-10 text-center">{p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}</span>
        <div className="w-16 text-center">{renderDesilBadge(p.desil)}</div>
        <div className="w-32">{renderBantuanBadges(p.bantuan)}</div>
        <div className="w-24">{renderBPJSBadge(p.bpjs)}</div>
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
