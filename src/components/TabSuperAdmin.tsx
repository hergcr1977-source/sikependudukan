'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Building2, Users, Plus, Trash2, Edit2, Eye, EyeOff,
  Loader2, ChevronDown, ChevronUp, KeyRound, UserPlus, Check, X
} from 'lucide-react';

interface RTData {
  id: number;
  namaRT: string;
  rw: string;
  kelurahan: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  alamat: string;
  ketuaRT: string | null;
  aktif: number;
  totalPenduduk: number;
  totalUsers: number;
}

interface UserData {
  id: number;
  username: string;
  nama: string;
  role: string;
  rtId: number | null;
  aktif: number;
  namaRT: string | null;
  rw: string | null;
}

interface TabSuperAdminProps {
  activeSection: 'rt' | 'users' | 'register';
}

export default function TabSuperAdmin({ activeSection }: TabSuperAdminProps) {
  const [rts, setRts] = useState<RTData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [resetPasswordId, setResetPasswordId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Form states
  const [rtForm, setRtForm] = useState({
    namaRT: '', rw: '', kelurahan: '', kecamatan: '',
    kabupaten: '', provinsi: '', alamat: '', ketuaRT: '',
  });

  const [userForm, setUserForm] = useState({
    username: '', password: '', nama: '', role: 'admin', rtId: '' as string,
  });

  // Register form
  const [regForm, setRegForm] = useState({
    namaRT: '', rw: '', kelurahan: '', kecamatan: '',
    kabupaten: '', provinsi: '', alamat: '', ketuaRT: '',
    adminUsername: '', adminPassword: '', adminNama: '',
  });

  const loadRTs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rt');
      if (res.ok) setRts(await res.json());
    } catch { toast.error('Gagal memuat data RT'); }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) setUsers(await res.json());
    } catch { toast.error('Gagal memuat data user'); }
  }, []);

  useEffect(() => { loadRTs(); loadUsers(); }, [loadRTs, loadUsers]);

  // ====== RT MANAGEMENT ======

  const handleCreateRT = async () => {
    if (!rtForm.namaRT || !rtForm.rw) {
      toast.error('Nomor RT dan RW wajib diisi');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rtForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`RT.${rtForm.namaRT} RW.${rtForm.rw} berhasil dibuat`);
        setRtForm({ namaRT: '', rw: '', kelurahan: '', kecamatan: '', kabupaten: '', provinsi: '', alamat: '', ketuaRT: '' });
        setShowForm(false);
        loadRTs();
      } else {
        toast.error(data.error || 'Gagal membuat RT');
      }
    } catch { toast.error('Terjadi kesalahan'); }
    finally { setLoading(false); }
  };

  const handleUpdateRT = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/rt/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rtForm),
      });
      if (res.ok) {
        toast.success('RT berhasil diupdate');
        setEditId(null);
        setRtForm({ namaRT: '', rw: '', kelurahan: '', kecamatan: '', kabupaten: '', provinsi: '', alamat: '', ketuaRT: '' });
        loadRTs();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal update RT');
      }
    } catch { toast.error('Terjadi kesalahan'); }
    finally { setLoading(false); }
  };

  const handleDeleteRT = async (id: number, nama: string) => {
    if (!confirm(`Nonaktifkan RT.${nama}? Semua user RT ini juga akan dinonaktifkan.`)) return;
    try {
      const res = await fetch(`/api/admin/rt/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('RT berhasil dinonaktifkan');
        loadRTs();
        loadUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal');
      }
    } catch { toast.error('Terjadi kesalahan'); }
  };

  const startEditRT = (rt: RTData) => {
    setEditId(rt.id);
    setRtForm({
      namaRT: rt.namaRT, rw: rt.rw, kelurahan: rt.kelurahan,
      kecamatan: rt.kecamatan, kabupaten: rt.kabupaten, provinsi: rt.provinsi,
      alamat: rt.alamat, ketuaRT: rt.ketuaRT || '',
    });
    setShowForm(true);
  };

  // ====== USER MANAGEMENT ======

  const handleCreateUser = async () => {
    if (!userForm.username || !userForm.password || !userForm.nama) {
      toast.error('Username, password, dan nama wajib diisi');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userForm,
          rtId: userForm.rtId ? parseInt(userForm.rtId) : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`User ${userForm.username} berhasil dibuat`);
        setUserForm({ username: '', password: '', nama: '', role: 'admin', rtId: '' });
        loadUsers();
      } else {
        toast.error(data.error || 'Gagal membuat user');
      }
    } catch { toast.error('Terjadi kesalahan'); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (userId: number) => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        toast.success('Password berhasil direset');
        setResetPasswordId(null);
        setNewPassword('');
      } else {
        toast.error('Gagal reset password');
      }
    } catch { toast.error('Terjadi kesalahan'); }
    finally { setLoading(false); }
  };

  const handleToggleUser = async (userId: number, aktif: number) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif: aktif === 1 ? 0 : 1 }),
      });
      if (res.ok) {
        toast.success(aktif === 1 ? 'User dinonaktifkan' : 'User diaktifkan');
        loadUsers();
      }
    } catch { toast.error('Terjadi kesalahan'); }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Nonaktifkan user ${username}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('User berhasil dinonaktifkan');
        loadUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Gagal');
      }
    } catch { toast.error('Terjadi kesalahan'); }
  };

  // ====== REGISTER ======

  const handleRegister = async () => {
    const { namaRT, rw, kelurahan, kecamatan, kabupaten, provinsi, alamat, ketuaRT, adminUsername, adminPassword, adminNama } = regForm;
    if (!namaRT || !rw || !adminUsername || !adminPassword || !adminNama) {
      toast.error('Data RT dan admin wajib diisi');
      return;
    }
    if (adminPassword.length < 6) {
      toast.error('Password admin minimal 6 karakter');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`RT.${namaRT} RW.${rw} berhasil didaftarkan! Username admin: ${adminUsername}`);
        setRegForm({
          namaRT: '', rw: '', kelurahan: '', kecamatan: '',
          kabupaten: '', provinsi: '', alamat: '', ketuaRT: '',
          adminUsername: '', adminPassword: '', adminNama: '',
        });
        loadRTs();
        loadUsers();
      } else {
        toast.error(data.error || 'Gagal mendaftarkan RT');
      }
    } catch { toast.error('Terjadi kesalahan'); }
    finally { setLoading(false); }
  };

  // ====== RENDER ======

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500";
  const labelClass = "text-xs font-medium text-gray-700";
  const btnPrimary = "bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition text-sm flex items-center gap-2";
  const btnSecondary = "bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition text-sm";
  const btnDanger = "bg-red-500 hover:bg-red-600 text-white font-medium py-1.5 px-3 rounded-lg transition text-xs";

  if (activeSection === 'rt') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-600" /> Daftar Rukun Tetangga
          </h2>
          <button onClick={() => { setShowForm(!showForm); setEditId(null); setRtForm({ namaRT: '', rw: '', kelurahan: '', kecamatan: '', kabupaten: '', provinsi: '', alamat: '', ketuaRT: '' }); }} className={btnPrimary}>
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Batal' : 'Tambah RT'}
          </button>
        </div>

        {/* Form RT */}
        {showForm && (
          <div className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-700">{editId ? 'Edit RT' : 'Tambah RT Baru'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nomor RT *</label>
                <input className={inputClass} value={rtForm.namaRT} onChange={e => setRtForm({ ...rtForm, namaRT: e.target.value })} placeholder="001" />
              </div>
              <div>
                <label className={labelClass}>Nomor RW *</label>
                <input className={inputClass} value={rtForm.rw} onChange={e => setRtForm({ ...rtForm, rw: e.target.value })} placeholder="002" />
              </div>
              <div>
                <label className={labelClass}>Kelurahan</label>
                <input className={inputClass} value={rtForm.kelurahan} onChange={e => setRtForm({ ...rtForm, kelurahan: e.target.value.toUpperCase() })} placeholder="SUKAMAJU" />
              </div>
              <div>
                <label className={labelClass}>Kecamatan</label>
                <input className={inputClass} value={rtForm.kecamatan} onChange={e => setRtForm({ ...rtForm, kecamatan: e.target.value.toUpperCase() })} placeholder="CIBUNGBULANG" />
              </div>
              <div>
                <label className={labelClass}>Kabupaten</label>
                <input className={inputClass} value={rtForm.kabupaten} onChange={e => setRtForm({ ...rtForm, kabupaten: e.target.value.toUpperCase() })} placeholder="BOGOR" />
              </div>
              <div>
                <label className={labelClass}>Provinsi</label>
                <input className={inputClass} value={rtForm.provinsi} onChange={e => setRtForm({ ...rtForm, provinsi: e.target.value.toUpperCase() })} placeholder="JAWA BARAT" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Alamat</label>
                <input className={inputClass} value={rtForm.alamat} onChange={e => setRtForm({ ...rtForm, alamat: e.target.value.toUpperCase() })} placeholder="KP. CEMPLANG" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Ketua RT</label>
                <input className={inputClass} value={rtForm.ketuaRT} onChange={e => setRtForm({ ...rtForm, ketuaRT: e.target.value.toUpperCase() })} placeholder="Nama Ketua RT" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => editId ? handleUpdateRT(editId) : handleCreateRT()} className={btnPrimary} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editId ? 'Simpan Perubahan' : 'Buat RT'}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); }} className={btnSecondary}>Batal</button>
            </div>
          </div>
        )}

        {/* RT List */}
        <div className="space-y-2">
          {rts.map(rt => (
            <div key={rt.id} className={`bg-white border rounded-lg p-3 ${rt.aktif ? '' : 'opacity-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">RT.{rt.namaRT} RW.{rt.rw}</p>
                  <p className="text-xs text-gray-500">
                    {rt.kelurahan}, {rt.kecamatan}, {rt.kabupaten}, {rt.provinsi}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {rt.totalPenduduk} penduduk &middot; {rt.totalUsers} user aktif
                    {rt.ketuaRT ? ` &middot; Ketua: ${rt.ketuaRT}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEditRT(rt)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded" title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {rt.aktif && (
                    <button onClick={() => handleDeleteRT(rt.id, rt.namaRT)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Nonaktifkan">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {rts.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Belum ada data RT</p>
          )}
        </div>
      </div>
    );
  }

  if (activeSection === 'users') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" /> Kelola User
          </h2>
          <button onClick={() => { setShowForm(!showForm); setUserForm({ username: '', password: '', nama: '', role: 'admin', rtId: '' }); }} className={btnPrimary}>
            {showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {showForm ? 'Batal' : 'Tambah User'}
          </button>
        </div>

        {/* Form User */}
        {showForm && (
          <div className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-700">Tambah User Baru</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Username *</label>
                <input className={inputClass} value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value.toLowerCase() })} placeholder="username" />
              </div>
              <div>
                <label className={labelClass}>Password *</label>
                <input type="password" className={inputClass} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder="Min. 6 karakter" />
              </div>
              <div>
                <label className={labelClass}>Nama Lengkap *</label>
                <input className={inputClass} value={userForm.nama} onChange={e => setUserForm({ ...userForm, nama: e.target.value.toUpperCase() })} placeholder="NAMA LENGKAP" />
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <select className={inputClass} value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                  <option value="admin">Admin RT</option>
                  <option value="user">Viewer</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>RT (kosongkan untuk super admin)</label>
                <select className={inputClass} value={userForm.rtId} onChange={e => setUserForm({ ...userForm, rtId: e.target.value })}>
                  <option value="">-- Tidak terkait RT (Super Admin) --</option>
                  {rts.filter(r => r.aktif).map(rt => (
                    <option key={rt.id} value={rt.id}>RT.{rt.namaRT} RW.{rt.rw} - {rt.kelurahan}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreateUser} className={btnPrimary} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Buat User
              </button>
              <button onClick={() => setShowForm(false)} className={btnSecondary}>Batal</button>
            </div>
          </div>
        )}

        {/* User List */}
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className={`bg-white border rounded-lg p-3 ${user.aktif ? '' : 'opacity-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm flex items-center gap-2">
                    {user.nama}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      user.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {user.role}
                    </span>
                    {!user.aktif && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">NONAKTIF</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    @{user.username}
                    {user.namaRT ? ` &middot; RT.${user.namaRT} RW.${user.rw}` : ' &middot; Tanpa RT'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setResetPasswordId(resetPasswordId === user.id ? null : user.id); setNewPassword(''); }} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Reset Password">
                    <KeyRound className="h-4 w-4" />
                  </button>
                  {user.role !== 'superadmin' && (
                    <button onClick={() => handleToggleUser(user.id, user.aktif)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title={user.aktif ? 'Nonaktifkan' : 'Aktifkan'}>
                      {user.aktif ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                  {user.role !== 'superadmin' && (
                    <button onClick={() => handleDeleteUser(user.id, user.username)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {/* Reset Password Form */}
              {resetPasswordId === user.id && (
                <div className="mt-2 pt-2 border-t flex items-center gap-2">
                  <input
                    type="text"
                    className={inputClass + " flex-1"}
                    placeholder="Password baru (min. 6 karakter)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <button onClick={() => handleResetPassword(user.id)} className={btnPrimary + " py-1.5 px-3"} disabled={loading || newPassword.length < 6}>
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Simpan'}
                  </button>
                  <button onClick={() => { setResetPasswordId(null); setNewPassword(''); }} className="text-xs text-gray-500 hover:text-gray-700">Batal</button>
                </div>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Belum ada user</p>
          )}
        </div>
      </div>
    );
  }

  if (activeSection === 'register') {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-purple-600" /> Registrasi RT Baru
        </h2>
        <p className="text-sm text-gray-500">Buat akun RT baru beserta adminnya. Setelah didaftarkan, admin RT tersebut bisa langsung login.</p>

        <div className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
          <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Data RT</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Nomor RT *</label>
              <input className={inputClass} value={regForm.namaRT} onChange={e => setRegForm({ ...regForm, namaRT: e.target.value })} placeholder="001" />
            </div>
            <div>
              <label className={labelClass}>Nomor RW *</label>
              <input className={inputClass} value={regForm.rw} onChange={e => setRegForm({ ...regForm, rw: e.target.value })} placeholder="002" />
            </div>
            <div>
              <label className={labelClass}>Kelurahan</label>
              <input className={inputClass} value={regForm.kelurahan} onChange={e => setRegForm({ ...regForm, kelurahan: e.target.value.toUpperCase() })} placeholder="SUKAMAJU" />
            </div>
            <div>
              <label className={labelClass}>Kecamatan</label>
              <input className={inputClass} value={regForm.kecamatan} onChange={e => setRegForm({ ...regForm, kecamatan: e.target.value.toUpperCase() })} placeholder="CIBUNGBULANG" />
            </div>
            <div>
              <label className={labelClass}>Kabupaten</label>
              <input className={inputClass} value={regForm.kabupaten} onChange={e => setRegForm({ ...regForm, kabupaten: e.target.value.toUpperCase() })} placeholder="BOGOR" />
            </div>
            <div>
              <label className={labelClass}>Provinsi</label>
              <input className={inputClass} value={regForm.provinsi} onChange={e => setRegForm({ ...regForm, provinsi: e.target.value.toUpperCase() })} placeholder="JAWA BARAT" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Alamat</label>
              <input className={inputClass} value={regForm.alamat} onChange={e => setRegForm({ ...regForm, alamat: e.target.value.toUpperCase() })} placeholder="KP. CEMPLANG" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Nama Ketua RT</label>
              <input className={inputClass} value={regForm.ketuaRT} onChange={e => setRegForm({ ...regForm, ketuaRT: e.target.value.toUpperCase() })} placeholder="Nama Ketua RT" />
            </div>
          </div>

          <h3 className="font-semibold text-sm text-gray-700 border-b pb-2 pt-2">Akun Admin RT</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Username Admin *</label>
              <input className={inputClass} value={regForm.adminUsername} onChange={e => setRegForm({ ...regForm, adminUsername: e.target.value.toLowerCase() })} placeholder="username" />
            </div>
            <div>
              <label className={labelClass}>Password Admin *</label>
              <input type="password" className={inputClass} value={regForm.adminPassword} onChange={e => setRegForm({ ...regForm, adminPassword: e.target.value })} placeholder="Min. 6 karakter" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Nama Lengkap Admin *</label>
              <input className={inputClass} value={regForm.adminNama} onChange={e => setRegForm({ ...regForm, adminNama: e.target.value.toUpperCase() })} placeholder="NAMA LENGKAP" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleRegister} className={btnPrimary} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Daftarkan RT & Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
