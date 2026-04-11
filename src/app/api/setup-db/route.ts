import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Migration untuk Penduduk
    const result = await db.$queryRawUnsafe('PRAGMA table_info(Penduduk)');
    const columns = result as Array<{ name: string }>;
    if (!columns.some(col => col.name === 'desil')) {
      await db.$executeRawUnsafe('ALTER TABLE Penduduk ADD COLUMN desil TEXT;');
    }
    if (!columns.some(col => col.name === 'alamatLengkap')) {
      await db.$executeRawUnsafe('ALTER TABLE Penduduk ADD COLUMN alamatLengkap TEXT;');
    }

    // Migration untuk PendudukSementara
    try {
      const result2 = await db.$queryRawUnsafe('PRAGMA table_info(PendudukSementara)');
      const columns2 = result2 as Array<{ name: string }>;
      if (!columns2.some(col => col.name === 'desil')) {
        await db.$executeRawUnsafe('ALTER TABLE PendudukSementara ADD COLUMN desil TEXT;');
      }
      if (!columns2.some(col => col.name === 'alamatLengkap')) {
        await db.$executeRawUnsafe('ALTER TABLE PendudukSementara ADD COLUMN alamatLengkap TEXT;');
      }
    } catch {
      // Tabel PendudukSementara mungkin belum ada, abaikan
    }

    return NextResponse.json({ message: 'Database siap.' });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      message: 'Migration error',
      error: String(error),
    }, { status: 500 });
  }
}
