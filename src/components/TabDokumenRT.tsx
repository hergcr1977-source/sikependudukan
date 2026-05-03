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
import { Plus, Pencil, Trash2, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { formatTanggal } from '@/lib/utils-kependudukan';

interface SuratPengantar {
  id: number;
  nomorSurat: string;
  namaPemohon: string;
  nik: string;
  tujuan: string;
  keterangan: string | null;
  createdAt: string;
}

interface TabDokumenRTProps {
  isAdmin?: boolean;
  isActive?: boolean;
}

export default function TabDokumenRT({ isAdmin = true, isActive = false }: TabDokumenRTProps) {
  const [suratList, setSuratList] = useState<SuratPengantar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nomorSurat: '',
    namaPemohon: '',
    nik: '',
    tujuan: '',
    keterangan: '',
  });
  const [formError, setFormError] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<SuratPengantar | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/surat-pengantar');
      if (res.ok) {
        const data = await res.json();
        setSuratList(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isActive) fetchData();
  }, [isActive, fetchData]);

  const openAdd = () => {
    setFormError('');
    setEditingId(null);
    setFormData({
      nomorSurat: '',
      namaPemohon: '',
      nik: '',
      tujuan: '',
      keterangan: '',
    });
    setShowForm(true);
  };

  const openEdit = (s: SuratPengantar) => {
    setFormError('');
    setEditingId(s.id);
    setFormData({
      nomorSurat: s.nomorSurat,
      namaPemohon: s.namaPemohon,
      nik: s.nik,
      tujuan: s.tujuan,
      keterangan: s.keterangan || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormError('');

    if (!formData.nomorSurat.trim()) { setFormError('Nomor surat wajib diisi'); return; }
    if (!formData.namaPemohon.trim()) { setFormError('Nama pemohon wajib diisi'); return; }
    if (!formData.nik.trim()) { setFormError('NIK wajib diisi'); return; }
    if (formData.nik.trim().length !== 16) { setFormError('NIK harus 16 digit'); return; }
    if (!formData.tujuan.trim()) { setFormError('Tujuan surat wajib diisi'); return; }

    try {
      const isEdit = !!editingId;
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = { ...formData };
      if (isEdit) body.id = editingId;

      const res = await apiFetch('/api/surat-pengantar', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(`Surat pengantar ${isEdit ? 'diperbarui' : 'ditambahkan'}`);
        setShowForm(false);
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
      const res = await apiFetch(`/api/surat-pengantar?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null);
        fetchData();
        toast.success('Surat pengantar berhasil dihapus');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal menghapus');
      }
    } catch {
      toast.error('Terjadi kesalahan koneksi');
    }
  };

  // Filter by search
  const filtered = suratList.filter(s => {
    const q = search.toLowerCase();
    return (
      s.nomorSurat.toLowerCase().includes(q) ||
      s.namaPemohon.toLowerCase().includes(q) ||
      s.nik.includes(q) ||
      s.tujuan.toLowerCase().includes(q)
    );
  });

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
          <FileText className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-emerald-800">Dokumen RT</h2>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1" /> Tambah Surat Pengantar
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9 text-sm"
          placeholder="Cari nomor surat, nama, NIK, tujuan..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Stats */}
      <div className="flex gap-3 justify-center text-sm">
        <Badge variant="outline" className="text-xs px-3 py-1">Total Surat: {suratList.length}</Badge>
        {search && (
          <Badge variant="outline" className="text-xs px-3 py-1">Ditemukan: {filtered.length}</Badge>
        )}
      </div>

      {/* List */}
      <ScrollArea className="max-h-[calc(100vh-320px)]">
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {search ? 'Tidak ditemukan surat yang cocok' : 'Belum ada data surat pengantar'}
            </div>
          )}
          {filtered.map(s => (
            <Card key={s.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px] px-2 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                        {s.nomorSurat}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate">{s.namaPemohon}</p>
                    <p className="text-[10px] text-muted-foreground">
                      NIK: {s.nik}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      Tujuan: {s.tujuan}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatTanggal(s.createdAt)}
                      {s.keterangan && ` · ${s.keterangan}`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => setDeleteTarget(s)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Surat Pengantar' : 'Tambah Surat Pengantar'}
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded">
              {formError}
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nomor Surat *</Label>
              <Input
                className="text-sm uppercase"
                placeholder="Contoh: 001/SP/RT001/V/2026"
                value={formData.nomorSurat}
                onChange={e => setFormData({ ...formData, nomorSurat: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nama Pemohon *</Label>
              <Input
                className="text-sm uppercase"
                placeholder="NAMA PEMOHON"
                value={formData.namaPemohon}
                onChange={e => setFormData({ ...formData, namaPemohon: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">NIK Pemohon *</Label>
              <Input
                className="text-sm"
                placeholder="16 digit NIK"
                value={formData.nik}
                onChange={e => setFormData({ ...formData, nik: e.target.value.replace(/[^0-9]/g, '').slice(0, 16) })}
                maxLength={16}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tujuan *</Label>
              <Input
                className="text-sm uppercase"
                placeholder="TUJUAN SURAT"
                value={formData.tujuan}
                onChange={e => setFormData({ ...formData, tujuan: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Keterangan</Label>
              <Input
                className="text-sm uppercase"
                placeholder="Keterangan tambahan (opsional)"
                value={formData.keterangan}
                onChange={e => setFormData({ ...formData, keterangan: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {editingId ? 'Update' : 'Simpan'}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Surat Pengantar?</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus surat <strong>{deleteTarget?.nomorSurat}</strong> atas nama <strong>{deleteTarget?.namaPemohon}</strong>?
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
