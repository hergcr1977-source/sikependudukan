import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessions } from '@/app/api/auth/route';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({ authenticated: false, role: null }, { status: 401 });
    }

    const sessions = getSessions();
    const session = sessions.get(sessionId);
    if (!session || session.expires < Date.now()) {
      sessions.delete(sessionId);
      return NextResponse.json({ authenticated: false, role: null }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      role: session.role,
      nama: session.nama,
    });
  } catch {
    return NextResponse.json({ authenticated: false, role: null }, { status: 401 });
  }
}
