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
import { Plus, Pencil, Trash2, CalendarDays, Search } from 'lucide-react';
import { toast } from 'sonner';
import { JENIS_KEJADIAN, JENIS_KELAMIN } from '@/lib/constants';
import { formatTanggal } from '@/lib/utils-kependudukan';
import { apiFetch } from '@/lib/api';

interface Kejadian {
  id: number;
  jenisKejadian: string;
  noKK: string;
  namaLengkap: string;
  nik: string | null;
  jenisKelamin: string;
  tanggal: string;
  keterangan: string | null;
}

interface KKOption {
  noKK: string;
  namaKepala: string;
}

interface FormKejadian {
  jenisKejadian: string;
  noKK: string;
  namaLengkap: string;
  nik: string;
  jenisKelamin: string;
  tanggal: string;
  keterangan: string;
}

const defaultForm: FormKejadian = {
  jenisKejadian: 'LAHIR',
  noKK: '',
  namaLengkap: '',
  nik: '',
  jenisKelamin: '',
  tanggal: '',
  keterangan: '',
};

interface TabKejadianProps {
  isAdmin?: boolean;
  isActive?: boolean;
}

export default function TabKejadian({ isAdmin = true, isActive = false }: TabKejadianProps) {
  const [kejadian, setKejadian] = useState<Kejadian[]>([]);
  const [activeTab, setActiveTab] = useState<string>('LAHIR');
  const [loading, setLoading] = useState(true);
  const [kkOptions, setKKOptions] = useState<KKOption[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormKejadian>(defaultForm);
  const [formError, setFormError] = useState('');
  const [kkOpen, setKkOpen] = useState(false);
  const kkRef = useRef<HTMLDivElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<Kejadian | null>(null);

  // Click outside to close KK dropdown
  useEffect(() => {
    if (!kkOpen) return;
    const handler = (e: MouseEvent) => {
      if (kkRef.current && !kkRef.current.contains(e.target as Node)) {
        setKkOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [kkOpen]);

  const fetchKKOptions = useCallback(async () => {
    try {
      const res = await apiFetch('/api/penduduk');
      if (res.ok) {
        const data = await res.json();
        const seen = new Set<string>();
        const options: KKOption[] = [];
        for (const p of data) {
          if (p.statusKeluarga === 'KEPALA KELUARGA' && !seen.has(p.noKK)) {
            seen.add(p.noKK);
            options.push({ noKK: p.noKK, namaKepala: p.namaLengkap });
          }
        }
        setKKOptions(options);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/kejadian?jenis=${activeTab}`);
      if (res.ok) setKejadian(await res.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchKKOptions(); }, [fetchKKOptions]);
  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  useEffect(() => {
    if (isActive) { fetchKKOptions(); fetchData(); }
  }, [isActive, fetchKKOptions, fetchData]);

  const openAdd = () => {
    setEditingId(null);
    setFormError('');
    setFormData({
      ...defaultForm,
      jenisKejadian: activeTab,
      tanggal: new Date().toISOString().split('T')[0],
    });
    setShowForm(true);
  };

  const openEdit = (k: Kejadian) => {
    setEditingId(k.id);
    setFormError('');
    setFormData({
      jenisKejadian: k.jenisKejadian,
      noKK: k.noKK || '',
      namaLengkap: k.namaLengkap,
      nik: k.nik || '',
      jenisKelamin: k.jenisKelamin || '',
      tanggal: k.tanggal.split('T')[0],
      keterangan: k.keterangan || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError('');

    if (!formData.namaLengkap || !formData.tanggal) {
      setFormError('Nama dan tanggal kejadian wajib diisi');
      return;
    }

    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId
        ? { id: editingId, ...formData }
        : formData;

      const res = await apiFetch('/api/kejadian', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(editingId ? 'Kejadian diupdate' : 'Kejadian ditambahkan');
        setShowForm(false);
        fetchKKOptions();
        fetchData();
      } else {
        const err = await res.json();
        setFormError(err.error || 'Gagal menyimpan');
      }
    } catch {
      setFormError('Terjadi kesalahan');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiFetch(`/api/kejadian?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null);
        fetchData();
        toast.success('Kejadian berhasil dihapus');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal menghapus kejadian');
      }
    } catch {
      toast.error('Terjadi kesalahan koneksi');
    }
  };

  const filteredKejadian = kejadian.filter(k => k.jenisKejadian === activeTab);
  const countL = filteredKejadian.filter(k => k.jenisKelamin === 'LAKI-LAKI').length;
  const countP = filteredKejadian.filter(k => k.jenisKelamin === 'PEREMPUAN').length;

  const tabColors: Record<string, string> = {
    LAHIR: 'bg-green-500',
    MATI: 'bg-red-500',
    PINDAH: 'bg-orange-500',
    DATANG: 'bg-blue-500',
  };

  const getFilteredKK = () => {
    return kkOptions.filter(kk =>
      kk.noKK.includes(formData.noKK) || kk.namaKepala.toLowerCase().includes(formData.noKK.toLowerCase())
    );
  };

  const renderKKDropdown = () => (
    <div ref={kkRef} className="relative">
      <div className="relative">
        <Input
          className="text-sm pr-9"
          placeholder="Ketik atau pilih No. KK"
          value={formData.noKK}
          onChange={e => {
            setFormData({ ...formData, noKK: e.target.value.replace(/[^0-9]/g, '').slice(0, 16) });
            setKkOpen(true);
          }}
          onFocus={() => setKkOpen(true)}
        />
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>
      {kkOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
          <div
            className="max-h-48 overflow-y-auto p-1"
            style={{ scrollbarWidth: 'thin' }}
          >
            {getFilteredKK().length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-gray-400 text-center">
                Tidak ditemukan
              </div>
            ) : (
              getFilteredKK().map(kk => (
                <button
                  key={kk.noKK}
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-200"
                  onClick={() => {
                    setFormData({ ...formData, noKK: kk.noKK });
                    setKkOpen(false);
                  }}
                >
                  <span className="font-mono text-xs font-medium">{kk.noKK}</span>
                  <span className="ml-2 text-xs text-gray-500">{kk.namaKepala}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-emerald-800">Kejadian</h2>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1" /> Tambah {activeTab}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {JENIS_KEJADIAN.map(type => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`rounded-lg p-2.5 text-center transition-all ${
              activeTab === type
                ? `${tabColors[type]} text-white shadow-md scale-105`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <p className="text-xs font-bold">{type}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-3 justify-center text-sm">
        <Badge variant="outline" className="text-xs px-3 py-1">Total: {filteredKejadian.length}</Badge>
        <Badge variant="outline" className="text-xs px-3 py-1">L: {countL}</Badge>
        <Badge variant="outline" className="text-xs px-3 py-1">P: {countP}</Badge>
      </div>

      <ScrollArea className="max-h-[calc(100vh-320px)]">
        <div className="space-y-2">
          {filteredKejadian.map(k => (
            <Card key={k.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{k.namaLengkap}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {k.noKK ? `KK: ${k.noKK} · ` : ''}{k.jenisKelamin ? `${k.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'} · ` : ''}{k.nik || '-'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Tanggal: {formatTanggal(k.tanggal)}
                      {k.keterangan && ` · ${k.keterangan}`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(k)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => setDeleteTarget(k)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredKejadian.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Tidak ada data kejadian {activeTab}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Form Dialog — Sederhana, murni catatan laporan */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Kejadian' : `Tambah Kejadian — ${formData.jenisKejadian}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded">{formError}</div>
            )}

            <p className="text-[11px] text-muted-foreground bg-blue-50 border border-blue-100 rounded px-3 py-2">
              Catatan laporan saja. Data kejadian yang dihapus atau diubah <strong>tidak mempengaruhi</strong> jumlah penduduk dan KK.
            </p>

            <div className="space-y-1">
              <Label className="text-xs">Jenis Kejadian</Label>
              <Select
                value={formData.jenisKejadian}
                onValueChange={v => setFormData({ ...formData, jenisKejadian: v })}
                disabled={!!editingId}
              >
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{JENIS_KEJADIAN.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">No. KK (opsional)</Label>
              {renderKKDropdown()}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nama Lengkap *</Label>
              <Input
                className="text-sm uppercase"
                value={formData.namaLengkap}
                onChange={e => setFormData({ ...formData, namaLengkap: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">NIK (opsional)</Label>
                <Input
                  className="text-sm"
                  value={formData.nik}
                  onChange={e => setFormData({ ...formData, nik: e.target.value.replace(/[^0-9]/g, '').slice(0, 16) })}
                  maxLength={16}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Jenis Kelamin (opsional)</Label>
                <Select value={formData.jenisKelamin} onValueChange={v => setFormData({ ...formData, jenisKelamin: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {JENIS_KELAMIN.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tanggal Kejadian *</Label>
              <Input
                type="date"
                className="text-sm"
                value={formData.tanggal}
                onChange={e => setFormData({ ...formData, tanggal: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Keterangan (opsional)</Label>
              <Input
                className="text-sm"
                value={formData.keterangan}
                onChange={e => setFormData({ ...formData, keterangan: e.target.value })}
                placeholder="Contoh: pindah ke RT 03, meninggal di RS, dll."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {editingId ? 'Simpan' : 'Tambah Kejadian'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kejadian?</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus kejadian <strong>{deleteTarget?.jenisKejadian}</strong> atas nama <strong>{deleteTarget?.namaLengkap}</strong>?
              <br /><br />
              <span className="text-muted-foreground">Data ini hanya catatan laporan. Penghapusan tidak mempengaruhi data penduduk atau KK.</span>
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
