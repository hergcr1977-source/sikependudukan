/**
 * Fonnte WhatsApp Bot Integration
 * 
 * Commands available:
 * #NIK <nik>       - Cek data penduduk berdasarkan NIK
 * #CARI <nama>     - Cari penduduk berdasarkan nama
 * #STATISTIK       - Laporan statistik penduduk
 * #KAS [bulan]     - Info kas RT (bulan ini / bulan tertentu)
 * #SEMENTARA <nik> - Cek data penduduk sementara
 * #BANTUAN         - Info bantuan sosial
 * #HELP            - Menu bantuan
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

// Helper: clean phone number
function cleanPhone(raw: string): string {
  let phone = raw.replace(/[^0-9]/g, '');
  if (phone.startsWith('0')) phone = '62' + phone.substring(1);
  return phone;
}

// ============ COMMAND HANDLERS ============

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

  const msg = `*DATA PENDUDUK*
━━━━━━━━━━━━━━━━━
*Nama:* ${p.namaLengkap || '-'}
*NIK:* ${p.nik}
*No. KK:* ${p.noKK}
*Jenis Kelamin:* ${p.jenisKelamin || '-'}
*Status Keluarga:* ${p.statusKeluarga || '-'}
*Tempat/Tgl Lahir:* ${p.tempatLahir || '-'}, ${tanggalLahir}
*Agama:* ${p.agama || '-'}
*Pendidikan:* ${p.pendidikan || '-'}
*Pekerjaan:* ${p.pekerjaan || '-'}
*Status Kawin:* ${p.statusPerkawinan || '-'}
*WNI:* ${p.kewarganegaraan || '-'}
*No. HP:* ${p.noHP || '-'}
*Punya KTP:* ${p.punyaKTP || '-'}
*BPJS:* ${p.bpjs || '-'}
*Bantuan:* ${bantuanStr}
*Alamat:* ${p.alamat || '-'}, RT ${p.rt || '-'}/RW ${p.rw || '-'}
*Kelurahan:* ${p.kelurahan || '-'}, ${p.kecamatan || '-'}, ${p.kabupaten || '-'}, ${p.provinsi || '-'}
*Keterangan:* ${p.keterangan || '-'}
━━━━━━━━━━━━━━━━━
_Data dari Sistem Kependudukan RT.001 RW.002_`;

  return await sendWaMessage(phone, msg);
}

async function handleCariNama(phone: string, nama: string) {
  if (nama.length < 3) {
    return await sendWaMessage(phone, `Nama terlalu pendek, minimal 3 karakter.\n\nContoh: #CARI HERMAN`);
  }

  const results = await db.$queryRawUnsafe(
    `SELECT * FROM "Penduduk" WHERE "namaLengkap" ILIKE $1 ORDER BY "namaLengkap" ASC LIMIT 10`,
    `%${nama}%`
  ) as any[];

  if (!results || results.length === 0) {
    return await sendWaMessage(phone, `Penduduk dengan nama "*${nama}*" tidak ditemukan.`);
  }

  let msg = `*HASIL PENCARIAN: "${nama}"*\nDitemukan ${results.length} data:\n\n`;
  results.forEach((p: any, i: number) => {
    const jk = p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P';
    msg += `${i + 1}. *${p.namaLengkap}*\n   NIK: ${p.nik} | ${jk} | ${p.statusKeluarga}\n   RT ${p.rt}/${p.rw}\n\n`;
  });

  if (results.length >= 10) {
    msg += `_Menampilkan maksimal 10 hasil. Gunakan nama yang lebih spesifik._`;
  }
  msg += `\n_Ketik #NIK <nik> untuk detail lengkap_`;

  return await sendWaMessage(phone, msg);
}

async function handleStatistik(phone: string) {
  const total = await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "Penduduk"`) as any[];
  const laki = await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "Penduduk" WHERE "jenisKelamin" = 'LAKI-LAKI'`) as any[];
  const perempuan = await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "Penduduk" WHERE "jenisKelamin" = 'PEREMPUAN'`) as any[];
  const kk = await db.$queryRawUnsafe(`SELECT COUNT(DISTINCT "noKK")::int as count FROM "Penduduk"`) as any[];
  const sementara = await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "PendudukSementara"`) as any[];
  const kejadian = await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "Kejadian"`) as any[];

  const totalKas = await db.$queryRawUnsafe(
    `SELECT COALESCE(SUM(CASE WHEN "jenis" = 'PEMASUKAN' THEN "jumlah" ELSE 0 END), 0) as masuk,
            COALESCE(SUM(CASE WHEN "jenis" = 'PENGELUARAN' THEN "jumlah" ELSE 0 END), 0) as keluar,
            (COALESCE(SUM(CASE WHEN "jenis" = 'PEMASUKAN' THEN "jumlah" ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN "jenis" = 'PENGELUARAN' THEN "jumlah" ELSE 0 END), 0)) as saldo
     FROM "KasRT"`
  ) as any[];

  const usiaData = await db.$queryRawUnsafe(`
    SELECT
      COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE("tanggalLahir")) < 17) as anak,
      COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE("tanggalLahir")) BETWEEN 17 AND 59) as produktif,
      COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE("tanggalLahir")) >= 60) as lansia
    FROM "Penduduk" WHERE "tanggalLahir" IS NOT NULL
  `) as any[];

  const u = usiaData[0] || { anak: 0, produktif: 0, lansia: 0 };
  const kas = totalKas[0] || { masuk: 0, keluar: 0, saldo: 0 };
  const formatRp = (n: number) => new Intl.NumberFormat('id-ID').format(n);

  const msg = `*STATISTIK RT.001 RW.002*
━━━━━━━━━━━━━━━━━
*Penduduk Tetap:* ${total[0]?.count || 0} orang
   Laki-laki: ${laki[0]?.count || 0}
   Perempuan: ${perempuan[0]?.count || 0}
   Jumlah KK: ${kk[0]?.count || 0}

*Penduduk Sementara:* ${sementara[0]?.count || 0} orang

*Usia Penduduk:*
   Anak (<17): ${u.anak}
   Produktif (17-59): ${u.produktif}
   Lansia (60+): ${u.lansia}

*Kejadian:* ${kejadian[0]?.count || 0}

*Kas RT:*
   Pemasukan: Rp ${formatRp(kas.masuk)}
   Pengeluaran: Rp ${formatRp(kas.keluar)}
   Saldo: Rp ${formatRp(kas.saldo)}

━━━━━━━━━━━━━━━━━
_Data per ${formatTanggal(new Date())}_`;

  return await sendWaMessage(phone, msg);
}

async function handleKasRT(phone: string, bulanParam?: string) {
  const now = new Date();
  let bulan = bulanParam ? parseInt(bulanParam) : now.getMonth() + 1;
  let tahun = now.getFullYear();

  if (bulanParam && bulanParam.includes('-')) {
    const parts = bulanParam.split('-');
    bulan = parseInt(parts[0]);
    tahun = parseInt(parts[1]);
  }

  if (bulan < 1 || bulan > 12) {
    return await sendWaMessage(phone, `Bulan tidak valid (1-12).\n\nContoh:\n#KAS\n#KAS 4\n#KAS 4-2026`);
  }

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
  let msg = `*KAS RT - ${namaBulan[bulan - 1]} ${tahun}*\n━━━━━━━━━━━━━━━━━\n\n`;

  data.forEach((d: any) => {
    const tgl = formatTanggal(new Date(d.tanggal));
    const rp = new Intl.NumberFormat('id-ID').format(d.jumlah);
    if (d.jenis === 'PEMASUKAN') {
      totalMasuk += d.jumlah;
      msg += `*+Rp ${rp}*\n   ${tgl} | ${d.keterangan || '-'}\n\n`;
    } else {
      totalKeluar += d.jumlah;
      msg += `*-Rp ${rp}*\n   ${tgl} | ${d.keterangan || '-'}\n\n`;
    }
  });

  const saldo = totalMasuk - totalKeluar;
  const fmtRp = (n: number) => new Intl.NumberFormat('id-ID').format(n);

  msg += `━━━━━━━━━━━━━━━━━
*Total Pemasukan:* Rp ${fmtRp(totalMasuk)}
*Total Pengeluaran:* Rp ${fmtRp(totalKeluar)}
*Saldo:* Rp ${fmtRp(saldo)}
━━━━━━━━━━━━━━━━━`;

  return await sendWaMessage(phone, msg);
}

async function handleSementara(phone: string, nik: string) {
  if (!/^\d{16}$/.test(nik)) {
    return await sendWaMessage(phone, `NIK harus 16 digit angka.\n\nContoh: #SEMENTARA 3201010101010001`);
  }

  const result = await db.$queryRawUnsafe(
    `SELECT * FROM "PendudukSementara" WHERE "nik" = $1 LIMIT 1`, nik
  ) as any[];

  if (!result || result.length === 0) {
    return await sendWaMessage(phone, `Data penduduk sementara dengan NIK *${nik}* tidak ditemukan.`);
  }

  const p = result[0];
  const tanggalLahir = p.tanggalLahir ? formatTanggal(new Date(p.tanggalLahir)) : '-';
  const tanggalMasuk = p.tanggalMasuk ? formatTanggal(new Date(p.tanggalMasuk)) : '-';
  const tanggalKeluar = p.tanggalKeluar ? formatTanggal(new Date(p.tanggalKeluar)) : 'Masih tinggal';

  const msg = `*DATA PENDUDUK SEMENTARA*
━━━━━━━━━━━━━━━━━
*Nama:* ${p.namaLengkap || '-'}
*NIK:* ${p.nik}
*No. KK:* ${p.noKK}
*Jenis Kelamin:* ${p.jenisKelamin || '-'}
*Status Keluarga:* ${p.statusKeluarga || '-'}
*Tempat/Tgl Lahir:* ${p.tempatLahir || '-'}, ${tanggalLahir}
*Status:* ${p.statusKeterangan || '-'}
*Alamat Asal:* ${p.alamatAsal || '-'}
*Tgl Masuk:* ${tanggalMasuk}
*Tgl Keluar:* ${tanggalKeluar}
*No. HP:* ${p.noHP || '-'}
━━━━━━━━━━━━━━━━━`;

  return await sendWaMessage(phone, msg);
}

async function handleBantuan(phone: string) {
  const totalBantuan = await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM "Penduduk" WHERE "bantuan" != '[]' AND "bantuan" IS NOT NULL`
  ) as any[];

  const bantuanList = await db.$queryRawUnsafe(
    `SELECT "bantuan" FROM "Penduduk" WHERE "bantuan" != '[]' AND "bantuan" IS NOT NULL`
  ) as any[];

  const bantuanCount: Record<string, number> = {};
  bantuanList.forEach((row: any) => {
    try {
      const arr = JSON.parse(row.bantuan);
      arr.forEach((b: string) => {
        bantuanCount[b] = (bantuanCount[b] || 0) + 1;
      });
    } catch {}
  });

  let msg = `*DATA BANTUAN SOSIAL*
━━━━━━━━━━━━━━━━━
*Total Penerima Bantuan:* ${totalBantuan[0]?.count || 0} penduduk\n\n`;

  if (Object.keys(bantuanCount).length > 0) {
    msg += `*Rincian per Jenis Bantuan:*\n`;
    Object.entries(bantuanCount)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .forEach(([nama, count]) => {
        msg += `  - ${nama}: ${count} orang\n`;
      });
  } else {
    msg += `_Belum ada data bantuan tercatat._`;
  }

  msg += `\n━━━━━━━━━━━━━━━━━`;
  return await sendWaMessage(phone, msg);
}

async function handleHelp(phone: string) {
  const msg = `*BOT WA SIKEPENDUDUKAN*
RT.001 RW.002

*DAFTAR PERINTAH:*

1. *#NIK <nik>*
   Cek data penduduk lengkap
   Contoh: #NIK 3201010101010001

2. *#CARI <nama>*
   Cari penduduk berdasarkan nama
   Contoh: #CARI HERMAN

3. *#STATISTIK*
   Laporan statistik RT lengkap

4. *#KAS [bulan]*
   Info kas RT bulan ini/bulan tertentu
   Contoh: #KAS atau #KAS 4-2026

5. *#SEMENTARA <nik>*
   Cek data penduduk sementara
   Contoh: #SEMENTARA 3201010101010001

6. *#BANTUAN*
   Info data bantuan sosial

7. *#HELP*
   Tampilkan menu ini

_Powered by Sistem Kependudukan RT.001 RW.002_`;

  return await sendWaMessage(phone, msg);
}

// ============ MAIN COMMAND PROCESSOR ============

async function processCommand(phone: string, message: string) {
  const text = message.trim().toUpperCase();

  console.log(`Processing WA command from ${phone}: "${text}"`);

  if (text.startsWith('#NIK ')) {
    const nik = text.replace('#NIK ', '').trim();
    return await handleCekNik(phone, nik);
  } else if (text.startsWith('#CARI ')) {
    const nama = message.trim().substring(6).trim();
    return await handleCariNama(phone, nama);
  } else if (text === '#STATISTIK') {
    return await handleStatistik(phone);
  } else if (text.startsWith('#KAS')) {
    const param = text.replace('#KAS', '').trim();
    return await handleKasRT(phone, param || undefined);
  } else if (text.startsWith('#SEMENTARA ')) {
    const nik = text.replace('#SEMENTARA ', '').trim();
    return await handleSementara(phone, nik);
  } else if (text === '#BANTUAN') {
    return await handleBantuan(phone);
  } else if (text === '#HELP' || text === 'MENU' || text === '#MENU') {
    return await handleHelp(phone);
  } else {
    return await sendWaMessage(phone,
      `Perintah tidak dikenali.\n\nKetik *#HELP* untuk melihat daftar perintah yang tersedia.`
    );
  }
}

// ============ PARSE FONNTE WEBHOOK ============

function extractFromFonnte(body: any): { phone: string; message: string; name: string } | null {
  // Try every possible field combination Fonnte might send

  // Format 1: Direct fields (most common)
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

  // Format 3: data wrapper (callback)
  if (body.data) {
    return {
      phone: body.data.phone || body.data.from || body.data.remoteJid || '',
      message: body.data.message || body.data.text || body.data.body || body.data.conversation || '',
      name: body.data.name || body.data.pushName || '',
    };
  }

  // Format 4: entry/messages format (some versions)
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

  // Format 6: Bare minimum - any field with phone-like value
  const allKeys = Object.keys(body);
  const phoneKey = allKeys.find(k => {
    const v = String(body[k]);
    return v.length >= 10 && /^\d+$/.test(v.replace(/[^0-9]/g, ''));
  });
  if (phoneKey) {
    const msgKey = allKeys.find(k => k !== phoneKey && typeof body[k] === 'string' && body[k].length > 0);
    if (msgKey) {
      return {
        phone: body[phoneKey],
        message: body[msgKey],
        name: body.name || body.pushName || '',
      };
    }
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
      // Try JSON first, fallback to text
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

    // Extract phone, message, name from Fonnte format
    const extracted = extractFromFonnte(body);

    if (!extracted) {
      console.log('Could not extract phone/message from webhook body. Body:', JSON.stringify(body).substring(0, 500));

      // Log it
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
    commands: ['#NIK', '#CARI', '#STATISTIK', '#KAS', '#SEMENTARA', '#BANTUAN', '#HELP'],
    recent_webhooks: webhookLogs.slice(0, 10),
    total_webhooks_received: webhookLogs.length,
  });
}
