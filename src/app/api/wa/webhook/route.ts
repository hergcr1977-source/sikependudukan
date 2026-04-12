/**
 * Fonnte WhatsApp Bot Integration
 * 
 * Commands available:
 * #HELP            - Menu bantuan
 * #BANTUAN         - Desil, jenis bantuan, jenis BPJS
 * #NIK <nik>       - Data penduduk berdasarkan NIK
 * #KK <no_kk>      - Semua penduduk sesuai No. KK
 * #KAS             - Info kas RT bulan ini (pemasukan & pengeluaran)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const FONNTE_API_KEY = process.env.FONNTE_API_KEY || 'Qpd7Wq4tJLHQF6qNVo5S';
const FONNTE_SEND_URL = 'https://api.fonnte.com/send';

// In-memory webhook log (for debugging)
const webhookLogs: Array<{
  time: string;
  from: string;
  phone: string;
  message: string;
  rawBody: string;
  replyStatus: string;
  replyDetail: string;
}> = [];
const MAX_LOGS = 50;

// Helper: kirim pesan WA via Fonnte
async function sendWaMessage(target: string, message: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(FONNTE_SEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target,
        message,
        country_code: '62',
      }),
    });
    const data = await res.json();
    console.log('Fonnte send response:', JSON.stringify(data));

    if (data.status === true) {
      return { ok: true, detail: JSON.stringify(data) };
    }
    return { ok: false, detail: `Fonnte error: ${data.reason || JSON.stringify(data)}` };
  } catch (error: any) {
    console.error('sendWaMessage error:', error);
    return { ok: false, detail: `Exception: ${error.message}` };
  }
}

// Helper: format tanggal
function formatTanggal(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// Helper: format uang
function formatRp(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}

// Helper: clean phone number
function cleanPhone(raw: string): string {
  let phone = raw.replace(/[^0-9]/g, '');
  if (phone.startsWith('0')) phone = '62' + phone.substring(1);
  return phone;
}

// ============ COMMAND HANDLERS ============

async function handleHelp(phone: string) {
  const msg = `*BOT WA SIKEPENDUDUKAN*
RT.001 RW.002

*DAFTAR PERINTAH:*

1. *#HELP*
   Tampilkan menu ini

2. *#NIK <nik>*
   Cek data penduduk lengkap
   Contoh: #NIK 3201010101010001

3. *#KK <no_kk>*
   Data semua anggota keluarga
   Contoh: #KK 3201010101010001

4. *#BANTUAN*
   Data desil, jenis bantuan, dan BPJS

5. *#KAS*
   Info kas RT bulan ini

_Powered by Sistem Kependudukan RT.001 RW.002_`;

  return await sendWaMessage(phone, msg);
}

async function handleCekNik(phone: string, nik: string) {
  if (!/^\d{16}$/.test(nik)) {
    return await sendWaMessage(phone, `NIK harus 16 digit angka.\n\nContoh: #NIK 3201010101010001`);
  }

  const penduduk = await db.$queryRawUnsafe(
    `SELECT * FROM "Penduduk" WHERE "nik" = $1 LIMIT 1`, nik
  ) as any[];

  if (!penduduk || penduduk.length === 0) {
    return await sendWaMessage(phone, `Data penduduk dengan NIK *${nik}* tidak ditemukan.`);
  }

  const p = penduduk[0];
  const tanggalLahir = p.tanggalLahir ? formatTanggal(new Date(p.tanggalLahir)) : '-';
  const bantuanArr = p.bantuan ? JSON.parse(p.bantuan) : [];
  const bantuanStr = bantuanArr.length > 0 ? bantuanArr.join(', ') : 'Tidak ada';
  const umur = p.tanggalLahir ? Math.floor((Date.now() - new Date(p.tanggalLahir).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  const msg = `*DATA PENDUDUK*
━━━━━━━━━━━━━━━━━
*Nama:* ${p.namaLengkap || '-'}
*NIK:* ${p.nik}
*No. KK:* ${p.noKK}
*Jenis Kelamin:* ${p.jenisKelamin === 'LAKI-LAKI' ? 'Laki-laki' : p.jenisKelamin === 'PEREMPUAN' ? 'Perempuan' : '-'}
*Status Keluarga:* ${p.statusKeluarga || '-'}
*Tempat/Tgl Lahir:* ${p.tempatLahir || '-'}, ${tanggalLahir}
*Umur:* ${umur !== null ? `${umur} tahun` : '-'}
*Agama:* ${p.agama || '-'}
*Pendidikan:* ${p.pendidikan || '-'}
*Pekerjaan:* ${p.pekerjaan || '-'}
*Status Kawin:* ${p.statusPerkawinan || '-'}
*Kewarganegaraan:* ${p.kewarganegaraan || '-'}
*No. HP:* ${p.noHP || '-'}
*Punya KTP:* ${p.punyaKTP || '-'}
*BPJS:* ${p.bpjs || '-'}
*Desil:* ${p.desil || '-'}
*Bantuan:* ${bantuanStr}
*Alamat:* ${p.alamat || '-'}, RT ${p.rt || '-'}/RW ${p.rw || '-'}
*Kelurahan:* ${p.kelurahan || '-'}, ${p.kecamatan || '-'}, ${p.kabupaten || '-'}, ${p.provinsi || '-'}
*Keterangan:* ${p.keterangan || '-'}
━━━━━━━━━━━━━━━━━
_Data dari Sistem Kependudukan RT.001 RW.002_`;

  return await sendWaMessage(phone, msg);
}

async function handleCekKK(phone: string, noKK: string) {
  // Clean noKK - accept 16 or 18 digits
  const kk = noKK.replace(/[^0-9]/g, '');
  if (kk.length < 15) {
    return await sendWaMessage(phone, `No. KK minimal 15 digit angka.\n\nContoh: #KK 3201010101010001`);
  }

  const anggota = await db.$queryRawUnsafe(
    `SELECT * FROM "Penduduk" WHERE "noKK" = $1 ORDER BY CASE 
      WHEN "statusKeluarga" = 'KEPALA KELUARGA' THEN 1
      WHEN "statusKeluarga" = 'ISTRI' THEN 2
      WHEN "statusKeluarga" = 'ANAK' THEN 3
      ELSE 4
    END ASC`, kk
  ) as any[];

  if (!anggota || anggota.length === 0) {
    return await sendWaMessage(phone, `Data penduduk dengan No. KK *${kk}* tidak ditemukan.`);
  }

  let msg = `*DATA KEPERLUARGAAN*
━━━━━━━━━━━━━━━━━
*No. KK:* ${kk}
*Jumlah Anggota:* ${anggota.length} orang
*Alamat:* ${anggota[0].alamat || '-'}, RT ${anggota[0].rt || '-'}/RW ${anggota[0].rw || '-'}
*Kelurahan:* ${anggota[0].kelurahan || '-'}, ${anggota[0].kecamatan || '-'}

━━━━━━━━━━━━━━━━━\n`;

  anggota.forEach((p: any, i: number) => {
    const tglLahir = p.tanggalLahir ? formatTanggal(new Date(p.tanggalLahir)) : '-';
    const umur = p.tanggalLahir ? Math.floor((Date.now() - new Date(p.tanggalLahir).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
    const jk = p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P';
    const bantuanArr = p.bantuan ? JSON.parse(p.bantuan) : [];
    const bantuanStr = bantuanArr.length > 0 ? bantuanArr.join(', ') : '-';

    msg += `${i + 1}. *${p.namaLengkap}*
   NIK: ${p.nik}
   ${jk} | ${p.statusKeluarga || '-'} | ${umur !== null ? `${umur} thn` : '-'}
   TTL: ${p.tempatLahir || '-'}, ${tglLahir}
   Pendidikan: ${p.pendidikan || '-'}
   Pekerjaan: ${p.pekerjaan || '-'}
   KTP: ${p.punyaKTP || '-'} | BPJS: ${p.bpjs || '-'}
   Desil: ${p.desil || '-'} | Bantuan: ${bantuanStr}
   No. HP: ${p.noHP || '-'}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━
_Data dari Sistem Kependudukan RT.001 RW.002_`;

  return await sendWaMessage(phone, msg);
}

async function handleBantuan(phone: string) {
  // 1. Data Desil
  const desilData = await db.$queryRawUnsafe(
    `SELECT "desil", COUNT(*)::int as count FROM "Penduduk" WHERE "desil" IS NOT NULL AND "desil" != '' GROUP BY "desil" ORDER BY "desil" ASC`
  ) as any[];

  // 2. Data Jenis Bantuan
  const bantuanRows = await db.$queryRawUnsafe(
    `SELECT "bantuan" FROM "Penduduk" WHERE "bantuan" != '[]' AND "bantuan" IS NOT NULL AND "bantuan" != ''`
  ) as any[];

  const bantuanCount: Record<string, number> = {};
  let totalPenerima = 0;
  bantuanRows.forEach((row: any) => {
    try {
      const arr = JSON.parse(row.bantuan);
      if (arr.length > 0) {
        totalPenerima++;
        arr.forEach((b: string) => {
          bantuanCount[b] = (bantuanCount[b] || 0) + 1;
        });
      }
    } catch {}
  });

  // 3. Data BPJS
  const bpjsData = await db.$queryRawUnsafe(
    `SELECT "bpjs", COUNT(*)::int as count FROM "Penduduk" WHERE "bpjs" IS NOT NULL AND "bpjs" != '' GROUP BY "bpjs" ORDER BY count DESC`
  ) as any[];

  const totalPenduduk = await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "Penduduk"`) as any[];
  const total = totalPenduduk[0]?.count || 0;

  let msg = `*DATA BANTUAN SOSIAL & BPJS*
━━━━━━━━━━━━━━━━━
*Total Penduduk:* ${total} orang
*Penerima Bantuan:* ${totalPenerima} orang (${total > 0 ? Math.round(totalPenerima / total * 100) : 0}%)\n`;

  // Desil
  msg += `\n*DESKRIPSI KEMISKINAN (DESLIL):*\n`;
  if (desilData.length > 0) {
    desilData.forEach((d: any) => {
      msg += `  ${d.desil}: ${d.count} orang\n`;
    });
  } else {
    msg += `  _Belum ada data desil_\n`;
  }

  // Jenis Bantuan
  msg += `\n*JENIS BANTUAN YANG DITERIMA:*\n`;
  if (Object.keys(bantuanCount).length > 0) {
    Object.entries(bantuanCount)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .forEach(([nama, count]) => {
        msg += `  - ${nama}: ${count} orang\n`;
      });
  } else {
    msg += `  _Belum ada data bantuan_\n`;
  }

  // BPJS
  msg += `\n*KEPEMILIKAN BPJS:*\n`;
  if (bpjsData.length > 0) {
    bpjsData.forEach((b: any) => {
      msg += `  - ${b.bpjs}: ${b.count} orang\n`;
    });
  } else {
    msg += `  _Belum ada data BPJS_\n`;
  }

  msg += `\n━━━━━━━━━━━━━━━━━
_Data dari Sistem Kependudukan RT.001 RW.002_`;

  return await sendWaMessage(phone, msg);
}

async function handleKasRT(phone: string) {
  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();

  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const data = await db.$queryRawUnsafe(
    `SELECT * FROM "KasRT" WHERE "tanggal" >= $1 AND "tanggal" <= $2 ORDER BY "tanggal" ASC`,
    new Date(tahun, bulan - 1, 1),
    new Date(tahun, bulan, 0, 23, 59, 59)
  ) as any[];

  if (!data || data.length === 0) {
    return await sendWaMessage(phone, `Tidak ada data kas RT untuk bulan ${namaBulan[bulan - 1]} ${tahun}.`);
  }

  let totalMasuk = 0;
  let totalKeluar = 0;

  // Group by jenis
  const pemasukan: string[] = [];
  const pengeluaran: string[] = [];

  data.forEach((d: any) => {
    const tgl = formatTanggal(new Date(d.tanggal));
    const rp = formatRp(d.jumlah);
    if (d.jenis === 'PEMASUKAN') {
      totalMasuk += d.jumlah;
      pemasukan.push(`  +Rp ${rp}\n    ${tgl} | ${d.keterangan || '-'}`);
    } else {
      totalKeluar += d.jumlah;
      pengeluaran.push(`  -Rp ${rp}\n    ${tgl} | ${d.keterangan || '-'}`);
    }
  });

  const saldo = totalMasuk - totalKeluar;

  let msg = `*KAS RT - ${namaBulan[bulan - 1]} ${tahun}*
━━━━━━━━━━━━━━━━━\n`;

  if (pemasukan.length > 0) {
    msg += `*PEMASUKAN (${pemasukan.length} transaksi):*\n`;
    msg += pemasukan.join('\n') + '\n\n';
  }

  if (pengeluaran.length > 0) {
    msg += `*PENGELUARAN (${pengeluaran.length} transaksi):*\n`;
    msg += pengeluaran.join('\n') + '\n\n';
  }

  msg += `━━━━━━━━━━━━━━━━━
*Total Pemasukan:* Rp ${formatRp(totalMasuk)}
*Total Pengeluaran:* Rp ${formatRp(totalKeluar)}
*Saldo Bulan Ini:* Rp ${formatRp(saldo)}
━━━━━━━━━━━━━━━━━
_Data dari Sistem Kependudukan RT.001 RW.002_`;

  return await sendWaMessage(phone, msg);
}

// ============ MAIN COMMAND PROCESSOR ============

async function processCommand(phone: string, message: string) {
  const text = message.trim().toUpperCase();

  console.log(`Processing WA command from ${phone}: "${text}"`);

  if (text === '#HELP' || text === '#MENU' || text === 'MENU') {
    return await handleHelp(phone);
  } else if (text.startsWith('#NIK ')) {
    const nik = text.replace('#NIK ', '').trim();
    return await handleCekNik(phone, nik);
  } else if (text.startsWith('#KK ')) {
    const noKK = message.trim().substring(4).trim();
    return await handleCekKK(phone, noKK);
  } else if (text === '#BANTUAN') {
    return await handleBantuan(phone);
  } else if (text === '#KAS') {
    return await handleKasRT(phone);
  } else {
    return await sendWaMessage(phone,
      `Perintah tidak dikenali.\n\nKetik *#HELP* untuk melihat daftar perintah yang tersedia.`
    );
  }
}

// ============ PARSE FONNTE WEBHOOK ============

function extractFromFonnte(body: any): { phone: string; message: string; name: string } | null {
  // Format 0: Fonnte-specific fields (pengirim = sender, pesan = message)
  if (body.pengirim && (body.pesan || body.message)) {
    return {
      phone: body.pengirim || body.sender || body.senderlid || '',
      message: body.pesan || body.message || '',
      name: body.name || body.pushName || '',
    };
  }

  // Format 1: Direct fields
  if (body.phone && body.message) {
    return {
      phone: body.phone,
      message: body.message,
      name: body.name || body.pushName || '',
    };
  }

  // Format 2: senderData wrapper
  if (body.senderData) {
    return {
      phone: body.senderData.phone || body.senderData.number || body.senderData.remoteJid || '',
      message: body.message || body.text || body.body || '',
      name: body.senderData.pushName || body.senderData.name || body.senderData.notify || '',
    };
  }

  // Format 3: data wrapper
  if (body.data) {
    return {
      phone: body.data.phone || body.data.from || body.data.remoteJid || '',
      message: body.data.message || body.data.text || body.data.body || body.data.conversation || '',
      name: body.data.name || body.data.pushName || '',
    };
  }

  // Format 4: entry/messages format
  if (body.entry && Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (change.value?.messages && Array.isArray(change.value.messages)) {
            const msg = change.value.messages[0];
            return {
              phone: msg.from || '',
              message: msg.text?.body || msg.text || msg.body || '',
              name: change.value.contact_name || change.value.contacts?.[0]?.profile?.name || '',
            };
          }
        }
      }
    }
  }

  // Format 5: messages array directly
  if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
    const msg = body.messages[0];
    return {
      phone: msg.from || msg.phone || '',
      message: msg.text?.body || msg.text || msg.body || msg.message || '',
      name: msg.pushName || msg.name || body.contacts?.[0]?.profile?.name || '',
    };
  }

  return null;
}

// ============ WEBHOOK ENDPOINTS ============

export async function POST(request: NextRequest) {
  let body: any = {};
  let rawBody = '';
  let phone = '';
  let message = '';
  let senderName = '';

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      rawBody = await request.text();
      body = JSON.parse(rawBody);
    } else if (contentType.includes('form-data') || contentType.includes('urlencoded')) {
      const formData = await request.formData();
      rawBody = '{}';
      body = {};
      for (const [key, value] of formData.entries()) {
        body[key] = value;
      }
    } else {
      rawBody = await request.text();
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = { raw: rawBody };
      }
    }

    console.log('=== FONNTE WEBHOOK RECEIVED ===');
    console.log('Content-Type:', contentType);
    console.log('Body keys:', Object.keys(body).join(', '));
    console.log('Raw body:', rawBody.substring(0, 500));

    // ===== CRITICAL: Skip non-incoming-message payloads =====

    // 1. Skip device state callbacks
    if (body.device && body.stateid && !body.pengirim) {
      console.log('Skipping device state callback');
      return NextResponse.json({ status: 'ignored', reason: 'device_state' });
    }

    // 2. Skip delivery callbacks / status updates
    if (body.status && body.id && !body.pengirim) {
      console.log('Skipping delivery callback');
      return NextResponse.json({ status: 'ignored', reason: 'delivery_callback' });
    }

    // 3. Skip OUTGOING messages from our own bot (quick=true)
    if (body.quick === true || body.quick === 'true') {
      console.log('Skipping our own outgoing message (quick=true)');
      return NextResponse.json({ status: 'ignored', reason: 'outgoing_message' });
    }

    // 4. Skip if sender matches device (bot replying to itself)
    if (body.pengirim && body.device && body.pengirim === body.device) {
      console.log('Skipping self-message (sender = device)');
      return NextResponse.json({ status: 'ignored', reason: 'self_message' });
    }

    // 5. Skip event/status notifications
    if (body.event || body.type === 'event' || body.type === 'status') {
      console.log('Skipping event/status notification');
      return NextResponse.json({ status: 'ignored', reason: 'event_notification' });
    }

    // Extract phone, message, name from Fonnte format
    const extracted = extractFromFonnte(body);

    if (!extracted) {
      console.log('Could not extract phone/message from webhook body.');

      webhookLogs.unshift({
        time: new Date().toISOString(),
        from: 'unknown',
        phone: '',
        message: '',
        rawBody: JSON.stringify(body).substring(0, 1000),
        replyStatus: 'skipped',
        replyDetail: 'Could not extract phone/message',
      });
      if (webhookLogs.length > MAX_LOGS) webhookLogs.pop();

      return NextResponse.json({ status: 'ignored', reason: 'could not extract phone or message', received_keys: Object.keys(body) });
    }

    phone = cleanPhone(extracted.phone);
    message = extracted.message;
    senderName = extracted.name || '';

    if (!phone || !message) {
      console.log('Empty phone or message after extraction');

      webhookLogs.unshift({
        time: new Date().toISOString(),
        from: senderName,
        phone: extracted.phone || '',
        message: extracted.message || '',
        rawBody: JSON.stringify(body).substring(0, 1000),
        replyStatus: 'skipped',
        replyDetail: 'Empty phone or message',
      });
      if (webhookLogs.length > MAX_LOGS) webhookLogs.pop();

      return NextResponse.json({ status: 'ignored', reason: 'empty phone or message' });
    }

    console.log(`From: ${senderName} (${phone}), Message: "${message}"`);

    // MUST await - Vercel serverless freezes after response
    const replyResult = await processCommand(phone, message);

    console.log(`Reply result: ok=${replyResult.ok}, detail=${replyResult.detail}`);

    // Save to log
    webhookLogs.unshift({
      time: new Date().toISOString(),
      from: senderName,
      phone,
      message,
      rawBody: JSON.stringify(body).substring(0, 1000),
      replyStatus: replyResult.ok ? 'sent' : 'failed',
      replyDetail: replyResult.detail,
    });
    if (webhookLogs.length > MAX_LOGS) webhookLogs.pop();

    return NextResponse.json({ status: 'ok', phone, command: message.substring(0, 50), reply: replyResult.ok });
  } catch (error: any) {
    console.error('Webhook error:', error);

    webhookLogs.unshift({
      time: new Date().toISOString(),
      from: 'error',
      phone: '',
      message: '',
      rawBody: rawBody.substring(0, 1000),
      replyStatus: 'error',
      replyDetail: error.message || String(error),
    });
    if (webhookLogs.length > MAX_LOGS) webhookLogs.pop();

    return NextResponse.json({ error: 'Webhook processing failed', detail: error.message }, { status: 500 });
  }
}

// GET - status check + webhook logs for debugging
export async function GET() {
  return NextResponse.json({
    service: 'Sikependudukan WA Bot',
    status: 'active',
    api_key_valid: FONNTE_API_KEY.startsWith('Qpd7'),
    webhook_url: 'https://sikependudukan.vercel.app/api/wa/webhook',
    commands: ['#HELP', '#NIK', '#KK', '#BANTUAN', '#KAS'],
    recent_webhooks: webhookLogs.slice(0, 10),
    total_webhooks_received: webhookLogs.length,
  });
}
