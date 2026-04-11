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
} from 'lucide-react';
import { toast } from 'sonner';
import { BANTUAN_OPTIONS } from '@/lib/constants';
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

export default function TabBantuan({ isAdmin = true }: TabBantuanProps) {
  const [penduduk, setPenduduk] = useState<Penduduk[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'cek' | 'daftar' | 'rekap'>('daftar');
  const [filterBantuan, setFilterBantuan] = useState('');

  // Update Bantuan Dialog
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<Penduduk | null>(null);
  const [updateBantuan, setUpdateBantuan] = useState<string[]>([]);
  const [updateAnggotaToo, setUpdateAnggotaToo] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const openUpdateDialog = (p: Penduduk) => {
    setUpdateTarget(p);
    setUpdateBantuan(JSON.parse(p.bantuan || '[]'));
    setUpdateAnggotaToo(true);
    setShowUpdateDialog(true);
  };

  const handleUpdateBantuan = async () => {
    if (!updateTarget) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/penduduk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: updateTarget.id, bantuan: updateBantuan }),
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
              body: JSON.stringify({ id: a.id, bantuan: updateBantuan }),
            });
          }
        }

        const anggotaInfo = updateAnggotaToo && updateTarget.statusKeluarga === 'KEPALA KELUARGA'
          ? ' + semua anggota KK'
          : '';
        toast.success(`Bantuan berhasil diupdate${anggotaInfo}`);
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

  // Filter penduduk berdasarkan bantuan
  const filteredPenduduk = penduduk.filter(p => {
    if (!filterBantuan || filterBantuan === 'ALL') return true;
    const arr = JSON.parse(p.bantuan || '[]');
    if (filterBantuan === 'TIDAK') return arr.length === 0 || arr.includes('TIDAK');
    return arr.includes(filterBantuan);
  });

  // Statistik rekap
  const rekapBantuan = BANTUAN_OPTIONS.map(opt => {
    const count = penduduk.filter(p => {
      const arr = JSON.parse(p.bantuan || '[]');
      if (opt === 'TIDAK') return arr.length === 0 || arr.includes('TIDAK');
      return arr.includes(opt);
    }).length;
    return { nama: opt, count };
  });

  const totalPenerima = penduduk.filter(p => {
    const arr = JSON.parse(p.bantuan || '[]');
    return arr.some((b: string) => b !== 'TIDAK' && b !== '');
  }).length;

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
          <h2 className="text-lg font-bold text-emerald-800">Bantuan Sosial</h2>
          <Badge variant="secondary" className="text-xs">{totalPenerima} penerima</Badge>
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
      <div className="grid grid-cols-3 gap-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'cek', label: 'Cek Bansos', icon: Search },
          { key: 'daftar', label: 'Daftar Penerima', icon: Users },
          { key: 'rekap', label: 'Rekap', icon: Copy },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key as typeof activeSection)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
              activeSection === tab.key
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cek Bansos Section */}
      {activeSection === 'cek' && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-emerald-800 mb-1">Cek Data Bantuan Sosial</h3>
              <p className="text-[11px] text-muted-foreground">
                Cek status bantuan sosial langsung di website resmi Kemensos
              </p>
            </div>

            {/* Langkah-langkah */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-800 space-y-2">
                  <p className="font-medium">Cara Cek Bantuan Sosial:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Klik tombol &quot;Buka Cekbansos&quot; di bawah</li>
                    <li>Di website Kemensos, masukkan <strong>NIK</strong> atau <strong>No. KK</strong></li>
                    <li>Lihat hasilnya: program bantuan apa saja yang terdaftar</li>
                    <li>Kembali ke sini, cari penduduk di tab <strong>&quot;Daftar Penerima&quot;</strong></li>
                    <li>Klik icon <Pencil className="h-3 w-3 inline" /> untuk update data bantuan di database lokal</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Tombol buka cekbansos */}
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="https://cekbansos.kemensos.go.id/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Buka Cekbansos Kemensos
              </a>
            </div>

            {/* Cari lokal setelah cek */}
            <div className="border-t pt-3">
              <p className="text-[11px] text-muted-foreground mb-2">
                Sudah cek di website? Cari penduduk di database lokal untuk update data bantuan:
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 text-sm"
                    placeholder="Cari berdasarkan NIK atau nama..."
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

              {/* Quick result dari pencarian lokal */}
              {search && search.length >= 3 && (
                <div className="mt-2 space-y-1">
                  {penduduk.slice(0, 3).map(p => {
                    const bantuanArr = JSON.parse(p.bantuan || '[]');
                    const activeBantuan = bantuanArr.filter((b: string) => b !== 'TIDAK' && b !== '');
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                        onClick={() => openUpdateDialog(p)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{p.namaLengkap}</p>
                          <p className="text-[10px] text-muted-foreground">
                            NIK: {p.nik} · {p.statusKeluarga}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {activeBantuan.length > 0 ? (
                              activeBantuan.map((b: string) => (
                                <Badge key={b} className="text-[9px] px-1 py-0 bg-orange-100 text-orange-700 hover:bg-orange-100">
                                  {b}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[10px] text-gray-400 italic">Belum ada bantuan tercatat</span>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daftar Penerima Section */}
      {activeSection === 'daftar' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 text-sm"
                placeholder="Cari nama, NIK, No. KK..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterBantuan || 'ALL'} onValueChange={v => setFilterBantuan(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="text-sm w-[140px]">
                <SelectValue placeholder="Filter Bantuan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                {BANTUAN_OPTIONS.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="max-h-[calc(100vh-340px)]">
            <div className="space-y-1.5">
              {filteredPenduduk.map(p => {
                const bantuanArr = JSON.parse(p.bantuan || '[]');
                const activeBantuan = bantuanArr.filter((b: string) => b !== 'TIDAK' && b !== '');
                const umur = hitungUmur(p.tanggalLahir);

                return (
                  <Card key={p.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium truncate">{p.namaLengkap}</span>
                            {p.statusKeluarga === 'KEPALA KELUARGA' && (
                              <Badge className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                KK
                              </Badge>
                            )}
                            {!p.statusKeluarga.includes('KEPALA') && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                {p.statusKeluarga}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            NIK: {p.nik} · {p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'} · Umur: {umur.label}
                          </p>
                          {activeBantuan.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {activeBantuan.map((b: string) => (
                                <Badge
                                  key={b}
                                  className="text-[9px] px-1.5 py-0 bg-orange-100 text-orange-700 hover:bg-orange-100"
                                >
                                  {b}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {activeBantuan.length === 0 && (
                            <p className="text-[10px] text-gray-400 mt-0.5 italic">Tidak menerima bantuan</p>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openUpdateDialog(p)}
                              title="Update Bantuan"
                            >
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
        </div>
      )}

      {/* Rekap Section */}
      {activeSection === 'rekap' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{penduduk.length}</p>
                <p className="text-[11px] text-muted-foreground">Total Penduduk</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{totalPenerima}</p>
                <p className="text-[11px] text-muted-foreground">Penerima Bansos</p>
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-gray-600">
                  {penduduk.length - totalPenerima}
                </p>
                <p className="text-[11px] text-muted-foreground">Belum Menerima</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm text-emerald-800 mb-3">Rekap per Jenis Bantuan</h3>
              <div className="space-y-2">
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
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isTidak ? 'bg-gray-300' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm text-emerald-800 mb-3">Daftar KK Penerima Bantuan</h3>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1.5">
                  {(() => {
                    const kkMap = new Map<string, { kepala: Penduduk | null; anggota: Penduduk[]; bantuan: Set<string> }>();
                    for (const p of penduduk) {
                      let group = kkMap.get(p.noKK);
                      if (!group) {
                        group = { kepala: null, anggota: [], bantuan: new Set() };
                        kkMap.set(p.noKK, group);
                      }
                      if (p.statusKeluarga === 'KEPALA KELUARGA') {
                        group.kepala = p;
                      } else {
                        group.anggota.push(p);
                      }
                      const arr = JSON.parse(p.bantuan || '[]');
                      arr.forEach((b: string) => { if (b !== 'TIDAK') group.bantuan.add(b); });
                    }

                    return Array.from(kkMap.entries())
                      .filter(([, g]) => g.bantuan.size > 0)
                      .map(([noKK, group]) => (
                        <div key={noKK} className="flex items-center gap-2 px-3 py-2 bg-orange-50/50 rounded-lg border border-orange-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{group.kepala?.namaLengkap || '-'}</p>
                            <p className="text-[10px] text-muted-foreground">KK: {noKK}</p>
                          </div>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {Array.from(group.bantuan).map(b => (
                              <Badge key={b} className="text-[9px] px-1.5 py-0 bg-orange-100 text-orange-700 hover:bg-orange-100">
                                {b}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Update Bantuan Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Data Bantuan</DialogTitle>
          </DialogHeader>
          {updateTarget && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{updateTarget.namaLengkap}</p>
                <p className="text-[11px] text-muted-foreground">
                  NIK: {updateTarget.nik} · {updateTarget.statusKeluarga}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  No. KK: {updateTarget.noKK}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Pilih Bantuan</Label>
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

              {updateTarget.statusKeluarga === 'KEPALA KELUARGA' && (
                <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <Checkbox
                    checked={updateAnggotaToo}
                    onCheckedChange={v => setUpdateAnggotaToo(v as boolean)}
                  />
                  <div>
                    <span className="text-xs font-medium text-emerald-800">Update semua anggota keluarga juga</span>
                    <p className="text-[10px] text-muted-foreground">
                      Bantuan akan diterapkan ke seluruh anggota KK {updateTarget.noKK}
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
    </div>
  );
}
