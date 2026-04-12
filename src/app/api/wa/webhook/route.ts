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

const FONNTE_API_KEY = process.env.FONNTE_API_KEY || 'TwHzQtpypGU1t9p89UtUw';
const FONNTE_SEND_URL = 'https://api.fonnte.com/send';

// Helper: kirim pesan WA via Fonnte
async function sendWaMessage(target: string, message: string): Promise<boolean> {
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
    return data.status === true;
  } catch (error) {
    console.error('sendWaMessage error:', error);
    return false;
  }
}

// Helper: format tanggal
function formatTanggal(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ============ COMMAND HANDLERS ============

async function handleCekNik(phone: string, nik: string) {
  // Validasi NIK 16 digit
  if (!/^\d{16}$/.test(nik)) {
    await sendWaMessage(phone, `❌ NIK harus 16 digit angka.\n\nContoh: #NIK 3201010101010001`);
    return;
  }

  const penduduk = await db.$queryRawUnsafe(
    `SELECT * FROM "Penduduk" WHERE "nik" = $1 LIMIT 1`, nik
  ) as any[];

  if (!penduduk || penduduk.length === 0) {
    await sendWaMessage(phone, `❌ Data penduduk dengan NIK *${nik}* tidak ditemukan.`);
    return;
  }

  const p = penduduk[0];
  const tanggalLahir = p.tanggalLahir ? formatTanggal(new Date(p.tanggalLahir)) : '-';
  const bantuanArr = p.bantuan ? JSON.parse(p.bantuan) : [];
  const bantuanStr = bantuanArr.length > 0 ? bantuanArr.join(', ') : 'Tidak ada';

  const msg = `*📋 DATA PENDUDUK*
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

  await sendWaMessage(phone, msg);
}

async function handleCariNama(phone: string, nama: string) {
  if (nama.length < 3) {
    await sendWaMessage(phone, `❌ Nama terlalu pendek, minimal 3 karakter.\n\nContoh: #CARI HERMAN`);
    return;
  }

  const results = await db.$queryRawUnsafe(
    `SELECT * FROM "Penduduk" WHERE "namaLengkap" ILIKE $1 ORDER BY "namaLengkap" ASC LIMIT 10`,
    `%${nama}%`
  ) as any[];

  if (!results || results.length === 0) {
    await sendWaMessage(phone, `❌ Penduduk dengan nama "*${nama}*" tidak ditemukan.`);
    return;
  }

  let msg = `*🔍 HASIL PENCARIAN: "${nama}"*\nDitemukan ${results.length} data:\n\n`;
  results.forEach((p, i) => {
    const jk = p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P';
    msg += `${i + 1}. *${p.namaLengkap}*\n   NIK: ${p.nik} | ${jk} | ${p.statusKeluarga}\n   RT ${p.rt}/${p.rw}\n\n`;
  });

  if (results.length >= 10) {
    msg += `_Menampilkan maksimal 10 hasil. Gunakan nama yang lebih spesifik._`;
  }

  msg += `\n_Ketik #NIK <nik> untuk detail lengkap_`;

  await sendWaMessage(phone, msg);
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
             COALESCE(SUM(CASE WHEN "jenis" = 'PENGELUARAN" THEN "jumlah" ELSE 0 END), 0)) as saldo
     FROM "KasRT"`
  ) as any[];

  // Usia
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

  const msg = `*📊 STATISTIK RT.001 RW.002*
━━━━━━━━━━━━━━━━━
*👥 Penduduk Tetap:* ${total[0]?.count || 0} orang
   👨 Laki-laki: ${laki[0]?.count || 0}
   👩 Perempuan: ${perempuan[0]?.count || 0}
   👨‍👩‍👧‍👦 Jumlah KK: ${kk[0]?.count || 0}

*👥 Penduduk Sementara:* ${sementara[0]?.count || 0} orang

*📅 Usia Penduduk:*
   👶 Anak (<17): ${u.anak}
   💪 Produktif (17-59): ${u.produktif}
   🧓 Lansia (60+): ${u.lansia}

*📝 Kejadian:* ${kejadian[0]?.count || 0}

*💰 Kas RT:*
   📈 Pemasukan: Rp ${formatRp(kas.masuk)}
   📉 Pengeluaran: Rp ${formatRp(kas.keluar)}
   💵 Saldo: Rp ${formatRp(kas.saldo)}

━━━━━━━━━━━━━━━━━
_Data per ${formatTanggal(new Date())}_`;

  await sendWaMessage(phone, msg);
}

async function handleKasRT(phone: string, bulanParam?: string) {
  const now = new Date();
  let bulan = bulanParam ? parseInt(bulanParam) : now.getMonth() + 1;
  let tahun = now.getFullYear();

  // Cek apakah bulanParam berisi format bulan-tahun (contoh: 3-2026 atau 03-2026)
  if (bulanParam && bulanParam.includes('-')) {
    const parts = bulanParam.split('-');
    bulan = parseInt(parts[0]);
    tahun = parseInt(parts[1]);
  }

  if (bulan < 1 || bulan > 12) {
    await sendWaMessage(phone, `❌ Bulan tidak valid (1-12).\n\nContoh:\n#KAS\n#KAS 4\n#KAS 4-2026`);
    return;
  }

  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const data = await db.$queryRawUnsafe(
    `SELECT * FROM "KasRT" WHERE "tanggal" >= $1 AND "tanggal" <= $2 ORDER BY "tanggal" ASC`,
    new Date(tahun, bulan - 1, 1),
    new Date(tahun, bulan, 0, 23, 59, 59)
  ) as any[];

  if (!data || data.length === 0) {
    await sendWaMessage(phone, `📭 Tidak ada data kas RT untuk bulan ${namaBulan[bulan - 1]} ${tahun}.`);
    return;
  }

  let totalMasuk = 0;
  let totalKeluar = 0;
  let msg = `*💰 KAS RT - ${namaBulan[bulan - 1]} ${tahun}*\n━━━━━━━━━━━━━━━━━\n\n`;

  data.forEach((d, i) => {
    const tgl = formatTanggal(new Date(d.tanggal));
    const rp = new Intl.NumberFormat('id-ID').format(d.jumlah);
    if (d.jenis === 'PEMASUKAN') {
      totalMasuk += d.jumlah;
      msg += `📈 *+Rp ${rp}*\n   ${tgl} | ${d.keterangan || '-'}\n\n`;
    } else {
      totalKeluar += d.jumlah;
      msg += `📉 *-Rp ${rp}*\n   ${tgl} | ${d.keterangan || '-'}\n\n`;
    }
  });

  const saldo = totalMasuk - totalKeluar;
  const fmtRp = (n: number) => new Intl.NumberFormat('id-ID').format(n);

  msg += `━━━━━━━━━━━━━━━━━
📈 *Total Pemasukan:* Rp ${fmtRp(totalMasuk)}
📉 *Total Pengeluaran:* Rp ${fmtRp(totalKeluar)}
💵 *Saldo:* Rp ${fmtRp(saldo)}
━━━━━━━━━━━━━━━━━`;

  await sendWaMessage(phone, msg);
}

async function handleSementara(phone: string, nik: string) {
  if (!/^\d{16}$/.test(nik)) {
    await sendWaMessage(phone, `❌ NIK harus 16 digit angka.\n\nContoh: #SEMENTARA 3201010101010001`);
    return;
  }

  const result = await db.$queryRawUnsafe(
    `SELECT * FROM "PendudukSementara" WHERE "nik" = $1 LIMIT 1`, nik
  ) as any[];

  if (!result || result.length === 0) {
    await sendWaMessage(phone, `❌ Data penduduk sementara dengan NIK *${nik}* tidak ditemukan.`);
    return;
  }

  const p = result[0];
  const tanggalLahir = p.tanggalLahir ? formatTanggal(new Date(p.tanggalLahir)) : '-';
  const tanggalMasuk = p.tanggalMasuk ? formatTanggal(new Date(p.tanggalMasuk)) : '-';
  const tanggalKeluar = p.tanggalKeluar ? formatTanggal(new Date(p.tanggalKeluar)) : 'Masih tinggal';

  const msg = `*📋 DATA PENDUDUK SEMENTARA*
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

  await sendWaMessage(phone, msg);
}

async function handleBantuan(phone: string) {
  const totalBantuan = await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM "Penduduk" WHERE "bantuan" != '[]' AND "bantuan" IS NOT NULL`
  ) as any[];

  // Hitung per jenis bantuan
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

  let msg = `*🛡️ DATA BANTUAN SOSIAL*
━━━━━━━━━━━━━━━━━
*Total Penerima Bantuan:* ${totalBantuan[0]?.count || 0} penduduk\n\n`;

  if (Object.keys(bantuanCount).length > 0) {
    msg += `*Rincian per Jenis Bantuan:*\n`;
    Object.entries(bantuanCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([nama, count]) => {
        msg += `  • ${nama}: ${count} orang\n`;
      });
  } else {
    msg += `_Belum ada data bantuan tercatat._`;
  }

  msg += `\n━━━━━━━━━━━━━━━━━`;
  await sendWaMessage(phone, msg);
}

async function handleHelp(phone: string) {
  const msg = `*🤖 BOT WA SIKEPENDUDUKAN*
RT.001 RW.002

*📋 DAFTAR PERINTAH:*

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

  await sendWaMessage(phone, msg);
}

// ============ MAIN WEBHOOK HANDLER ============

async function processCommand(phone: string, message: string) {
  const text = message.trim().toUpperCase();

  console.log(`Processing WA command from ${phone}: "${text}"`);

  try {
    if (text.startsWith('#NIK ')) {
      const nik = text.replace('#NIK ', '').trim();
      await handleCekNik(phone, nik);
    } else if (text.startsWith('#CARI ')) {
      const nama = message.trim().substring(6).trim(); // Keep original case for search
      await handleCariNama(phone, nama);
    } else if (text === '#STATISTIK') {
      await handleStatistik(phone);
    } else if (text.startsWith('#KAS')) {
      const param = text.replace('#KAS', '').trim();
      await handleKasRT(phone, param || undefined);
    } else if (text.startsWith('#SEMENTARA ')) {
      const nik = text.replace('#SEMENTARA ', '').trim();
      await handleSementara(phone, nik);
    } else if (text === '#BANTUAN') {
      await handleBantuan(phone);
    } else if (text === '#HELP' || text === 'MENU' || text === '#MENU') {
      await handleHelp(phone);
    } else {
      // Unknown command - send help
      await sendWaMessage(phone, 
        `⚠️ Perintah tidak dikenali.\n\nKetik *#HELP* untuk melihat daftar perintah yang tersedia.`
      );
    }
  } catch (error) {
    console.error('processCommand error:', error);
    await sendWaMessage(phone, `❌ Terjadi kesalahan saat memproses permintaan. Silakan coba lagi.`);
  }
}

// ============ WEBHOOK ENDPOINT ============

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('Received Fonnte webhook:', JSON.stringify(body));

    // Handle both Fonnte v1 and v2 webhook formats
    let phone = '';
    let message = '';
    let senderName = '';

    // Fonnte webhook format
    if (body.phone) {
      phone = body.phone;
      message = body.message || body.text || body.body || '';
      senderName = body.name || body.pushName || '';
    }
    // Alternative format
    else if (body.senderData) {
      phone = body.senderData?.phone || body.senderData?.number || '';
      message = body.message || body.text || '';
      senderName = body.senderData?.pushName || body.senderData?.name || '';
    }
    // Webhook callback format
    else if (body.data) {
      phone = body.data.phone || '';
      message = body.data.message || body.data.text || '';
      senderName = body.data.name || '';
    }

    if (!phone || !message) {
      console.log('No phone or message in webhook, skipping.');
      return NextResponse.json({ status: 'ignored', reason: 'no phone or message' });
    }

    // Clean phone number (remove @s.whatsapp.net, +62, etc.)
    phone = phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    if (phone.startsWith('62')) phone = phone; // already correct
    else if (phone.length <= 12) phone = '62' + phone;

    console.log(`WA message from ${senderName} (${phone}): "${message}"`);

    // MUST await the command processing on Vercel serverless!
    // Fire-and-forget doesn't work because Vercel freezes the execution
    // context once the response is sent.
    await processCommand(phone, message);

    return NextResponse.json({ status: 'received', processed: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// GET - for webhook verification / testing
export async function GET() {
  return NextResponse.json({
    service: 'Sikependudukan WA Bot',
    status: 'active',
    commands: ['#NIK', '#CARI', '#STATISTIK', '#KAS', '#SEMENTARA', '#BANTUAN', '#HELP'],
  });
}
