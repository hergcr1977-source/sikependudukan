import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    version: 'v4.1-neon-pg',
    commit: 'neon-pg-ready',
    scanMethod: 'client-side-puter-direct',
    timestamp: new Date().toISOString(),
  });
}
