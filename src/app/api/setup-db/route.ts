import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Cek apakah kolom desil sudah ada di database
    const result = await db.$queryRawUnsafe('PRAGMA table_info(Penduduk)');
    const columns = result as Array<{ name: string }>;
    const hasDesil = columns.some(col => col.name === 'desil');

    if (hasDesil) {
      return NextResponse.json({ message: 'Database sudah terbaru, kolom desil sudah ada.' });
    }

    // Tambahkan kolom desil jika belum ada
    await db.$executeRawUnsafe('ALTER TABLE Penduduk ADD COLUMN desil TEXT;');

    return NextResponse.json({ message: 'Kolom desil berhasil ditambahkan ke database.' });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      message: 'Error saat migrate database',
      error: String(error),
    }, { status: 500 });
  }
}
