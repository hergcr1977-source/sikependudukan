import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/setup-demo
 * Membuat akun demo: RT 000, RW 000, Ketua RT Demo
 * Username: demo, Password: demo1234
 *
 * AMAN: tidak mengubah data yang sudah ada.
 * - Jika user "demo" sudah ada -> skip, tidak diubah
 * - Jika RT 000 sudah ada -> pakai yang ada, tidak diubah
 * - Jika RT 000 belum ada -> buat baru
 * - Jika user "demo" belum ada -> buat baru
 */
export async function GET() {
  try {
    const result: { step: string; message: string; data?: any }[] = [];

    // Step 1: Cek apakah user "demo" sudah ada
    const existingUser = await db.$queryRawUnsafe<Array<{ id: number; username: string; rtId: number | null }>>(
      `SELECT id, username, "rtId" FROM "AppUser" WHERE "username" = 'demo' LIMIT 1`
    );

    if (existingUser.length > 0) {
      result.push({
        step: 'cek_user',
        message: 'User "demo" sudah ada, tidak diubah (aman)',
        data: { id: existingUser[0].id, rtId: existingUser[0].rtId },
      });

      return NextResponse.json({
        success: true,
        message: 'Akun demo sudah tersedia',
        result,
      });
    }

    // Step 2: Cek atau buat RT 000 / RW 000
    const existingRT = await db.$queryRawUnsafe<Array<{ id: number; namaRT: string; rw: string }>>(
      `SELECT id, "namaRT", "rw" FROM "RukunTetangga" WHERE "namaRT" = '000' AND "rw" = '000' LIMIT 1`
    );

    let rtId: number;

    if (existingRT.length > 0) {
      rtId = existingRT[0].id;
      result.push({
        step: 'cek_rt',
        message: 'RT 000 / RW 000 sudah ada, pakai yang sudah ada (aman)',
        data: { id: rtId },
      });
    } else {
      // Buat RT 000 / RW 000 baru
      const newRT = await db.$queryRawUnsafe<Array<{ id: number }>>(`
        INSERT INTO "RukunTetangga" ("namaRT", "rw", "kelurahan", "kecamatan", "kabupaten", "provinsi", "alamat", "ketuaRT", "aktif")
        VALUES ('000', '000', 'DEMO', 'DEMO', 'DEMO', 'DEMO', 'DEMO', 'Ketua RT Demo', true)
        RETURNING id
      `);
      rtId = newRT[0].id;
      result.push({
        step: 'buat_rt',
        message: 'RT 000 / RW 000 berhasil dibuat',
        data: { id: rtId },
      });
    }

    // Step 3: Buat user demo
    await db.$executeRawUnsafe(`
      INSERT INTO "AppUser" ("username", "password", "nama", "role", "rtId", "aktif")
      VALUES ('demo', 'demo1234', 'Ketua RT Demo', 'admin', $1, true)
    `, rtId);

    result.push({
      step: 'buat_user',
      message: 'User "demo" berhasil dibuat',
      data: { username: 'demo', password: 'demo1234', role: 'admin', rtId },
    });

    return NextResponse.json({
      success: true,
      message: 'Akun demo berhasil dibuat',
      result,
    });
  } catch (error: any) {
    console.error('[setup-demo] Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Gagal membuat akun demo',
      error: error.message,
    }, { status: 500 });
  }
}
