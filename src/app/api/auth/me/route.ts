import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ authenticated: false, role: null }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      role: session.role,
      nama: session.nama,
      username: session.username,
      rtId: session.rtId,
      rtInfo: session.rtInfo,
    });
  } catch {
    return NextResponse.json({ authenticated: false, role: null }, { status: 401 });
  }
}
