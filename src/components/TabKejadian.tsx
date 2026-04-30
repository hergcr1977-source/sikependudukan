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
import { Plus, Pencil, Trash2, CalendarDays, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { JENIS_KEJADIAN, JENIS_KELAMIN, STATUS_KELUARGA, AGAMA, PENDIDIKAN, PEKERJAAN, STATUS_PERKAWINAN, STATUS_KTP } from '@/lib/constants';
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

interface AnggotaKK {
  id: number;
  namaLengkap: string;
  nik: string;
  jenisKelamin: string;
  statusKeluarga: string;
}

interface AnggotaBaru {
  nik: string;
  namaLengkap: string;
  jenisKelamin: string;
  tanggalLahir: string;
  tempatLahir: string;
  statusKeluarga: string;
  agama: string;
  pendidikan: string;
  pekerjaan: string;
  statusPerkawinan: string;
  punyaKTP: string;
}

interface TabKejadianProps {
  isAdmin?: boolean;
  isActive?: boolean;
}

const emptyAnggotaBaru = (): AnggotaBaru => ({
  nik: '', namaLengkap: '', jenisKelamin: 'LAKI-LAKI', tanggalLahir: '',
  tempatLahir: '', statusKeluarga: 'LAINNYA', agama: 'ISLAM',
  pendidikan: 'TIDAK/BELUM SEKOLAH', pekerjaan: 'BELUM/TIDAK BEKERJA',
  statusPerkawinan: 'BELUM MENIKAH', punyaKTP: 'BELUM',
});

export default function TabKejadian({ isAdmin = true, isActive = false }: TabKejadianProps) {
  const [kejadian, setKejadian] = useState<Kejadian[]>([]);
  const [activeTab, setActiveTab] = useState<string>('LAHIR');
  const [loading, setLoading] = useState(true);
  const [kkOptions, setKKOptions] = useState<KKOption[]>([]);
  const [anggotaKK, setAnggotaKK] = useState<AnggotaKK[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [kkOpen, setKkOpen] = useState(false);
  const kkRef = useRef<HTMLDivElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<Kejadian | null>(null);

  // DATANG: anggota baru
  const [anggotaBaruList, setAnggotaBaruList] = useState<AnggotaBaru[]>([]);

  // Click outside KK dropdown
  useEffect(() => {
    if (!kkOpen) return;
    const handler = (e: MouseEvent) => {
      if (kkRef.current && !kkRef.current.contains(e.target as Node)) setKkOpen(false);
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
    } catch (error) { console.error(error); }
  }, []);

  const fetchAnggotaKK = useCallback(async (noKK: string) => {
    if (!noKK) { setAnggotaKK([]); return; }
    try {
      const res = await apiFetch('/api/penduduk');
      if (res.ok) {
        const data = await res.json();
        const members = data
          .filter((p: any) => p.noKK === noKK)
          .map((p: any) => ({
            id: p.id, namaLengkap: p.namaLengkap, nik: p.nik,
            jenisKelamin: p.jenisKelamin, statusKeluarga: p.statusKeluarga,
          }));
        setAnggotaKK(members);
      }
    } catch (error) { console.error(error); }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/kejadian?jenis=${activeTab}`);
      if (res.ok) setKejadian(await res.json());
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { fetchKKOptions(); }, [fetchKKOptions]);
  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);
  useEffect(() => { if (isActive) { fetchKKOptions(); fetchData(); } }, [isActive, fetchKKOptions, fetchData]);

  // Fetch anggota when noKK changes in form
  useEffect(() => {
    if (showForm && formData.noKK && (activeTab === 'MATI' || activeTab === 'PINDAH')) {
      fetchAnggotaKK(formData.noKK);
    }
  }, [showForm, formData.noKK, activeTab, fetchAnggotaKK]);

  const openAdd = () => {
    setFormError('');
    setAnggotaKK([]);
    setAnggotaBaruList([]);
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      jenisKejadian: activeTab,
      noKK: '',
      namaLengkap: '',
      nik: '',
      jenisKelamin: '',
      tanggal: today,
      keterangan: '',
      noKKBaru: '',
      tanggalLahir: today,
      tempatLahir: '',
      statusKeluarga: '',
    });
    setShowForm(true);
  };

  const openEdit = (k: Kejadian) => {
    setFormError('');
    setFormData({
      jenisKejadian: k.jenisKejadian,
      noKK: k.noKK || '',
      namaLengkap: k.namaLengkap,
      nik: k.nik || '',
      jenisKelamin: k.jenisKelamin || '',
      tanggal: k.tanggal.split('T')[0],
      keterangan: k.keterangan || '',
      noKKBaru: '',
      tanggalLahir: '',
      tempatLahir: '',
      statusKeluarga: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError('');
    const jenis = formData.jenisKejadian || activeTab;

    // Validation per jenis
    if (jenis === 'MATI') {
      if (!formData.noKK) { setFormError('No. KK wajib diisi'); return; }
      if (!formData.namaLengkap) { setFormError('Pilih anggota yang meninggal'); return; }
      if (!formData.tanggal) { setFormError('Tanggal kematian wajib diisi'); return; }
    }
    if (jenis === 'LAHIR') {
      if (!formData.noKK) { setFormError('No. KK wajib diisi'); return; }
      if (!formData.nik) { setFormError('NIK bayi wajib diisi'); return; }
      if (formData.nik.length !== 16) { setFormError('NIK harus 16 digit'); return; }
      if (!formData.namaLengkap) { setFormError('Nama bayi wajib diisi'); return; }
      if (!formData.tanggalLahir) { setFormError('Tanggal lahir wajib diisi'); return; }
    }
    if (jenis === 'PINDAH') {
      if (!formData.noKK) { setFormError('No. KK wajib diisi'); return; }
      if (!formData.namaLengkap) { setFormError('Pilih anggota yang pindah'); return; }
      if (!formData.tanggal) { setFormError('Tanggal pindah wajib diisi'); return; }
    }
    if (jenis === 'DATANG') {
      if (!formData.noKK && !formData.noKKBaru) { setFormError('No. KK tujuan wajib diisi'); return; }
      if (anggotaBaruList.length === 0) { setFormError('Tambahkan minimal 1 anggota keluarga'); return; }
      const hasComplete = anggotaBaruList.some(a => a.nik && a.namaLengkap);
      if (!hasComplete) { setFormError('NIK dan Nama anggota wajib diisi'); return; }
    }

    try {
      const body: Record<string, unknown> = {
        jenisKejadian: jenis,
        noKK: formData.noKK || '',
        namaLengkap: formData.namaLengkap || '',
        nik: formData.nik || '',
        jenisKelamin: formData.jenisKelamin || '',
        tanggal: jenis === 'LAHIR' ? formData.tanggalLahir || formData.tanggal : formData.tanggal,
        keterangan: formData.keterangan || '',
        noKKBaru: formData.noKKBaru || '',
      };

      // DATANG: kirim anggota baru
      if (jenis === 'DATANG') {
        body.anggotaBaru = anggotaBaruList;
      }

      const res = await apiFetch('/api/kejadian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const result = await res.json();
        let msg = `Kejadian ${jenis} ditambahkan`;
        if (jenis === 'MATI' && result.kkChanged) {
          msg += '. Kepala Keluarga otomatis diganti ke anggota keluarga.';
        }
        if (jenis === 'LAHIR') {
          msg += '. Penduduk baru otomatis ditambahkan ke database.';
        }
        if (jenis === 'DATANG') {
          msg += '. Anggota keluarga baru ditambahkan.';
        }
        toast.success(msg);
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
    } catch { toast.error('Terjadi kesalahan koneksi'); }
  };

  const filteredKejadian = kejadian.filter(k => k.jenisKejadian === activeTab);
  const countL = filteredKejadian.filter(k => k.jenisKelamin === 'LAKI-LAKI').length;
  const countP = filteredKejadian.filter(k => k.jenisKelamin === 'PEREMPUAN').length;

  const tabColors: Record<string, string> = {
    LAHIR: 'bg-green-500', MATI: 'bg-red-500',
    PINDAH: 'bg-orange-500', DATANG: 'bg-blue-500',
  };

  const getFilteredKK = () => {
    return kkOptions.filter(kk =>
      kk.noKK.includes(formData.noKK || '') ||
      kk.namaKepala.toLowerCase().includes((formData.noKK || '').toLowerCase())
    );
  };

  const renderKKDropdown = (label: string, required = false) => (
    <div ref={kkRef} className="space-y-1">
      <Label className="text-xs">{label} {required && '*'}</Label>
      <div className="relative">
        <Input
          className="text-sm pr-9"
          placeholder="Ketik atau pilih No. KK"
          value={formData.noKK || ''}
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
          <div className="max-h-48 overflow-y-auto p-1" style={{ scrollbarWidth: 'thin' }}>
            {getFilteredKK().length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-gray-400 text-center">Tidak ditemukan</div>
            ) : (
              getFilteredKK().map(kk => (
                <button
                  key={kk.noKK}
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-200"
                  onClick={() => { setFormData({ ...formData, noKK: kk.noKK }); setKkOpen(false); }}
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

  const renderNoKKBaru = () => (
    <div className="space-y-1">
      <Label className="text-xs">No. KK Baru (jika berubah)</Label>
      <Input
        className="text-sm"
        placeholder="Kosongkan jika tidak berubah"
        value={formData.noKKBaru || ''}
        onChange={e => setFormData({ ...formData, noKKBaru: e.target.value.replace(/[^0-9]/g, '').slice(0, 16) })}
        maxLength={16}
      />
    </div>
  );

  // ===== RENDER FORM PER JENIS =====
  const renderFormMATI = () => (
    <div className="space-y-3">
      {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded">{formError}</div>}

      <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-[11px] text-red-700">
        <strong>Kematian</strong> — Pilih anggota keluarga yang meninggal.
        Jika Kepala Keluarga meninggal, istri akan otomatis menjadi Kepala Keluarga baru.
      </div>

      {renderKKDropdown('No. KK', true)}

      {/* Anggota KK dropdown */}
      <div className="space-y-1">
        <Label className="text-xs">Anggota yang Meninggal *</Label>
        <Select
          value={formData.nik || ''}
          onValueChange={v => {
            const selected = anggotaKK.find(a => a.nik === v);
            if (selected) {
              setFormData({ ...formData, nik: selected.nik, namaLengkap: selected.namaLengkap, jenisKelamin: selected.jenisKelamin });
            }
          }}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder={anggotaKK.length === 0 ? 'Pilih KK terlebih dahulu' : 'Pilih anggota'} />
          </SelectTrigger>
          <SelectContent>
            {anggotaKK.map(a => (
              <SelectItem key={a.nik} value={a.nik}>
                {a.namaLengkap} ({a.statusKeluarga}) — {a.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Tanggal Kematian *</Label>
        <Input type="date" className="text-sm" value={formData.tanggal || ''} onChange={e => setFormData({ ...formData, tanggal: e.target.value })} />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Keterangan</Label>
        <Input className="text-sm uppercase" value={formData.keterangan || ''} onChange={e => setFormData({ ...formData, keterangan: e.target.value.toUpperCase() })} placeholder="Sebab/lokasi kematian" />
      </div>

      {renderNoKKBaru()}
    </div>
  );

  const renderFormLAHIR = () => (
    <div className="space-y-3">
      {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded">{formError}</div>}

      <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-[11px] text-green-700">
        <strong>Kelahiran</strong> — Bayi akan otomatis ditambahkan ke data penduduk dengan status ANAK.
      </div>

      {renderKKDropdown('No. KK', true)}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">NIK Bayi *</Label>
          <Input className="text-sm" value={formData.nik || ''} onChange={e => setFormData({ ...formData, nik: e.target.value.replace(/[^0-9]/g, '').slice(0, 16) })} maxLength={16} placeholder="16 digit" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Jenis Kelamin *</Label>
          <Select value={formData.jenisKelamin || ''} onValueChange={v => setFormData({ ...formData, jenisKelamin: v })}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Pilih" /></SelectTrigger>
            <SelectContent>{JENIS_KELAMIN.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Nama Lengkap *</Label>
        <Input className="text-sm uppercase" value={formData.namaLengkap || ''} onChange={e => setFormData({ ...formData, namaLengkap: e.target.value.toUpperCase() })} placeholder="NAMA BAYI" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tempat Lahir</Label>
          <Input className="text-sm uppercase" value={formData.tempatLahir || ''} onChange={e => setFormData({ ...formData, tempatLahir: e.target.value.toUpperCase() })} placeholder="BOGOR" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tanggal Lahir *</Label>
          <Input type="date" className="text-sm" value={formData.tanggalLahir || ''} onChange={e => setFormData({ ...formData, tanggalLahir: e.target.value })} />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Keterangan</Label>
        <Input className="text-sm uppercase" value={formData.keterangan || ''} onChange={e => setFormData({ ...formData, keterangan: e.target.value.toUpperCase() })} placeholder="LAHIR DI RS, RUMAH, DLL." />
      </div>

      {renderNoKKBaru()}
    </div>
  );

  const renderFormPINDAH = () => (
    <div className="space-y-3">
      {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded">{formError}</div>}

      <div className="bg-orange-50 border border-orange-200 rounded px-3 py-2 text-[11px] text-orange-700">
        <strong>Pindah</strong> — Catatan penduduk yang pindah dari wilayah RT.
      </div>

      {renderKKDropdown('No. KK', true)}

      <div className="space-y-1">
        <Label className="text-xs">Anggota yang Pindah *</Label>
        <Select
          value={formData.nik || ''}
          onValueChange={v => {
            const selected = anggotaKK.find(a => a.nik === v);
            if (selected) {
              setFormData({ ...formData, nik: selected.nik, namaLengkap: selected.namaLengkap, jenisKelamin: selected.jenisKelamin });
            }
          }}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder={anggotaKK.length === 0 ? 'Pilih KK terlebih dahulu' : 'Pilih anggota'} />
          </SelectTrigger>
          <SelectContent>
            {anggotaKK.map(a => (
              <SelectItem key={a.nik} value={a.nik}>
                {a.namaLengkap} ({a.statusKeluarga}) — {a.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Tanggal Pindah *</Label>
        <Input type="date" className="text-sm" value={formData.tanggal || ''} onChange={e => setFormData({ ...formData, tanggal: e.target.value })} />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Keterangan</Label>
        <Input className="text-sm uppercase" value={formData.keterangan || ''} onChange={e => setFormData({ ...formData, keterangan: e.target.value.toUpperCase() })} placeholder="PINDAH KE RT/RW MANA, ALASAN, DLL." />
      </div>
    </div>
  );

  const renderFormDATANG = () => (
    <div className="space-y-3">
      {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded">{formError}</div>}

      <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-[11px] text-blue-700">
        <strong>Datang</strong> — Penduduk baru yang pindah ke wilayah RT.
        Pilih KK tujuan atau buat KK baru.
      </div>

      {renderKKDropdown('No. KK Tujuan (pilih jika sudah ada)')}

      <div className="space-y-1">
        <Label className="text-xs">No. KK Baru (jika belum ada, buat baru)</Label>
        <Input
          className="text-sm"
          placeholder="16 digit — kosongkan jika memilih KK di atas"
          value={formData.noKKBaru || ''}
          onChange={e => setFormData({ ...formData, noKKBaru: e.target.value.replace(/[^0-9]/g, '').slice(0, 16) })}
          maxLength={16}
        />
      </div>

      {/* Anggota Baru */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold">Anggota Keluarga Baru *</Label>
          <Button
            type="button" size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => setAnggotaBaruList([...anggotaBaruList, emptyAnggotaBaru()])}
          >
            <UserPlus className="h-3 w-3 mr-1" /> Tambah Anggota
          </Button>
        </div>

        {anggotaBaruList.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3 border border-dashed rounded">Belum ada anggota. Klik "Tambah Anggota".</p>
        )}

        {anggotaBaruList.map((a, idx) => (
          <div key={idx} className="bg-gray-50 border rounded-lg p-3 space-y-2 relative">
            <button
              type="button" className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
              onClick={() => setAnggotaBaruList(anggotaBaruList.filter((_, i) => i !== idx))}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="text-[10px] font-bold text-gray-500">ANGGOTA #{idx + 1}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label className="text-[10px] text-gray-500">NIK *</label>
                <Input className="text-xs h-8" value={a.nik} onChange={e => {
                  const updated = [...anggotaBaruList]; updated[idx] = { ...updated[idx], nik: e.target.value.replace(/[^0-9]/g, '').slice(0, 16) }; setAnggotaBaruList(updated);
                }} maxLength={16} />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-gray-500">Nama *</label>
                <Input className="text-xs h-8 uppercase" value={a.namaLengkap} onChange={e => {
                  const updated = [...anggotaBaruList]; updated[idx] = { ...updated[idx], namaLengkap: e.target.value.toUpperCase() }; setAnggotaBaruList(updated);
                }} />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-gray-500">Jenis Kelamin</label>
                <Select value={a.jenisKelamin} onValueChange={v => {
                  const updated = [...anggotaBaruList]; updated[idx] = { ...updated[idx], jenisKelamin: v }; setAnggotaBaruList(updated);
                }}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{JENIS_KELAMIN.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-gray-500">Status Keluarga</label>
                <Select value={a.statusKeluarga} onValueChange={v => {
                  const updated = [...anggotaBaruList]; updated[idx] = { ...updated[idx], statusKeluarga: v }; setAnggotaBaruList(updated);
                }}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_KELUARGA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-gray-500">Tempat Lahir</label>
                <Input className="text-xs h-8 uppercase" value={a.tempatLahir} onChange={e => {
                  const updated = [...anggotaBaruList]; updated[idx] = { ...updated[idx], tempatLahir: e.target.value.toUpperCase() }; setAnggotaBaruList(updated);
                }} />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-gray-500">Tanggal Lahir</label>
                <Input type="date" className="text-xs h-8" value={a.tanggalLahir} onChange={e => {
                  const updated = [...anggotaBaruList]; updated[idx] = { ...updated[idx], tanggalLahir: e.target.value }; setAnggotaBaruList(updated);
                }} />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-gray-500">Agama</label>
                <Select value={a.agama} onValueChange={v => {
                  const updated = [...anggotaBaruList]; updated[idx] = { ...updated[idx], agama: v }; setAnggotaBaruList(updated);
                }}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{AGAMA.map(a2 => <SelectItem key={a2} value={a2}>{a2}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-gray-500">Pekerjaan</label>
                <Select value={a.pekerjaan} onValueChange={v => {
                  const updated = [...anggotaBaruList]; updated[idx] = { ...updated[idx], pekerjaan: v }; setAnggotaBaruList(updated);
                }}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{PEKERJAAN.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Keterangan</Label>
        <Input className="text-sm uppercase" value={formData.keterangan || ''} onChange={e => setFormData({ ...formData, keterangan: e.target.value.toUpperCase() })} placeholder="ASAL PINDAH, ALASAN, DLL." />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const renderActiveForm = () => {
    switch (activeTab) {
      case 'MATI': return renderFormMATI();
      case 'LAHIR': return renderFormLAHIR();
      case 'PINDAH': return renderFormPINDAH();
      case 'DATANG': return renderFormDATANG();
      default: return null;
    }
  };

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Kejadian — {activeTab}</DialogTitle>
          </DialogHeader>
          {renderActiveForm()}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              Simpan {activeTab}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
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
