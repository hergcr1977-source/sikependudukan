import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PUT - update data kas
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, tanggal, jenis, jumlah, keterangan } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    const existing = await prisma.kasRT.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return NextResponse.json({ error: 'Data kas tidak ditemukan' }, { status: 404 });
    }

    const kas = await prisma.kasRT.update({
      where: { id: Number(id) },
      data: {
        ...(tanggal && { tanggal: new Date(tanggal) }),
        ...(jenis && { jenis }),
        ...(jumlah !== undefined && { jumlah: Number(jumlah) }),
        ...(keterangan !== undefined && { keterangan }),
      },
    });

    return NextResponse.json(kas);
  } catch (error) {
    console.error('PUT /api/kas-rt/[id] error:', error);
    return NextResponse.json({ error: 'Gagal mengupdate data kas' }, { status: 500 });
  }
}

// DELETE - hapus data kas
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    const existing = await prisma.kasRT.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return NextResponse.json({ error: 'Data kas tidak ditemukan' }, { status: 404 });
    }

    await prisma.kasRT.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/kas-rt/[id] error:', error);
    return NextResponse.json({ error: 'Gagal menghapus data kas' }, { status: 500 });
  }
}
