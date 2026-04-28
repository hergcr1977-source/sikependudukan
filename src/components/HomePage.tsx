'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, Users, UserRound, CalendarDays, FileSpreadsheet, Shield, Wallet, LogOut, Settings, Building2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';

const TabBeranda = dynamic(() => import('@/components/TabBeranda'), { ssr: false });
const TabPenduduk = dynamic(() => import('@/components/TabPenduduk'), { ssr: false });
const TabPendudukSementara = dynamic(() => import('@/components/TabPendudukSementara'), { ssr: false });
const TabKejadian = dynamic(() => import('@/components/TabKejadian'), { ssr: false });
const TabLaporan = dynamic(() => import('@/components/TabLaporan'), { ssr: false });
const TabBantuan = dynamic(() => import('@/components/TabBantuan'), { ssr: false });
const TabKasRT = dynamic(() => import('@/components/TabKasRT'), { ssr: false });
const TabSuperAdmin = dynamic(() => import('@/components/TabSuperAdmin'), { ssr: false });

interface RTInfo {
  namaRT: string;
  rw: string;
  kelurahan: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  alamat: string;
  ketuaRT: string | null;
}

interface HomePageProps {
  initialRole: string;
  initialNama: string;
  initialRtId: number | null;
  initialRtInfo: RTInfo | null;
}

export default function HomePage({ initialRole, initialNama, initialRtId, initialRtInfo }: HomePageProps) {
  const [activeTab, setActiveTab] = useState('beranda');
  const [auth, setAuth] = useState<{
    authenticated: boolean;
    role: string | null;
    nama: string | null;
    rtId: number | null;
    rtInfo: RTInfo | null;
  }>({
    authenticated: true,
    role: initialRole,
    nama: initialNama,
    rtId: initialRtId,
    rtInfo: initialRtInfo,
  });
  const [authLoading, setAuthLoading] = useState(false);

  // Auth sudah tersedia dari server-side props (JWT cookie).
  // Tidak perlu fetch ulang setiap ganti tab — itu bikin loading lama.

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await res.json();
        setAuth({
          authenticated: true,
          role: data.role,
          nama: data.nama,
          rtId: data.rtId,
          rtInfo: data.rtInfo,
        });
      } else {
        setAuth({ authenticated: false, role: null, nama: null, rtId: null, rtInfo: null });
      }
    } catch {
      setAuth({ authenticated: false, role: null, nama: null, rtId: null, rtInfo: null });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Keluar dari sistem?')) return;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/login';
  };

  // Auto-logout setelah 10 menit tidak ada aktivitas
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

    setShowInactivityWarning(false);

    warningTimerRef.current = setTimeout(() => {
      setShowInactivityWarning(true);
      setCountdown(60);

      const countInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      warningTimerRef.current = setTimeout(() => {
        clearInterval(countInterval);
        doAutoLogout();
      }, 60 * 1000);
    }, (INACTIVITY_TIMEOUT - 60 * 1000));

    inactivityTimerRef.current = setTimeout(() => {
      doAutoLogout();
    }, INACTIVITY_TIMEOUT);
  }, []);

  const doAutoLogout = useCallback(async () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setShowInactivityWarning(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    if (!auth.authenticated) return;

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => { resetInactivityTimer(); };

    for (const event of activityEvents) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    resetInactivityTimer();

    return () => {
      for (const event of activityEvents) {
        window.removeEventListener(event, handleActivity);
      }
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [auth.authenticated, resetInactivityTimer]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!auth.authenticated) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  const isAdmin = auth.role === 'admin';
  const isSuperAdmin = auth.role === 'superadmin';
  const rtLabel = isSuperAdmin ? 'SUPER ADMIN' : `RT.${auth.rtInfo?.namaRT || '---'} RW.${auth.rtInfo?.rw || '---'}`;
  const alamat = auth.rtInfo?.alamat
    ? `${auth.rtInfo.alamat}, KEL. ${auth.rtInfo.kelurahan}, KEC. ${auth.rtInfo.kecamatan}, KAB. ${auth.rtInfo.kabupaten}, PROV. ${auth.rtInfo.provinsi}`
    : '';

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" richColors />

      {/* Inactivity Warning Popup */}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 mx-4 max-w-sm w-full shadow-2xl text-center space-y-3 animate-in fade-in zoom-in">
            <div className="text-4xl">&#9200;</div>
            <h3 className="text-lg font-bold text-gray-800">Sesi Akan Berakhir</h3>
            <p className="text-sm text-gray-600">
              Tidak ada aktivitas selama 9 menit. Anda akan otomatis logout dalam
            </p>
            <p className="text-3xl font-bold text-red-600">{countdown} detik</p>
            <button
              onClick={() => resetInactivityTimer()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              Masih Aktif
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-2 py-2 sm:px-4 sm:py-4 relative">

        {/* Header */}
        <div className={`relative z-10 text-center space-y-1 text-white p-4 rounded-xl mb-3 ${
          isSuperAdmin
            ? 'bg-gradient-to-r from-purple-700 to-indigo-700'
            : 'bg-gradient-to-r from-emerald-700 to-teal-700'
        }`}>
          <h1 className="text-lg md:text-xl font-bold tracking-wide">SISTEM DATA KEPENDUDUKAN</h1>
          <h2 className="text-base md:text-lg font-semibold">{rtLabel}</h2>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs opacity-90">
              {isSuperAdmin ? 'Manajemen Sistem' : `Ketua RT: ${auth.rtInfo?.ketuaRT || auth.nama}`}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-75 bg-white/20 px-2 py-0.5 rounded-full">
                {auth.nama} ({isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Viewer'})
              </span>
              <button
                onClick={handleLogout}
                className="text-white/80 hover:text-white transition"
                title="Keluar"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Alamat (hanya untuk admin/user, bukan super admin di halaman dashboard) */}
        {alamat && !isSuperAdmin && (
          <div className="relative z-10 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center mb-3">
            <p className="text-[11px] text-emerald-800 font-medium">{alamat}</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`w-full grid mb-3 h-auto bg-white border shadow-sm rounded-lg p-1 ${
            isSuperAdmin ? 'grid-cols-3' : 'grid-cols-7'
          }`}>
            {isSuperAdmin ? (
              <>
                <TabsTrigger
                  value="admin"
                  className="flex flex-col items-center gap-0.5 py-2 px-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-md text-[10px] sm:text-xs"
                >
                  <Settings className="h-4 w-4" />
                  <span>Kelola RT</span>
                </TabsTrigger>
                <TabsTrigger
                  value="users"
                  className="flex flex-col items-center gap-0.5 py-2 px-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-md text-[10px] sm:text-xs"
                >
                  <Users className="h-4 w-4" />
                  <span>Kelola User</span>
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="flex flex-col items-center gap-0.5 py-2 px-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-md text-[10px] sm:text-xs"
                >
                  <Building2 className="h-4 w-4" />
                  <span>Registrasi</span>
                </TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger
                  value="beranda"
                  className="flex flex-col items-center gap-0.5 py-2 px-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-md text-[10px] sm:text-xs"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Beranda</span>
                </TabsTrigger>
                <TabsTrigger
                  value="penduduk"
                  className="flex flex-col items-center gap-0.5 py-2 px-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-md text-[10px] sm:text-xs"
                >
                  <Users className="h-4 w-4" />
                  <span>Penduduk</span>
                </TabsTrigger>
                <TabsTrigger
                  value="sementara"
                  className="flex flex-col items-center gap-0.5 py-2 px-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-md text-[10px] sm:text-xs"
                >
                  <UserRound className="h-4 w-4" />
                  <span>Sementara</span>
                </TabsTrigger>
                <TabsTrigger
                  value="kejadian"
                  className="flex flex-col items-center gap-0.5 py-2 px-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-md text-[10px] sm:text-xs"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span>Kejadian</span>
                </TabsTrigger>
                <TabsTrigger
                  value="bantuan"
                  className="flex flex-col items-center gap-0.5 py-2 px-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-md text-[10px] sm:text-xs"
                >
                  <Shield className="h-4 w-4" />
                  <span>Bansos</span>
                </TabsTrigger>
                <TabsTrigger
                  value="laporan"
                  className="flex flex-col items-center gap-0.5 py-2 px-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-md text-[10px] sm:text-xs"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Laporan</span>
                </TabsTrigger>
                <TabsTrigger
                  value="kas"
                  className="flex flex-col items-center gap-0.5 py-2 px-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-md text-[10px] sm:text-xs"
                >
                  <Wallet className="h-4 w-4" />
                  <span>Kas RT</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {isSuperAdmin ? (
            <>
              <TabsContent value="admin">
                <TabSuperAdmin activeSection="rt" />
              </TabsContent>
              <TabsContent value="users">
                <TabSuperAdmin activeSection="users" />
              </TabsContent>
              <TabsContent value="register">
                <TabSuperAdmin activeSection="register" />
              </TabsContent>
            </>
          ) : (
            <>
              <TabsContent value="beranda">
                <TabBeranda isAdmin={isAdmin} isActive={activeTab === 'beranda'} />
              </TabsContent>
              <TabsContent value="penduduk">
                <TabPenduduk isAdmin={isAdmin} isActive={activeTab === 'penduduk'} />
              </TabsContent>
              <TabsContent value="sementara">
                <TabPendudukSementara isAdmin={isAdmin} isActive={activeTab === 'sementara'} />
              </TabsContent>
              <TabsContent value="kejadian">
                <TabKejadian isAdmin={isAdmin} isActive={activeTab === 'kejadian'} />
              </TabsContent>
              <TabsContent value="bantuan">
                <TabBantuan isAdmin={isAdmin} isActive={activeTab === 'bantuan'} />
              </TabsContent>
              <TabsContent value="laporan">
                <TabLaporan isAdmin={isAdmin} isActive={activeTab === 'laporan'} />
              </TabsContent>
              <TabsContent value="kas">
                <TabKasRT isAdmin={isAdmin} isActive={activeTab === 'kas'} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
