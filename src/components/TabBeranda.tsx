'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, AlertTriangle, Loader2, Database } from 'lucide-react';

interface Statistik {
  totalKK: number;
  totalPenduduk: number;
  pendudukL: number;
  pendudukP: number;
  bayiL: number;
  bayiP: number;
  dptL: number;
  dptP: number;
  ageDist: Record<string, { l: number; p: number }>;
  wajibKTPL: number;
  wajibKTPP: number;
  wajibKTPList: {
    id: number;
    noKK: string;
    nik: string;
    namaLengkap: string;
    jenisKelamin: string;
    tempatLahir: string;
    tanggalLahir: string;
    statusKeluarga: string;
    punyaKTP: string;
  }[];
  kkL: number;
  kkP: number;
  sementaraL: number;
  sementaraP: number;
  sementaraKK: number;
  kejadianCounts: Record<string, { l: number; p: number }>;
}

interface TabBerandaProps {
  isAdmin?: boolean;
  isActive?: boolean;
}

export default function TabBeranda({ isAdmin = false, isActive = false }: TabBerandaProps) {
  const [statistik, setStatistik] = useState<Statistik | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');

  useEffect(() => {
    fetchStatistik();
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchStatistik();
    }
  }, [isActive]);

  const fetchStatistik = async () => {
    try {
      const res = await fetch('/api/statistik');
      if (res.ok) {
        const data = await res.json();
        setStatistik(data);
      } else {
        setStatistik(null);
      }
    } catch (error) {
      setStatistik(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (deleteConfirmText !== 'HAPUS') return;
    setDeleting(true);
    setDeleteMsg('');
    try {
      const res = await fetch('/api/penduduk?all=true', { method: 'DELETE' });
      if (res.ok) {
        const result = await res.json();
        setDeleteMsg(result.message);
        setDeleteDialogOpen(false);
        setDeleteConfirmText('');
        fetchStatistik();
      } else {
        const err = await res.json();
        setDeleteMsg(err.error || 'Gagal menghapus data');
      }
    } catch (error) {
      setDeleteMsg('Gagal menghapus data');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!statistik) {
    return <div className="p-4 text-center text-muted-foreground">Gagal memuat data statistik</div>;
  }

  const ageData: { age: number; l: number; p: number }[] = [];
  for (let i = 1; i <= 100; i++) {
    const key = String(i);
    const d = statistik.ageDist[key];
    if (d && (d.l > 0 || d.p > 0)) {
      ageData.push({ age: i, l: d.l, p: d.p });
    }
  }

  return (
    <div className="space-y-4">

      {isAdmin && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Hapus Seluruh Data</p>
                  <p className="text-[10px] text-red-500 mt-0.5">
                    Bersihkan seluruh database (penduduk, sementara, kejadian, laporan)
                  </p>
                </div>
              </div>
              <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
                setDeleteDialogOpen(open);
                if (!open) setDeleteConfirmText('');
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 text-xs gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Semua Data
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-5 w-5" />
                      Hapus Seluruh Data
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      Semua data akan dihapus permanen dari database.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
                      <p className="font-semibold">Data yang akan dihapus:</p>
                      <p>- Data Penduduk ({statistik?.totalPenduduk || 0} orang, {statistik?.totalKK || 0} KK)</p>
                      <p>- Penduduk Sementara ({statistik?.sementaraL + statistik?.sementaraP || 0} orang)</p>
                      <p>- Kejadian (lahir, meninggal, pindah, datang)</p>
                      <p>- Riwayat Laporan Tersimpan</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                      <p className="font-semibold">Peringatan:</p>
                      <p>Data yang dihapus tidak dapat dikembalikan!</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Ketik <strong className="text-red-600">HAPUS</strong> untuk konfirmasi:
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="HAPUS"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400"
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      variant="outline"
                      onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(''); }}
                      disabled={deleting}
                    >
                      Batal
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAll}
                      disabled={deleting || deleteConfirmText !== 'HAPUS'}
                      className="gap-1.5"
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Menghapus...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Ya, Hapus Semua
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {deleteMsg && (
              <div className={`mt-2 text-xs flex items-center gap-1 ${deleteMsg.includes('berhasil') ? 'text-emerald-600' : 'text-red-500'}`}>
                {deleteMsg.includes('berhasil') ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {deleteMsg}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-emerald-600 text-white border-0">
          <CardContent className="p-3">
            <p className="text-[10px] opacity-80 font-medium">TOTAL KK</p>
            <p className="text-2xl font-bold">{statistik.totalKK}</p>
            <div className="flex gap-2 mt-1 text-[10px] opacity-80">
              <span>L: {statistik.kkL}</span>
              <span>P: {statistik.kkP}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-teal-600 text-white border-0">
          <CardContent className="p-3">
            <p className="text-[10px] opacity-80 font-medium">TOTAL PENDUDUK</p>
            <p className="text-2xl font-bold">{statistik.totalPenduduk}</p>
            <div className="flex gap-2 mt-1 text-[10px] opacity-80">
              <span>L: {statistik.pendudukL}</span>
              <span>P: {statistik.pendudukP}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500 text-white border-0">
          <CardContent className="p-3">
            <p className="text-[10px] opacity-80 font-medium">BAYI (0-11 BLN)</p>
            <p className="text-2xl font-bold">{statistik.bayiL + statistik.bayiP}</p>
            <div className="flex gap-2 mt-1 text-[10px] opacity-80">
              <span>L: {statistik.bayiL}</span>
              <span>P: {statistik.bayiP}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rose-500 text-white border-0">
          <CardContent className="p-3">
            <p className="text-[10px] opacity-80 font-medium">WAJIB KTP (BARU MASUK 17 TH)</p>
            <p className="text-2xl font-bold">{statistik.wajibKTPL + statistik.wajibKTPP}</p>
            <div className="flex gap-2 mt-1 text-[10px] opacity-80">
              <span>L: {statistik.wajibKTPL}</span>
              <span>P: {statistik.wajibKTPP}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-indigo-500 text-white border-0">
          <CardContent className="p-3">
            <p className="text-[10px] opacity-80 font-medium">DPT (USIA ≥ 17 TH)</p>
            <p className="text-2xl font-bold">{statistik.dptL + statistik.dptP}</p>
            <div className="flex gap-2 mt-1 text-[10px] opacity-80">
              <span>L: {statistik.dptL}</span>
              <span>P: {statistik.dptP}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-violet-500 text-white border-0">
          <CardContent className="p-3">
            <p className="text-[10px] opacity-80 font-medium">PENDUDUK SEMENTARA</p>
            <p className="text-2xl font-bold">{statistik.sementaraKK} KK</p>
            <p className="text-lg font-semibold">{statistik.sementaraL + statistik.sementaraP} penduduk</p>
            <div className="flex gap-2 mt-1 text-[10px] opacity-80">
              <span>L: {statistik.sementaraL}</span>
              <span>P: {statistik.sementaraP}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-semibold text-emerald-700">
            Data Penduduk Wajib KTP (Baru Masuk 17 Tahun)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {statistik.wajibKTPList.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Tidak ada penduduk yang baru masuk usia 17 tahun</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-rose-50 text-rose-700">
                    <th className="text-left p-2 font-semibold rounded-tl-lg">No</th>
                    <th className="text-left p-2 font-semibold">No. KK</th>
                    <th className="text-left p-2 font-semibold">NIK</th>
                    <th className="text-left p-2 font-semibold">Nama Lengkap</th>
                    <th className="text-left p-2 font-semibold">L/P</th>
                    <th className="text-left p-2 font-semibold">TTL</th>
                    <th className="text-left p-2 font-semibold">Status Keluarga</th>
                    <th className="text-left p-2 font-semibold rounded-tr-lg">KTP</th>
                  </tr>
                </thead>
                <tbody>
                  {statistik.wajibKTPList.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2">{idx + 1}</td>
                      <td className="p-2 font-mono text-[10px]">{item.noKK}</td>
                      <td className="p-2 font-mono text-[10px]">{item.nik}</td>
                      <td className="p-2 font-medium">{item.namaLengkap}</td>
                      <td className="p-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          item.jenisKelamin === 'LAKI-LAKI' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                        }`}>
                          {item.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}
                        </span>
                      </td>
                      <td className="p-2">{item.tempatLahir}, {item.tanggalLahir}</td>
                      <td className="p-2">{item.statusKeluarga}</td>
                      <td className="p-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          item.punyaKTP === 'SUDAH' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {item.punyaKTP === 'SUDAH' ? 'Sudah' : 'Belum'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-semibold text-emerald-700">Kejadian Bulan Ini</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="grid grid-cols-4 gap-2">
            {(['LAHIR', 'MATI', 'PINDAH', 'DATANG'] as const).map((type) => {
              const d = statistik.kejadianCounts[type];
              const color = type === 'LAHIR' ? 'text-green-600 bg-green-50'
                : type === 'MATI' ? 'text-red-600 bg-red-50'
                : type === 'PINDAH' ? 'text-orange-600 bg-orange-50'
                : 'text-blue-600 bg-blue-50';
              return (
                <div key={type} className={`${color} rounded-lg p-2 text-center`}>
                  <p className="text-[10px] font-semibold">{type}</p>
                  <p className="text-lg font-bold">{d.l + d.p}</p>
                  <div className="flex justify-center gap-2 text-[9px]">
                    <span>L: {d.l}</span>
                    <span>P: {d.p}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-semibold text-emerald-700">Distribusi Usia Penduduk (1-100 Tahun)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-1 max-h-72 overflow-y-auto text-[11px]">
            <div className="font-semibold bg-emerald-50 p-1.5 rounded">Usia (L/P)</div>
            <div className="font-semibold bg-emerald-50 p-1.5 rounded">Usia (L/P)</div>
            {Array.from({ length: Math.ceil(ageData.length / 2) }, (_, i) => (
              <div key={i} className="contents">
                <div className="flex justify-between p-1 border-b border-gray-50">
                  <span>Umur {ageData[i]?.age}</span>
                  <span className="font-medium">{ageData[i]?.l} / {ageData[i]?.p}</span>
                </div>
                <div className="flex justify-between p-1 border-b border-gray-50">
                  {ageData[i + Math.ceil(ageData.length / 2)] ? (
                    <>
                      <span>Umur {ageData[i + Math.ceil(ageData.length / 2)]?.age}</span>
                      <span className="font-medium">{ageData[i + Math.ceil(ageData.length / 2)]?.l} / {ageData[i + Math.ceil(ageData.length / 2)]?.p}</span>
                    </>
                  ) : (
                    <span>-</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
