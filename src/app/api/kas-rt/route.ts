import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - ambil semua data kas RT (urut terbaru)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get('bulan');
    const tahun = searchParams.get('tahun');
    const jenis = searchParams.get('jenis');

    const where: Record<string, unknown> = {};

    if (bulan && tahun) {
      const startDate = new Date(parseInt(tahun), parseInt(bulan) - 1, 1);
      const endDate = new Date(parseInt(tahun), parseInt(bulan), 0, 23, 59, 59);
      where.tanggal = {
        gte: startDate,
        lte: endDate,
      };
    } else if (tahun) {
      const startDate = new Date(parseInt(tahun), 0, 1);
      const endDate = new Date(parseInt(tahun), 11, 31, 23, 59, 59);
      where.tanggal = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (jenis) {
      where.jenis = jenis;
    }

    const data = await db.kasRT.findMany({
      where,
      orderBy: { tanggal: 'desc' },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/kas-rt error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data kas' }, { status: 500 });
  }
}

// POST - tambah data kas baru
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tanggal, jenis, jumlah, keterangan } = body;

    if (!tanggal || !jenis || !jumlah) {
      return NextResponse.json({ error: 'Tanggal, jenis, dan jumlah wajib diisi' }, { status: 400 });
    }

    if (jenis !== 'PEMASUKAN' && jenis !== 'PENGELUARAN') {
      return NextResponse.json({ error: 'Jenis harus PEMASUKAN atau PENGELUARAN' }, { status: 400 });
    }

    if (jumlah <= 0) {
      return NextResponse.json({ error: 'Jumlah harus lebih dari 0' }, { status: 400 });
    }

    const kas = await db.kasRT.create({
      data: {
        tanggal: new Date(tanggal),
        jenis,
        jumlah: Number(jumlah),
        keterangan: keterangan || '',
      },
    });

    return NextResponse.json(kas);
  } catch (error) {
    console.error('POST /api/kas-rt error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    // Jika tabel belum ada, coba buat otomatis
    if (msg.includes('does not exist') || msg.includes('relation')) {
      try {
        await db.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "KasRT" (
            "id" SERIAL PRIMARY KEY,
            "tanggal" TIMESTAMP(3) NOT NULL,
            "jenis" TEXT NOT NULL,
            "jumlah" INTEGER NOT NULL,
            "keterangan" TEXT NOT NULL DEFAULT '',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // Retry setelah tabel dibuat
        const kas = await db.kasRT.create({
          data: {
            tanggal: new Date(tanggal),
            jenis,
            jumlah: Number(jumlah),
            keterangan: keterangan || '',
          },
        });
        return NextResponse.json(kas);
      } catch (retryError) {
        console.error('POST /api/kas-rt retry error:', retryError);
        return NextResponse.json({ error: 'Gagal menambah data kas: tabel belum tersedia' }, { status: 500 });
      }
    }
    return NextResponse.json({ error: `Gagal menambah data kas: ${msg}` }, { status: 500 });
  }
}
