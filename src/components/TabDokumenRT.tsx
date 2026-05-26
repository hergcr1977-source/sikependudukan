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
import { Plus, Pencil, Trash2, FileText, Search, Printer, Eye, ImageDown } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { formatTanggal } from '@/lib/utils-kependudukan';
import html2canvas from 'html2canvas';

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
  rtInfo?: {
    namaRT: string;
    rw: string;
    kelurahan: string;
    kecamatan: string;
    kabupaten: string;
    provinsi: string;
    ketuaRT: string | null;
  } | null;
}

export default function TabDokumenRT({ isAdmin = true, isActive = false, rtInfo }: TabDokumenRTProps) {
  const [suratList, setSuratList] = useState<SuratPengantar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [previewSurat, setPreviewSurat] = useState<SuratPengantar | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

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

  // Helper untuk format tanggal
  const getTanggalHariIni = () => {
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const today = new Date();
    return `${today.getDate()} ${bulan[today.getMonth()]} ${today.getFullYear()}`;
  };

  // Cetak surat
  const handleCetakSurat = (surat: SuratPengantar) => {
    const kelurahan = rtInfo?.kelurahan || 'SUKAMAJU';
    const kecamatan = rtInfo?.kecamatan || 'CIBUNGBULANG';
    const kabupaten = rtInfo?.kabupaten || 'BOGOR';
    const provinsi = rtInfo?.provinsi || 'JAWA BARAT';
    const namaRT = rtInfo?.namaRT || '001';
    const rw = rtInfo?.rw || '002';
    const ketuaRT = rtInfo?.ketuaRT || '...........................';

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Surat Pengantar - ${surat.namaPemohon}</title>
        <style>
          @page { size: A4; margin: 2cm 2.5cm; }
          body { font-family: 'Times New Roman', serif; padding: 20px 30px; margin: 0; font-size: 12pt; line-height: 1.6; color: #000; }
          .kop-title { font-size: 14pt; font-weight: bold; text-align: center; margin: 0; }
          .kop-subtitle { font-size: 12pt; font-weight: bold; text-align: center; margin: 3px 0; }
          .kop-address { font-size: 10pt; text-align: center; margin: 0; }
          .garis { border-top: 3px double #000; margin: 10px 0; }
          .judul { text-align: center; font-size: 14pt; font-weight: bold; text-decoration: underline; margin: 20px 0 10px; }
          .nomor { text-align: center; font-size: 12pt; margin-bottom: 20px; }
          .isi { text-align: justify; font-size: 12pt; margin-bottom: 15px; }
          table { width: 100%; font-size: 12pt; margin: 15px 0; }
          td { padding: 3px 5px; vertical-align: top; }
          td.label { width: 150px; }
          td.titik { width: 20px; }
          .penutup { text-align: justify; font-size: 12pt; margin: 20px 0; }
          .ttd-wrapper { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 20px; }
          .ttd-box { text-align: center; min-width: 180px; }
          .ttd-jabatan { font-size: 11pt; margin-bottom: 5px; }
          .ttd-nama { font-size: 12pt; font-weight: bold; text-decoration: underline; margin-top: 70px; }
          .mengetahui { text-align: center; margin-top: 50px; }
        </style>
      </head>
      <body>
        <p class="kop-title">RUKUN TETANGGA ${namaRT} / RW. ${rw}</p>
        <p class="kop-subtitle">DESA ${kelurahan}</p>
        <p class="kop-address">KECAMATAN ${kecamatan} - KABUPATEN ${kabupaten}</p>
        <p class="kop-address">PROVINSI ${provinsi}</p>
        <div class="garis"></div>
        <p class="judul">SURAT PENGANTAR</p>
        <p class="nomor">Nomor: ${surat.nomorSurat}</p>
        <p class="isi">Yang bertanda tangan di bawah ini, Ketua RT ${namaRT} RW ${rw} Desa ${kelurahan}, Kecamatan ${kecamatan}, Kabupaten ${kabupaten}, menerangkan dengan sebenarnya bahwa:</p>
        <table>
          <tr><td class="label">Nama</td><td class="titik">:</td><td><strong>${surat.namaPemohon}</strong></td></tr>
          <tr><td class="label">NIK</td><td class="titik">:</td><td>${surat.nik}</td></tr>
          <tr><td class="label">Maksud / Tujuan</td><td class="titik">:</td><td><strong>${surat.tujuan}</strong></td></tr>
          ${surat.keterangan ? `<tr><td class="label">Keterangan</td><td class="titik">:</td><td>${surat.keterangan}</td></tr>` : ''}
        </table>
        <p class="penutup">Demikian Surat Pengantar ini kami buat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
        <div class="ttd-wrapper">
          <div class="ttd-box">
            <p class="ttd-jabatan">Yang Bersangkutan</p>
            <p class="ttd-nama">${surat.namaPemohon}</p>
          </div>
          <div class="ttd-box">
            <p class="ttd-jabatan">${kelurahan}, ${getTanggalHariIni()}</p>
            <p class="ttd-jabatan">Ketua RT ${namaRT} / RW ${rw}</p>
            <p class="ttd-nama">${ketuaRT}</p>
          </div>
        </div>
        <div class="mengetahui">
          <p>Mengetahui,</p>
          <p>Ketua RW ${rw}</p>
          <p class="ttd-nama" style="margin-top: 70px; display: inline-block;">.................................</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocker aktif. Izinkan popup untuk mencetak.');
      return;
    }
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Download JPG
  const handleDownloadJPG = async () => {
    if (!previewSurat || !previewRef.current) {
      toast.error('Gagal mengambil data surat');
      return;
    }

    try {
      // Gunakan scale 3 untuk kualitas tinggi
      const canvas = await html2canvas(previewRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794, // A4 width at 96dpi
        height: 1123, // A4 height at 96dpi
      });

      // Konversi ke JPG dengan kualitas tinggi
      const dataUrl = canvas.toDataURL('image/jpeg', 0.98);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Surat_Pengantar_${previewSurat.namaPemohon.replace(/\s+/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('File JPG berhasil diunduh');
    } catch (error) {
      console.error('Error exporting JPG:', error);
      toast.error('Gagal mengexport ke JPG');
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
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-purple-500" onClick={() => setPreviewSurat(s)} title="Preview & Download JPG">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-500" onClick={() => handleCetakSurat(s)} title="Cetak">
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
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

      {/* Preview Dialog */}
      <Dialog open={!!previewSurat} onOpenChange={() => setPreviewSurat(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Preview Surat Pengantar</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-100 rounded-lg p-4 flex justify-center">
            {previewSurat && (
              <div
                ref={previewRef}
                className="bg-white shadow-lg"
                style={{
                  fontFamily: '"Times New Roman", Times, serif',
                  width: '794px', // 210mm in pixels at 96dpi
                  minHeight: '1123px', // 297mm in pixels at 96dpi
                  color: '#000000',
                  fontSize: '16px',
                  lineHeight: 1.6,
                  padding: '75px 95px', // margin 2.5cm top/bottom, 3cm left/right
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                }}
              >
                {/* KOP SURAT */}
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, letterSpacing: '0.5px' }}>
                    RUKUN TETANGGA {rtInfo?.namaRT || '001'} / RW. {rtInfo?.rw || '002'}
                  </p>
                  <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '4px 0' }}>
                    DESA {rtInfo?.kelurahan || 'SUKAMAJU'}
                  </p>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    KECAMATAN {rtInfo?.kecamatan || 'CIBUNGBULANG'} - KABUPATEN {rtInfo?.kabupaten || 'BOGOR'}
                  </p>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    PROVINSI {rtInfo?.provinsi || 'JAWA BARAT'}
                  </p>
                </div>

                {/* GARIS PEMBATES */}
                <div style={{ borderTop: '3px double #000000', margin: '12px 0' }}></div>

                {/* JUDUL SURAT */}
                <p style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', textDecoration: 'underline', margin: '24px 0 8px' }}>
                  SURAT PENGANTAR
                </p>
                <p style={{ textAlign: 'center', fontSize: '16px', marginBottom: '24px' }}>
                  Nomor: {previewSurat.nomorSurat}
                </p>

                {/* ISI SURAT */}
                <p style={{ textAlign: 'justify', fontSize: '16px', marginBottom: '16px', textIndent: '40px' }}>
                  Yang bertanda tangan di bawah ini, Ketua RT {rtInfo?.namaRT || '001'} RW {rtInfo?.rw || '002'} Desa {rtInfo?.kelurahan || 'SUKAMAJU'}, Kecamatan {rtInfo?.kecamatan || 'CIBUNGBULANG'}, Kabupaten {rtInfo?.kabupaten || 'BOGOR'}, menerangkan dengan sebenarnya bahwa:
                </p>

                {/* TABEL DATA */}
                <table style={{ width: '100%', fontSize: '16px', margin: '16px 0', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '180px', verticalAlign: 'top', padding: '4px 8px' }}>Nama</td>
                      <td style={{ width: '20px', verticalAlign: 'top', padding: '4px 0' }}>:</td>
                      <td style={{ verticalAlign: 'top', padding: '4px 8px', fontWeight: 'bold' }}>{previewSurat.namaPemohon}</td>
                    </tr>
                    <tr>
                      <td style={{ verticalAlign: 'top', padding: '4px 8px' }}>NIK</td>
                      <td style={{ verticalAlign: 'top', padding: '4px 0' }}>:</td>
                      <td style={{ verticalAlign: 'top', padding: '4px 8px' }}>{previewSurat.nik}</td>
                    </tr>
                    <tr>
                      <td style={{ verticalAlign: 'top', padding: '4px 8px' }}>Maksud / Tujuan</td>
                      <td style={{ verticalAlign: 'top', padding: '4px 0' }}>:</td>
                      <td style={{ verticalAlign: 'top', padding: '4px 8px', fontWeight: 'bold' }}>{previewSurat.tujuan}</td>
                    </tr>
                    {previewSurat.keterangan && (
                      <tr>
                        <td style={{ verticalAlign: 'top', padding: '4px 8px' }}>Keterangan</td>
                        <td style={{ verticalAlign: 'top', padding: '4px 0' }}>:</td>
                        <td style={{ verticalAlign: 'top', padding: '4px 8px' }}>{previewSurat.keterangan}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* PENUTUP */}
                <p style={{ textAlign: 'justify', fontSize: '16px', margin: '24px 0', textIndent: '40px' }}>
                  Demikian Surat Pengantar ini kami buat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.
                </p>

                {/* TANDA TANGAN */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '48px', padding: '0 24px' }}>
                  <div style={{ textAlign: 'center', minWidth: '200px' }}>
                    <p style={{ fontSize: '14px', marginBottom: '8px' }}>Yang Bersangkutan</p>
                    <p style={{ fontSize: '16px', fontWeight: 'bold', textDecoration: 'underline', marginTop: '80px' }}>{previewSurat.namaPemohon}</p>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '200px' }}>
                    <p style={{ fontSize: '14px', marginBottom: '4px' }}>{rtInfo?.kelurahan || 'SUKAMAJU'}, {getTanggalHariIni()}</p>
                    <p style={{ fontSize: '14px', marginBottom: '8px' }}>Ketua RT {rtInfo?.namaRT || '001'} / RW {rtInfo?.rw || '002'}</p>
                    <p style={{ fontSize: '16px', fontWeight: 'bold', textDecoration: 'underline', marginTop: '80px' }}>{rtInfo?.ketuaRT || '...........................'}</p>
                  </div>
                </div>

                {/* MENGETAHUI */}
                <div style={{ textAlign: 'center', marginTop: '56px' }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>Mengetahui,</p>
                  <p style={{ margin: 0, fontSize: '14px' }}>Ketua RW {rtInfo?.rw || '002'}</p>
                  <p style={{ fontSize: '16px', fontWeight: 'bold', textDecoration: 'underline', marginTop: '80px', display: 'inline-block' }}>.................................</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2 shrink-0 bg-white border-t p-3">
            <Button variant="outline" onClick={() => setPreviewSurat(null)}>Tutup</Button>
            <Button variant="outline" className="bg-blue-50" onClick={() => previewSurat && handleCetakSurat(previewSurat)}>
              <Printer className="h-4 w-4 mr-2" /> Cetak
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleDownloadJPG}>
              <ImageDown className="h-4 w-4 mr-2" /> Download JPG
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
