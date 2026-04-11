import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Migration untuk Penduduk
    const result = await db.$queryRawUnsafe('PRAGMA table_info(Penduduk)');
    const columns = result as Array<{ name: string }>;
    const colNames = columns.map(c => c.name);
    if (!colNames.includes('desil')) {
      await db.$executeRawUnsafe('ALTER TABLE Penduduk ADD COLUMN desil TEXT;');
    }
    if (!colNames.includes('alamatLengkap')) {
      await db.$executeRawUnsafe('ALTER TABLE Penduduk ADD COLUMN alamatLengkap TEXT;');
    }
    if (!colNames.includes('alamat')) {
      await db.$executeRawUnsafe("ALTER TABLE Penduduk ADD COLUMN alamat TEXT DEFAULT 'KP. CEMPLANG';");
    }
    if (!colNames.includes('rt')) {
      await db.$executeRawUnsafe("ALTER TABLE Penduduk ADD COLUMN rt TEXT DEFAULT '001';");
    }
    if (!colNames.includes('rw')) {
      await db.$executeRawUnsafe("ALTER TABLE Penduduk ADD COLUMN rw TEXT DEFAULT '002';");
    }
    if (!colNames.includes('kelurahan')) {
      await db.$executeRawUnsafe("ALTER TABLE Penduduk ADD COLUMN kelurahan TEXT DEFAULT 'SUKAMAJU';");
    }
    if (!colNames.includes('kecamatan')) {
      await db.$executeRawUnsafe("ALTER TABLE Penduduk ADD COLUMN kecamatan TEXT DEFAULT 'CIBUNGBULANG';");
    }
    if (!colNames.includes('kabupaten')) {
      await db.$executeRawUnsafe("ALTER TABLE Penduduk ADD COLUMN kabupaten TEXT DEFAULT 'BOGOR';");
    }
    if (!colNames.includes('provinsi')) {
      await db.$executeRawUnsafe("ALTER TABLE Penduduk ADD COLUMN provinsi TEXT DEFAULT 'JAWA BARAT';");
    }

    // Migration untuk PendudukSementara
    try {
      const result2 = await db.$queryRawUnsafe('PRAGMA table_info(PendudukSementara)');
      const columns2 = result2 as Array<{ name: string }>;
      const colNames2 = columns2.map(c => c.name);
      if (!colNames2.includes('desil')) {
        await db.$executeRawUnsafe('ALTER TABLE PendudukSementara ADD COLUMN desil TEXT;');
      }
      if (!colNames2.includes('alamatLengkap')) {
        await db.$executeRawUnsafe('ALTER TABLE PendudukSementara ADD COLUMN alamatLengkap TEXT;');
      }
      if (!colNames2.includes('alamat')) {
        await db.$executeRawUnsafe("ALTER TABLE PendudukSementara ADD COLUMN alamat TEXT DEFAULT 'KP. CEMPLANG';");
      }
      if (!colNames2.includes('rt')) {
        await db.$executeRawUnsafe("ALTER TABLE PendudukSementara ADD COLUMN rt TEXT DEFAULT '001';");
      }
      if (!colNames2.includes('rw')) {
        await db.$executeRawUnsafe("ALTER TABLE PendudukSementara ADD COLUMN rw TEXT DEFAULT '002';");
      }
      if (!colNames2.includes('kelurahan')) {
        await db.$executeRawUnsafe("ALTER TABLE PendudukSementara ADD COLUMN kelurahan TEXT DEFAULT 'SUKAMAJU';");
      }
      if (!colNames2.includes('kecamatan')) {
        await db.$executeRawUnsafe("ALTER TABLE PendudukSementara ADD COLUMN kecamatan TEXT DEFAULT 'CIBUNGBULANG';");
      }
      if (!colNames2.includes('kabupaten')) {
        await db.$executeRawUnsafe("ALTER TABLE PendudukSementara ADD COLUMN kabupaten TEXT DEFAULT 'BOGOR';");
      }
      if (!colNames2.includes('provinsi')) {
        await db.$executeRawUnsafe("ALTER TABLE PendudukSementara ADD COLUMN provinsi TEXT DEFAULT 'JAWA BARAT';");
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
