import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Bypass middleware — jalankan di Vercel server (bukan dari lokal)
const prisma = new PrismaClient();

export async function GET() {
  try {
    // Cek apakah tabel sudah ada
    const result = await prisma.suratPengantar.count();
    return NextResponse.json({
      success: true,
      message: 'Tabel SuratPengantar sudah ada',
      count: result,
    });
  } catch (error: any) {
    // Tabel belum ada — buat via raw SQL
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "SuratPengantar" (
          "id" SERIAL PRIMARY KEY,
          "rtId" INTEGER NOT NULL DEFAULT 1,
          "nomorSurat" TEXT NOT NULL,
          "namaPemohon" TEXT NOT NULL,
          "nik" TEXT NOT NULL,
          "tujuan" TEXT NOT NULL,
          "keterangan" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      return NextResponse.json({
        success: true,
        message: 'Tabel SuratPengantar berhasil dibuat',
        count: 0,
      });
    } catch (createError: any) {
      return NextResponse.json({
        success: false,
        message: 'Gagal membuat tabel',
        error: createError.message,
      }, { status: 500 });
    }
  } finally {
    await prisma.$disconnect();
  }
}
