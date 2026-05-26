import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Add ketuaRW column if not exists
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SuratPengantar" ADD COLUMN IF NOT EXISTS "ketuaRW" TEXT;
    `);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Migration completed - ketuaRW column added' 
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
