import { NextRequest, NextResponse } from 'next/server';

const FONNTE_API_KEY = process.env.FONNTE_API_KEY || 'TwHzQtpypGU1t9p89UtUw';
const FONNTE_SEND_URL = 'https://api.fonnte.com/send';

// POST - broadcast pesan WA ke banyak nomor sekaligus
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targets, message, delay } = body;

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ error: 'Targets harus berupa array nomor HP' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: 'Message wajib diisi' }, { status: 400 });
    }

    if (targets.length > 500) {
      return NextResponse.json({ error: 'Maksimal 500 nomor per broadcast' }, { status: 400 });
    }

    // Clean phone numbers
    const cleanTargets = targets.map((t: string) => {
      let phone = String(t).replace(/[^0-9]/g, '');
      if (phone.startsWith('0')) phone = '62' + phone.substring(1);
      return phone;
    }).filter((p: string) => p.length >= 10);

    if (cleanTargets.length === 0) {
      return NextResponse.json({ error: 'Tidak ada nomor HP valid' }, { status: 400 });
    }

    // Send via Fonnte - multiple targets in one request
    const res = await fetch(FONNTE_SEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: cleanTargets.join(','),
        message,
        delay: delay || 3, // delay 3 detik antar pesan
        country_code: '62',
      }),
    });

    const data = await res.json();

    return NextResponse.json({
      success: true,
      sent: cleanTargets.length,
      response: data,
    });
  } catch (error) {
    console.error('Broadcast WA error:', error);
    return NextResponse.json({ error: 'Gagal mengirim broadcast' }, { status: 500 });
  }
}
