import { NextResponse } from 'next/server';

// Endpoint debug untuk cek DATABASE_URL dan status database
export async function GET() {
  const dbUrl = process.env.DATABASE_URL || 'NOT SET';
  const maskedUrl = dbUrl === 'NOT SET' ? dbUrl : dbUrl.substring(0, 30) + '...';

  return NextResponse.json({
    DATABASE_URL_SET: dbUrl !== 'NOT SET',
    DATABASE_URL_PREFIX: dbUrl.startsWith('postgresql') ? 'postgresql://' : dbUrl.startsWith('postgres') ? 'postgres://' : dbUrl.startsWith('file') ? 'file:' : 'unknown: ' + dbUrl.substring(0, 20),
    DATABASE_URL_MASKED: maskedUrl,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL || 'not set',
  });
}
