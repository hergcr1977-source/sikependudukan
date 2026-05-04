import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cek apakah tabel SuratPengantar sudah ada
export async function GET() {
  try {
    const result = await prisma.suratPengantar.count();
    return NextResponse.json({
      success: true,
      message: 'Tabel SuratPengantar sudah ada',
      count: result,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Tabel SuratPengantar belum ada',
      error: error.message,
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
