'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, Users, UserRound, CalendarDays, FileSpreadsheet, Shield, Wallet, LogOut } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { ALAMAT } from '@/lib/constants';

const TabBeranda = dynamic(() => import('@/components/TabBeranda'), { ssr: false });
const TabPenduduk = dynamic(() => import('@/components/TabPenduduk'), { ssr: false });
const TabPendudukSementara = dynamic(() => import('@/components/TabPendudukSementara'), { ssr: false });
const TabKejadian = dynamic(() => import('@/components/TabKejadian'), { ssr: false });
const TabLaporan = dynamic(() => import('@/components/TabLaporan'), { ssr: false });
const TabBantuan = dynamic(() => import('@/components/TabBantuan'), { ssr: false });
const TabKasRT = dynamic(() => import('@/components/TabKasRT'), { ssr: false });

interface AuthState {
  authenticated: boolean;
  role: string | null;
  nama: string | null;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('beranda');
  const [auth, setAuth] = useState<AuthState>({ authenticated: false, role: null, nama: null });
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await res.json();
        setAuth({ authenticated: true, role: data.role, nama: data.nama });
      } else {
        setAuth({ authenticated: false, role: null, nama: null });
      }
    } catch {
      setAuth({ authenticated: false, role: null, nama: null });
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" richColors />
      <div className="max-w-4xl mx-auto px-2 py-2 sm:px-4 sm:py-4 relative">

        {/* Header */}
        <div className="relative z-10 text-center space-y-1 bg-gradient-to-r from-emerald-700 to-teal-700 text-white p-4 rounded-xl mb-3">
          <h1 className="text-lg md:text-xl font-bold tracking-wide">SISTEM DATA KEPENDUDUKAN</h1>
          <h2 className="text-base md:text-lg font-semibold">RT.001 RW.002</h2>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs opacity-90">Ketua RT: HERMAN GOZALI</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-75 bg-white/20 px-2 py-0.5 rounded-full">
                {auth.nama} ({auth.role === 'admin' ? 'Admin' : 'Viewer'})
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

        {/* Alamat */}
        <div className="relative z-10 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center mb-3">
          <p className="text-[11px] text-emerald-800 font-medium">{ALAMAT}</p>
        </div>


        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-7 mb-3 h-auto bg-white border shadow-sm rounded-lg p-1">
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
          </TabsList>

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
        </Tabs>
      </div>
    </div>
  );
}
