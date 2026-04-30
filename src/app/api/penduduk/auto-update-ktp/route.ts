import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Auto-update KTP: SUDAH DINONAKTIFKAN.
 * Status KTP sepenuhnya diatur oleh admin, tidak ada perubahan otomatis.
 * Endpoint ini hanya mengembalikan response kosong agar tidak error.
 */
export async function POST() {
  return NextResponse.json({ success: true, checked: 0, updated: 0 });
}
