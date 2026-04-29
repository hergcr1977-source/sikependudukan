'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Hook untuk auto-refresh data secara periodik dan saat tab browser menjadi aktif.
 * Digunakan agar usia penduduk selalu ter-update otomatis tanpa manual refresh.
 *
 * @param callback - fungsi yang dipanggil saat refresh
 * @param intervalMs - interval refresh dalam ms (default 60000 = 1 menit)
 */
export function useAutoRefresh(callback: () => void, intervalMs = 60000) {
  const [now, setNow] = useState(Date.now());
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Update "now" setiap interval agar komponen re-render dan usia ter-recalculate
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  // Jalankan callback saat "now" berubah
  useEffect(() => {
    callbackRef.current();
  }, [now]);

  // Refresh saat tab browser menjadi aktif kembali
  useEffect(() => {
    const handler = () => {
      setNow(Date.now());
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Return now agar komponen bisa menggunakannya untuk re-calculate usia
  return now;
}
