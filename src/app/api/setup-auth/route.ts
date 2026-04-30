import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/setup-auth
 * Reset password superadmin ke default.
 * Endpoint ini TANPA auth — hanya untuk recovery saat lupa password.
 *
 * Body: { secret: 'reset-sikependudukan-2024' }
 * Jika secret benar, reset password superadmin ke default: SuperAdmin123!
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret } = body;

    if (secret !== 'reset-sikependudukan-2024') {
      return NextResponse.json(
        { error: 'Secret salah' },
        { status: 403 }
      );
    }

    // Cek apakah superadmin ada
    const existing = await db.$queryRawUnsafe<Array<{ id: number; username: string }>>(
      `SELECT id, username FROM "AppUser" WHERE "username" = 'superadmin' LIMIT 1`
    );

    if (existing.length) {
      // Update password superadmin yang sudah ada
      await db.$executeRawUnsafe(
        `UPDATE "AppUser" SET "password" = $1, "aktif" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE "username" = 'superadmin'`,
        'SuperAdmin123!'
      );
      return NextResponse.json({
        success: true,
        message: 'Password superadmin berhasil di-reset ke default'
      });
    } else {
      // Buat superadmin baru
      await db.$executeRawUnsafe(`
        INSERT INTO "AppUser" ("username", "password", "nama", "role", "rtId", "aktif")
        VALUES ('superadmin', 'SuperAdmin123!', 'SUPER ADMIN', 'superadmin', NULL, true)
      `);
      return NextResponse.json({
        success: true,
        message: 'Superadmin berhasil dibuat dengan password default'
      });
    }
  } catch (error) {
    console.error('Setup auth error:', error);
    return NextResponse.json(
      { error: 'Gagal reset password superadmin' },
      { status: 500 }
    );
  }
}
