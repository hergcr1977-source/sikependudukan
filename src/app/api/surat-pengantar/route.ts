import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Ambil semua surat pengantar
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rtId = parseInt(searchParams.get('rtId') || '0');

    const where: any = {};
    if (rtId) where.rtId = rtId;

    const data = await prisma.suratPengantar.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[GET /api/surat-pengantar]', error);
    return NextResponse.json({ error: 'Gagal mengambil data surat pengantar' }, { status: 500 });
  }
}

// POST - Tambah surat pengantar baru
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rtId, nomorSurat, namaPemohon, nik, tujuan, keterangan } = body;

    if (!nomorSurat || !namaPemohon || !nik || !tujuan) {
      return NextResponse.json({ error: 'Nomor surat, nama pemohon, NIK, dan tujuan wajib diisi' }, { status: 400 });
    }

    const surat = await prisma.suratPengantar.create({
      data: {
        rtId: rtId || 1,
        nomorSurat: nomorSurat.trim().toUpperCase(),
        namaPemohon: namaPemohon.trim().toUpperCase(),
        nik: nik.trim(),
        tujuan: tujuan.trim().toUpperCase(),
        keterangan: keterangan ? keterangan.trim().toUpperCase() : null,
      },
    });

    return NextResponse.json(surat);
  } catch (error: any) {
    console.error('[POST /api/surat-pengantar]', error);
    return NextResponse.json({ error: 'Gagal menambah surat pengantar' }, { status: 500 });
  }
}

// PUT - Edit surat pengantar
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, nomorSurat, namaPemohon, nik, tujuan, keterangan } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID surat wajib' }, { status: 400 });
    }

    const surat = await prisma.suratPengantar.update({
      where: { id },
      data: {
        ...(nomorSurat ? { nomorSurat: nomorSurat.trim().toUpperCase() } : {}),
        ...(namaPemohon ? { namaPemohon: namaPemohon.trim().toUpperCase() } : {}),
        ...(nik ? { nik: nik.trim() } : {}),
        ...(tujuan ? { tujuan: tujuan.trim().toUpperCase() } : {}),
        ...(keterangan !== undefined ? { keterangan: keterangan ? keterangan.trim().toUpperCase() : null } : {}),
      },
    });

    return NextResponse.json(surat);
  } catch (error: any) {
    console.error('[PUT /api/surat-pengantar]', error);
    return NextResponse.json({ error: 'Gagal mengupdate surat pengantar' }, { status: 500 });
  }
}

// DELETE - Hapus surat pengantar
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');

    if (!id) {
      return NextResponse.json({ error: 'ID surat wajib' }, { status: 400 });
    }

    await prisma.suratPengantar.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/surat-pengantar]', error);
    return NextResponse.json({ error: 'Gagal menghapus surat pengantar' }, { status: 500 });
  }
}
