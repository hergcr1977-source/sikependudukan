'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Pencil, Trash2, CalendarDays, UserPlus, Home, Search, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  JENIS_KEJADIAN, AGAMA, PENDIDIKAN, PEKERJAAN,
  STATUS_PERKAWINAN, BANTUAN_OPTIONS, STATUS_KTP, STATUS_KELUARGA, JENIS_KELAMIN,
} from '@/lib/constants';
import { formatTanggal } from '@/lib/utils-kependudukan';

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

interface PendudukItem {
  id: number;
  noKK: string;
  nik: string;
  namaLengkap: string;
  jenisKelamin: string;
  statusKeluarga: string;
}

interface KKOption {
  noKK: string;
  namaKepala: string;
}

const STATUS_ANGGOTA = STATUS_KELUARGA.filter(s => s !== 'KEPALA KELUARGA');

interface FormKejadian {
  jenisKejadian: string;
  noKK: string;
  namaLengkap: string;
  nik: string;
  jenisKelamin: string;
  tanggal: string;
  keterangan: string;
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
  namaPanggilan: string;
  noHP: string;
  punyaKTP: string;
  bantuan: string[];
}

const defaultForm: FormKejadian = {
  jenisKejadian: 'LAHIR',
  noKK: '',
  namaLengkap: '',
  nik: '',
  jenisKelamin: '',
  tanggal: '',
  keterangan: '',
  statusKeluarga: 'ANAK',
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
  bantuan: [],
};

interface TabKejadianProps {
  isAdmin?: boolean;
}

export default function TabKejadian({ isAdmin = true }: TabKejadianProps) {
  const [kejadian, setKejadian] = useState<Kejadian[]>([]);
  const [activeTab, setActiveTab] = useState<string>('LAHIR');
  const [loading, setLoading] = useState(true);
  const [kkOptions, setKKOptions] = useState<KKOption[]>([]);
  const [allPenduduk, setAllPenduduk] = useState<PendudukItem[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormKejadian>(defaultForm);
  const [formError, setFormError] = useState('');
  const [kkOpen, setKkOpen] = useState(false);
  const kkRef = useRef<HTMLDivElement>(null);

  const [modeDatang, setModeDatang] = useState<'EKSISTING' | 'BARU'>('EKSISTING');
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
      const res = await fetch('/api/penduduk');
      if (res.ok) {
        const data = await res.json();
        setAllPenduduk(data);
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
      const res = await fetch(`/api/kejadian?jenis=${activeTab}`);
      if (res.ok) setKejadian(await res.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchKKOptions(); }, [fetchKKOptions]);
  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  const kkMembers = allPenduduk.filter(p => p.noKK === formData.noKK);

  const isDatang = formData.jenisKejadian === 'DATANG';
  const isLahir = formData.jenisKejadian === 'LAHIR';
  const isMatiOrPindah = formData.jenisKejadian === 'MATI' || formData.jenisKejadian === 'PINDAH';
  const showFamilyForm = (isDatang || isLahir) && !editingId;

  const openAdd = () => {
    setEditingId(null);
    setFormError('');
    setModeDatang('EKSISTING');
    setFormData({
      ...defaultForm,
      jenisKejadian: activeTab,
      tanggal: new Date().toISOString().split('T')[0],
      bantuan: [],
      statusKeluarga: activeTab === 'LAHIR' ? 'ANAK' : '',
    });
    setShowForm(true);
  };

  const handleModeDatang = (mode: 'EKSISTING' | 'BARU') => {
    setModeDatang(mode);
    if (mode === 'BARU') {
      setFormData(prev => ({ ...prev, noKK: '', statusKeluarga: 'KEPALA KELUARGA' }));
    } else {
      setFormData(prev => ({ ...prev, noKK: '', statusKeluarga: '' }));
    }
  };

  const handleSelectMember = (nik: string) => {
    const member = allPenduduk.find(p => p.nik === nik);
    if (member) {
      setFormData(prev => ({
        ...prev,
        nik: member.nik,
        namaLengkap: member.namaLengkap,
        jenisKelamin: member.jenisKelamin,
      }));
    }
  };

  const openEdit = (k: Kejadian) => {
    setEditingId(k.id);
    setFormError('');
    setFormData({
      ...defaultForm,
      jenisKejadian: k.jenisKejadian,
      noKK: k.noKK,
      namaLengkap: k.namaLengkap,
      nik: k.nik || '',
      jenisKelamin: k.jenisKelamin,
      tanggal: k.tanggal.split('T')[0],
      keterangan: k.keterangan || '',
      bantuan: [],
    });
    setShowForm(true);
  };

  const updateField = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleBantuan = (item: string) => {
    setFormData(prev => ({
      ...prev,
      bantuan: prev.bantuan.includes(item)
        ? prev.bantuan.filter(b => b !== item)
        : [...prev.bantuan, item],
    }));
  };

  const handleSubmit = async () => {
    setFormError('');

    if (!formData.namaLengkap || !formData.tanggal) {
      setFormError('Data wajib belum lengkap');
      return;
    }

    if (isMatiOrPindah) {
      if (!formData.noKK) {
        setFormError('Pilih No. KK');
        return;
      }
      if (!formData.nik) {
        setFormError('Pilih penduduk atau masukkan NIK');
        return;
      }
    }

    if (isLahir && !editingId) {
      if (!formData.noKK) {
        setFormError('No. KK wajib diisi');
        return;
      }
      if (!formData.tanggalLahir) {
        setFormError('Tanggal lahir wajib diisi');
        return;
      }
      if (!formData.jenisKelamin) {
        setFormError('Jenis kelamin wajib diisi');
        return;
      }
    }

    if (isDatang && !editingId) {
      if (!formData.noKK) {
        setFormError('No. KK wajib diisi untuk kejadian DATANG');
        return;
      }
      if (modeDatang === 'BARU' && formData.noKK.length !== 16) {
        setFormError('No. KK baru harus 16 digit angka');
        return;
      }
      if (formData.nik && formData.nik.length !== 16) {
        setFormError('NIK harus 16 digit angka');
        return;
      }
      if (!formData.tanggalLahir) {
        setFormError('Tanggal lahir wajib diisi untuk menambah anggota keluarga');
        return;
      }
      if (!formData.jenisKelamin) {
        setFormError('Jenis kelamin wajib diisi');
        return;
      }
      if (!formData.statusKeluarga) {
        setFormError('Status keluarga wajib diisi');
        return;
      }
    }

    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId
        ? { id: editingId, ...formData }
        : { ...formData, modeDatang };

      const res = await fetch('/api/kejadian', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const result = await res.json();

        if (result.pendudukAdded && isLahir) {
          toast.success('Kejadian LAHIR ditambahkan & penduduk baru disimpan');
        } else if (result.pendudukAdded && isDatang) {
          if (result.kkBaru) {
            toast.success('Kejadian ditambahkan & KK Baru berhasil dibuat');
          } else {
            toast.success('Kejadian ditambahkan & Anggota keluarga berhasil disimpan');
          }
        } else if (result.pendudukRemoved) {
          if (result.kkDissolved) {
            toast.success(`Kejadian ${formData.jenisKejadian} dicatat. KK ${formData.noKK} dibubarkan (sudah tidak ada anggota).`);
          } else if (result.kkHeadChanged) {
            toast.success(`Kejadian ${formData.jenisKejadian} dicatat. KK Head diubah ke ${result.kkHeadChanged}.`);
          } else {
            toast.success(`Kejadian ${formData.jenisKejadian} dicatat & penduduk dihapus.`);
          }
        } else {
          toast.success(editingId ? 'Kejadian diupdate' : 'Kejadian ditambahkan');
        }
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
    const res = await fetch(`/api/kejadian?id=${deleteTarget.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Kejadian dihapus');
      setDeleteTarget(null);
      fetchData();
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
                      KK: {k.noKK} · {k.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'} · {k.nik || '-'}
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

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Kejadian' : `Tambah Kejadian - ${formData.jenisKejadian}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded">{formError}</div>
            )}

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

            {/* ============ NO. KK ============ */}
            {isDatang && !editingId ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Gabung ke KK</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleModeDatang('EKSISTING')}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border-2 p-2.5 text-xs font-semibold transition-all ${
                        modeDatang === 'EKSISTING'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {'KK Eksisting'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeDatang('BARU')}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border-2 p-2.5 text-xs font-semibold transition-all ${
                        modeDatang === 'BARU'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Home className="h-3.5 w-3.5" />
                      {'KK Baru'}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">No. KK *</Label>
                  {modeDatang === 'EKSISTING' ? (
                    renderKKDropdown()
                  ) : (
                    <Input
                      className="text-sm"
                      placeholder="Masukkan 16 digit No. KK baru"
                      value={formData.noKK}
                      onChange={e => setFormData({ ...formData, noKK: e.target.value.replace(/[^0-9]/g, '').slice(0, 16) })}
                      maxLength={16}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">No. KK</Label>
                {renderKKDropdown()}
              </div>
            )}

            {/* ============ MATI / PINDAH: Pilih Penduduk ============ */}
            {isMatiOrPindah && !editingId && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Pilih Penduduk</Label>
                  <Select
                    value={formData.nik}
                    onValueChange={v => handleSelectMember(v)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder={kkMembers.length > 0 ? 'Pilih anggota KK...' : 'Pilih KK terlebih dahulu'} />
                    </SelectTrigger>
                    <SelectContent>
                      {kkMembers.map(m => (
                        <SelectItem key={m.nik} value={m.nik}>
                          {m.statusKeluarga === 'KEPALA KELUARGA' ? '⭐ ' : ''}{m.namaLengkap} ({m.nik})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.nik && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                    <p className="font-semibold">
                      ⚠️ Penduduk akan dihapus dari data KK
                    </p>
                    <p className="mt-0.5">
                      {formData.namaLengkap} ({formData.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}) — NIK: {formData.nik}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nama</Label>
                    <Input className="text-sm bg-gray-50" value={formData.namaLengkap} disabled />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">NIK</Label>
                    <Input className="text-sm bg-gray-50" value={formData.nik} disabled />
                  </div>
                </div>
              </>
            )}

            {/* ============ LAHIR/DATANG: Form Anggota Keluarga ============ */}
            {showFamilyForm && (
              <>
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
                    <Label className="text-xs">NIK {isDatang ? '*' : ''}</Label>
                    <Input
                      className="text-sm"
                      value={formData.nik}
                      onChange={e => setFormData({ ...formData, nik: e.target.value })}
                      placeholder={isDatang ? '16 digit angka' : 'Opsional (belum ada NIK)'}
                      maxLength={16}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Jenis Kelamin *</Label>
                    <Select value={formData.jenisKelamin} onValueChange={v => setFormData({ ...formData, jenisKelamin: v })}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                      <SelectContent>
                        {JENIS_KELAMIN.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Status Keluarga</Label>
                    {isLahir ? (
                      <Input className="text-sm bg-gray-50" value="ANAK" disabled />
                    ) : modeDatang === 'BARU' ? (
                      <Input className="text-sm bg-gray-50" value="KEPALA KELUARGA" disabled />
                    ) : (
                      <Select value={formData.statusKeluarga} onValueChange={v => updateField('statusKeluarga', v)}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
                        <SelectContent>
                          {STATUS_ANGGOTA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
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
                    <Label className="text-xs">Tempat Lahir</Label>
                    <Input className="text-sm uppercase" value={formData.tempatLahir} onChange={e => updateField('tempatLahir', e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tanggal Lahir *</Label>
                    <Input type="date" className="text-sm" value={formData.tanggalLahir} onChange={e => updateField('tanggalLahir', e.target.value)} />
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
                    <Label className="text-xs">Kewarganegaraan</Label>
                    <Input className="text-sm uppercase" value={formData.kewarganegaraan} onChange={e => updateField('kewarganegaraan', e.target.value.toUpperCase())} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nama Ayah</Label>
                    <Input className="text-sm uppercase" value={formData.namaAyah} onChange={e => updateField('namaAyah', e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nama Ibu</Label>
                    <Input className="text-sm uppercase" value={formData.namaIbu} onChange={e => updateField('namaIbu', e.target.value.toUpperCase())} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nama Panggilan</Label>
                    <Input className="text-sm uppercase" value={formData.namaPanggilan} onChange={e => updateField('namaPanggilan', e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">No. HP</Label>
                    <Input className="text-sm" value={formData.noHP} onChange={e => updateField('noHP', e.target.value)} />
                  </div>
                </div>

                {isDatang && (
                  <div className="space-y-1">
                    <Label className="text-xs">Status KTP</Label>
                    <Select value={formData.punyaKTP} onValueChange={v => updateField('punyaKTP', v)}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_KTP.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Bantuan Sosial</Label>
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

                {isDatang && (
                  <div className="border-t border-blue-200 pt-3 mt-1">
                    <div className="flex items-center gap-2 mb-2">
                      {modeDatang === 'BARU' ? (
                        <Home className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <UserPlus className="h-4 w-4 text-blue-600" />
                      )}
                      <span className={`text-sm font-semibold ${modeDatang === 'BARU' ? 'text-emerald-700' : 'text-blue-700'}`}>
                        {modeDatang === 'BARU' ? 'Buat KK Baru (Kepala Keluarga)' : 'Tambah sebagai Anggota Keluarga'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {modeDatang === 'BARU'
                        ? 'Orang ini akan didaftarkan sebagai Kepala Keluarga baru di wilayah RT.'
                        : 'Data berikut akan disimpan sebagai anggota keluarga baru pada KK yang dipilih.'}
                    </p>
                  </div>
                )}
              </>
            )}

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
              <Label className="text-xs">Keterangan</Label>
              <Input
                className="text-sm"
                value={formData.keterangan}
                onChange={e => setFormData({ ...formData, keterangan: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {editingId ? 'Simpan' : isMatiOrPindah ? `Catat ${formData.jenisKejadian} & Hapus Penduduk` : 'Tambah'}
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
