import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    const data = await prisma.kasRT.findMany({
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

    const kas = await prisma.kasRT.create({
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
    return NextResponse.json({ error: 'Gagal menambah data kas' }, { status: 500 });
  }
}
