import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin, requireAuth, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// Helper: ensure SembakoSnapshot table exists (auto-create if missing, one-time per instance)
let _snapshotTableEnsured = false;
async function ensureTable() {
  if (_snapshotTableEnsured) return;
  try {
    await db.$queryRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SembakoSnapshot" (
        "id" SERIAL PRIMARY KEY,
        "rtId" INTEGER NOT NULL DEFAULT 1,
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

  // Pastikan kolom rtId ada (untuk tabel yang sudah ada sebelumnya)
  try {
    const cols = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'sembakosnapshot' AND column_name = 'rtid'`
    );
    if (!cols.length) {
      await db.$executeRawUnsafe(
        `ALTER TABLE "SembakoSnapshot" ADD COLUMN IF NOT EXISTS "rtId" INTEGER NOT NULL DEFAULT 1`
      );
    }
  } catch (e) {
    console.error('Failed to add rtId to SembakoSnapshot:', e);
  }

  _snapshotTableEnsured = true;
}

// GET /api/sembako/save - list all saved snapshots (filtered by rtId for admin, all for superadmin)
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
        rtId: snapshot.rtId,
        nama: snapshot.nama,
        jumlahPenerima: snapshot.jumlahPenerima,
        data: parsedData,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      });
    }

    // Filter by rtId: admin hanya lihat snapshot milik RT sendiri, superadmin lihat semua
    const where: Record<string, unknown> = {};
    if (auth.rtId) where.rtId = auth.rtId;

    const snapshots = await db.sembakoSnapshot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const result = snapshots.map(s => ({
      id: s.id,
      rtId: s.rtId,
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
        rtId: auth.rtId || 1,
        nama,
        jumlahPenerima: data.length,
        data: JSON.stringify(data),
      },
    });

    revalidatePath('/api/sembako/save');
    return NextResponse.json({
      success: true,
      id: snapshot.id,
      rtId: snapshot.rtId,
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

    // Get snapshot for response + ownership check
    const snapshot = await db.sembakoSnapshot.findUnique({ where: { id } });
    if (!snapshot) {
      return NextResponse.json({ error: 'Data tersimpan tidak ditemukan' }, { status: 404 });
    }

    // Verify ownership: admin hanya bisa hapus snapshot milik RT sendiri
    if (auth.rtId && snapshot.rtId !== auth.rtId && auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
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
