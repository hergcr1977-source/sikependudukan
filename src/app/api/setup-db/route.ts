import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Cek apakah kolom desil sudah ada di database Penduduk
    const result = await db.$queryRawUnsafe('PRAGMA table_info(Penduduk)');
    const columns = result as Array<{ name: string }>;
    const hasDesil = columns.some(col => col.name === 'desil');

    if (!hasDesil) {
      await db.$executeRawUnsafe('ALTER TABLE Penduduk ADD COLUMN desil TEXT;');
    }

    // Cek juga PendudukSementara (tabel lain yang punya field bantuan)
    try {
      const result2 = await db.$queryRawUnsafe('PRAGMA table_info(PendudukSementara)');
      const columns2 = result2 as Array<{ name: string }>;
      const hasDesil2 = columns2.some(col => col.name === 'desil');
      if (!hasDesil2) {
        await db.$executeRawUnsafe('ALTER TABLE PendudukSementara ADD COLUMN desil TEXT;');
      }
    } catch {
      // Tabel PendudukSementara mungkin belum ada, abaikan
    }

    return NextResponse.json({ message: 'Database siap.', hasDesil: !hasDesil });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      message: 'Migration error',
      error: String(error),
    }, { status: 500 });
  }
}
