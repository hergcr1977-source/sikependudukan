import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    version: 'v4-client-puter',
    commit: '94a8644',
    scanMethod: 'client-side-puter-direct',
    timestamp: new Date().toISOString(),
  });
}
