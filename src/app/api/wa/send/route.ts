import { NextRequest, NextResponse } from 'next/server';

const FONNTE_API_KEY = process.env.FONNTE_API_KEY || 'Qpd7Wq4tJLHQF6qNVo5S';
const FONNTE_SEND_URL = 'https://api.fonnte.com/send';

// POST - kirim pesan WA ke satu nomor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { target, message } = body;

    if (!target || !message) {
      return NextResponse.json({ error: 'Target dan message wajib diisi' }, { status: 400 });
    }

    // Clean phone number
    let phone = String(target).replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);

    const res = await fetch(FONNTE_SEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: phone,
        message,
        country_code: '62',
      }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Send WA error:', error);
    return NextResponse.json({ error: 'Gagal mengirim pesan' }, { status: 500 });
  }
}
