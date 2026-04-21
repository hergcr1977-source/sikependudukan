import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin, requireAuth, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// Helper: ensure SembakoSnapshot table exists (auto-create if missing)
async function ensureTable() {
  try {
    await db.$queryRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SembakoSnapshot" (
        "id" SERIAL PRIMARY KEY,
        "nama" TEXT NOT NULL,
        "jumlahPenerima" INTEGER NOT NULL DEFAULT 0,
        "data" TEXT NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('already exists')) {
      console.error('Failed to create SembakoSnapshot table:', msg);
    }
  }
}

// GET /api/sembako/save - list all saved snapshots (or single with ?id=X&detail=true)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthError(auth)) return auth;

    await ensureTable();

    const { searchParams } = new URL(request.url);
    const detailId = searchParams.get('id');
    const detail = searchParams.get('detail');

    // Return single snapshot with full data
    if (detailId && detail === 'true') {
      const snapshot = await db.sembakoSnapshot.findUnique({
        where: { id: parseInt(detailId) },
      });
      if (!snapshot) {
        return NextResponse.json({ error: 'Data tersimpan tidak ditemukan' }, { status: 404 });
      }
      let parsedData: any[] = [];
      try { parsedData = JSON.parse(snapshot.data); } catch { /* ignore */ }
      return NextResponse.json({
        id: snapshot.id,
        nama: snapshot.nama,
        jumlahPenerima: snapshot.jumlahPenerima,
        data: parsedData,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      });
    }

    const snapshots = await db.sembakoSnapshot.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const result = snapshots.map(s => ({
      id: s.id,
      nama: s.nama,
      jumlahPenerima: s.jumlahPenerima,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Sembako Save GET] Error:', error);
    return NextResponse.json({ error: 'Gagal mengambil daftar tersimpan' }, { status: 500 });
  }
}

// POST /api/sembako/save - save current sembako data as snapshot
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    await ensureTable();

    const body = await request.json();
    const { nama, data } = body;

    if (!nama || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Nama dan data wajib diisi' }, { status: 400 });
    }

    const snapshot = await db.sembakoSnapshot.create({
      data: {
        nama,
        jumlahPenerima: data.length,
        data: JSON.stringify(data),
      },
    });

    revalidatePath('/api/sembako/save');
    return NextResponse.json({
      success: true,
      id: snapshot.id,
      message: `Data "${nama}" berhasil disimpan (${data.length} penerima)`,
    });
  } catch (error) {
    console.error('[Sembako Save POST] Error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan data sembako' }, { status: 500 });
  }
}

// DELETE /api/sembako/save?id=X - delete a saved snapshot
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    await ensureTable();

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');
    if (!id) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    // Get snapshot name for response
    const snapshot = await db.sembakoSnapshot.findUnique({ where: { id } });
    if (!snapshot) {
      return NextResponse.json({ error: 'Data tersimpan tidak ditemukan' }, { status: 404 });
    }

    await db.sembakoSnapshot.delete({ where: { id } });
    revalidatePath('/api/sembako/save');
    return NextResponse.json({
      success: true,
      message: `Data "${snapshot.nama}" berhasil dihapus`,
    });
  } catch (error) {
    console.error('[Sembako Save DELETE] Error:', error);
    return NextResponse.json({ error: 'Gagal menghapus data tersimpan' }, { status: 500 });
  }
}
