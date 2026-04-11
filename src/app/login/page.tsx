'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        window.location.href = '/';
      } else {
        const data = await res.json();
        setError(data.error || 'Login gagal');
      }
    } catch {
      setError('Terjadi kesalahan koneksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo RT.001 RW.002"
              className="w-28 h-28 object-contain"
            />
          </div>

          {/* Title */}
          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold text-emerald-800 tracking-wide">
              SISTEM DATA KEPENDUDUKAN
            </h1>
            <p className="text-sm font-semibold text-emerald-600">RT.001 RW.002</p>
            <p className="text-xs text-gray-500">Sukamaju, Cibungbulang, Bogor</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                placeholder="Masukkan username"
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition pr-10"
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-[10px] text-gray-400">
            © copyright 2026 Herman Gozali S.T. S.Kom.
          </p>
        </div>
      </div>
    </div>
  );
}
