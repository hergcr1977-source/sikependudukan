/**
 * Evolution API WhatsApp Bot Integration
 *
 * FILE INI TERPISAH DARI FONNTE - TIDAK MEMPENGARUHI BOT FONNTE
 * Jika tidak digunakan, hapus folder: evolution-api/ + file ini
 *
 * Commands: #HELP, #NIK, #KK, #BANTUAN, #BANTUAN <nik>, #KAS
 * Support: Chat pribadi & Grup
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const EVO_API_URL = process.env.EVOLUTION_API_URL || '';
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'sikependudukan';

// ===== LOG =====
const evoLogs: Array<{
  time: string;
  event: string;
  from: string;
  message: string;
  replyStatus: string;
  replyDetail: string;
}> = [];
const MAX_LOGS = 50;

// ===== HELPERS =====

function formatTanggal(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

function formatRp(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}

// Kirim pesan via Evolution API
async function sendEvo(target: string, message: string): Promise<{ ok: boolean; detail: string }> {
  try {
    if (!EVO_API_URL || !EVO_API_KEY || !EVO_INSTANCE) {
      return { ok: false, detail: 'Evolution API not configured (missing env vars)' };
    }

    let number = target;
    if (!number.includes('@')) {
      number = `${number}@s.whatsapp.net`;
    }

    const res = await fetch(`${EVO_API_URL}/chat/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: number,
        text: message,
      }),
    });

    const data = await res.json();
    console.log('[EVO] Send response:', JSON.stringify(data).substring(0, 300));

    if (res.ok) {
      return { ok: true, detail: JSON.stringify(data) };
    }
    return { ok: false, detail: `Evolution error: ${JSON.stringify(data)}` };
  } catch (error: any) {
    console.error('[EVO] sendEvo error:', error);
    return { ok: false, detail: `Exception: ${error.message}` };
  }
}

// ===== COMMAND HANDLERS =====

async function handleHelp(target: string) {
  const msg = `*BOT WA SIKEPENDUDUKAN*
RT.001 RW.002

*DAFTAR PERINTAH:*

1. *#HELP*
   Tampilkan menu ini

2. *#NIK <nik>*
   Cek data penduduk (tetap & sementara)
   Contoh: #NIK 3201010101010001

3. *#KK <no_kk>*
   Data semua anggota keluarga
   Contoh: #KK 3201010101010001

4. *#BANTUAN*
   Data desil, jenis bantuan, dan BPJS
   (gabungan penduduk tetap & sementara)

5. *#BANTUAN <nik>*
   Cek bantuan, BPJS, dan desil per NIK
   Contoh: #BANTUAN 3201010101010001

6. *#KAS*
   Info kas RT

_Bot ini bekerja di chat pribadi & grup_
_Data mencakup Penduduk Tetap & Sementara_
_Powered by Sistem Kependudukan RT.001 RW.002_`;

  return await sendEvo(target, msg);
}

async function handleCekNik(target: string, nik: string) {
  if (!/^\d{16}$/.test(nik)) {
    return await sendEvo(target, `NIK harus 16 digit angka.\n\nContoh: #NIK 3201010101010001`);
  }

  const penduduk = await db.$queryRawUnsafe(
    `SELECT *, 'PENDUDUK' as _sumber FROM "Penduduk" WHERE "nik" = $1 LIMIT 1`, nik
  ) as any[];

  let p: any = null;
  let isSementara = false;

  if (penduduk && penduduk.length > 0) {
    p = penduduk[0];
  } else {
    const sem = await db.$queryRawUnsafe(
      `SELECT *, 'SEMENTARA' as _sumber FROM "PendudukSementara" WHERE "nik" = $1 LIMIT 1`, nik
    ) as any[];
    if (sem && sem.length > 0) {
      p = sem[0];
      isSementara = true;
    }
  }

  if (!p) {
    return await sendEvo(target, `Data penduduk dengan NIK *${nik}* tidak ditemukan.\n\nData dicari di Penduduk & Penduduk Sementara.`);
  }

  const tanggalLahir = p.tanggalLahir ? formatTanggal(new Date(p.tanggalLahir)) : '-';
  const bantuanArr = p.bantuan ? JSON.parse(p.bantuan) : [];
  const bantuanStr = bantuanArr.length > 0 ? bantuanArr.join(', ') : 'Tidak ada';
  const umur = p.tanggalLahir ? Math.floor((Date.now() - new Date(p.tanggalLahir).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
  const jk = p.jenisKelamin === 'LAKI-LAKI' ? 'Laki-laki' : p.jenisKelamin === 'PEREMPUAN' ? 'Perempuan' : '-';

  let msg = '';
  if (isSementara) {
    const tglMasuk = p.tanggalMasuk ? formatTanggal(new Date(p.tanggalMasuk)) : '-';
    const tglKeluar = p.tanggalKeluar ? formatTanggal(new Date(p.tanggalKeluar)) : 'Masih tinggal';
    msg = `*DATA PENDUDUK SEMENTARA*
━━━━━━━━━━━━━━━━━
*Nama:* ${p.namaLengkap || '-'}
*NIK:* ${p.nik}
*No. KK:* ${p.noKK}
*Jenis Kelamin:* ${jk}
*Status Keluarga:* ${p.statusKeluarga || '-'}
*Tempat/Tgl Lahir:* ${p.tempatLahir || '-'}, ${tanggalLahir}
*Umur:* ${umur !== null ? `${umur} tahun` : '-'}
*Agama:* ${p.agama || '-'}
*Pendidikan:* ${p.pendidikan || '-'}
*Pekerjaan:* ${p.pekerjaan || '-'}
*Status Kawin:* ${p.statusPerkawinan || '-'}
*Kewarganegaraan:* ${p.kewarganegaraan || '-'}
*No. HP:* ${p.noHP || '-'}
*BPJS:* ${p.bpjs || '-'}
*Bantuan:* ${bantuanStr}
*Status Keterangan:* ${p.statusKeterangan || '-'}
*Alamat Asal:* ${p.alamatAsal || '-'}
*Tanggal Masuk:* ${tglMasuk}
*Tanggal Keluar:* ${tglKeluar}
*Alamat Saat Ini:* ${p.alamat || '-'}, RT ${p.rt || '-'}/RW ${p.rw || '-'}
*Keterangan:* ${p.keterangan || '-'}
━━━━━━━━━━━━━━━━━
_Data dari Sistem Kependudukan RT.001 RW.002_`;
  } else {
    msg = `*DATA PENDUDUK*
━━━━━━━━━━━━━━━━━
*Nama:* ${p.namaLengkap || '-'}
*NIK:* ${p.nik}
*No. KK:* ${p.noKK}
*Jenis Kelamin:* ${jk}
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
  }

  return await sendEvo(target, msg);
}

async function handleCekKK(target: string, noKK: string) {
  const kk = noKK.replace(/[^0-9]/g, '');
  if (kk.length < 15) {
    return await sendEvo(target, `No. KK minimal 15 digit angka.\n\nContoh: #KK 3201010101010001`);
  }

  const penduduk = await db.$queryRawUnsafe(
    `SELECT *, 'PENDUDUK' as _sumber FROM "Penduduk" WHERE "noKK" = $1 ORDER BY CASE
      WHEN "statusKeluarga" = 'KEPALA KELUARGA' THEN 1
      WHEN "statusKeluarga" = 'ISTRI' THEN 2
      WHEN "statusKeluarga" = 'ANAK' THEN 3
      ELSE 4
    END ASC`, kk
  ) as any[];

  const sementara = await db.$queryRawUnsafe(
    `SELECT *, 'SEMENTARA' as _sumber FROM "PendudukSementara" WHERE "noKK" = $1 ORDER BY CASE
      WHEN "statusKeluarga" = 'KEPALA KELUARGA' THEN 1
      WHEN "statusKeluarga" = 'ISTRI' THEN 2
      WHEN "statusKeluarga" = 'ANAK' THEN 3
      ELSE 4
    END ASC`, kk
  ) as any[];

  const totalAnggota = penduduk.length + sementara.length;

  if (totalAnggota === 0) {
    return await sendEvo(target, `Data penduduk dengan No. KK *${kk}* tidak ditemukan.`);
  }

  const alamatRef = penduduk.length > 0 ? penduduk[0] : sementara[0];

  let msg = `*DATA KEPERLUARGAAN*
━━━━━━━━━━━━━━━━━
*No. KK:* ${kk}
*Jumlah Anggota:* ${totalAnggota} orang`;
  if (sementara.length > 0) {
    msg += ` (Tetap: ${penduduk.length}, Sementara: ${sementara.length})`;
  }
  msg += `\n*Alamat:* ${alamatRef.alamat || '-'}, RT ${alamatRef.rt || '-'}/RW ${alamatRef.rw || '-'}
*Kelurahan:* ${alamatRef.kelurahan || '-'}, ${alamatRef.kecamatan || '-'}`;
  msg += `\n\n━━━━━━━━━━━━━━━━━\n`;

  let no = 1;

  if (penduduk.length > 0) {
    msg += `*PENDUDUK TETAP:*\n`;
    penduduk.forEach((p: any) => {
      const tglLahir = p.tanggalLahir ? formatTanggal(new Date(p.tanggalLahir)) : '-';
      const umur = p.tanggalLahir ? Math.floor((Date.now() - new Date(p.tanggalLahir).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
      const jk = p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P';
      const bantuanArr = p.bantuan ? JSON.parse(p.bantuan) : [];
      const bantuanStr = bantuanArr.length > 0 ? bantuanArr.join(', ') : '-';

      msg += `${no}. *${p.namaLengkap}*
   NIK: ${p.nik}
   ${jk} | ${p.statusKeluarga || '-'} | ${umur !== null ? `${umur} thn` : '-'}
   TTL: ${p.tempatLahir || '-'}, ${tglLahir}
   Pendidikan: ${p.pendidikan || '-'}
   Pekerjaan: ${p.pekerjaan || '-'}
   KTP: ${p.punyaKTP || '-'} | BPJS: ${p.bpjs || '-'}
   Desil: ${p.desil || '-'} | Bantuan: ${bantuanStr}
   No. HP: ${p.noHP || '-'}\n\n`;
      no++;
    });
  }

  if (sementara.length > 0) {
    msg += `*PENDUDUK SEMENTARA:*\n`;
    sementara.forEach((p: any) => {
      const tglLahir = p.tanggalLahir ? formatTanggal(new Date(p.tanggalLahir)) : '-';
      const umur = p.tanggalLahir ? Math.floor((Date.now() - new Date(p.tanggalLahir).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
      const jk = p.jenisKelamin === 'LAKI-LAKI' ? 'L' : 'P';
      const bantuanArr = p.bantuan ? JSON.parse(p.bantuan) : [];
      const bantuanStr = bantuanArr.length > 0 ? bantuanArr.join(', ') : '-';
      const tglMasuk = p.tanggalMasuk ? formatTanggal(new Date(p.tanggalMasuk)) : '-';
      const tglKeluar = p.tanggalKeluar ? formatTanggal(new Date(p.tanggalKeluar)) : 'Masih tinggal';

      msg += `${no}. *${p.namaLengkap}* [SEMENTARA]
   NIK: ${p.nik}
   ${jk} | ${p.statusKeluarga || '-'} | ${umur !== null ? `${umur} thn` : '-'}
   TTL: ${p.tempatLahir || '-'}, ${tglLahir}
   Pendidikan: ${p.pendidikan || '-'}
   Pekerjaan: ${p.pekerjaan || '-'}
   BPJS: ${p.bpjs || '-'} | Bantuan: ${bantuanStr}
   Status: ${p.statusKeterangan || '-'}
   Alamat Asal: ${p.alamatAsal || '-'}
   Masuk: ${tglMasuk} | Keluar: ${tglKeluar}
   No. HP: ${p.noHP || '-'}\n\n`;
      no++;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━
_Data dari Sistem Kependudukan RT.001 RW.002_`;

  return await sendEvo(target, msg);
}

async function handleBantuan(target: string) {
  const desilData = await db.$queryRawUnsafe(
    `SELECT "desil", COUNT(*)::int as count FROM "Penduduk" WHERE "desil" IS NOT NULL AND "desil" != '' GROUP BY "desil" ORDER BY "desil" ASC`
  ) as any[];

  const bantuanRowsPenduduk = await db.$queryRawUnsafe(
    `SELECT "bantuan" FROM "Penduduk" WHERE "bantuan" != '[]' AND "bantuan" IS NOT NULL AND "bantuan" != ''`
  ) as any[];
  const bantuanRowsSementara = await db.$queryRawUnsafe(
    `SELECT "bantuan" FROM "PendudukSementara" WHERE "bantuan" != '[]' AND "bantuan" IS NOT NULL AND "bantuan" != ''`
  ) as any[];
  const bantuanRows = [...bantuanRowsPenduduk, ...bantuanRowsSementara];

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

  const bpjsDataPenduduk = await db.$queryRawUnsafe(
    `SELECT "bpjs", COUNT(*)::int as count FROM "Penduduk" WHERE "bpjs" IS NOT NULL AND "bpjs" != '' GROUP BY "bpjs"`
  ) as any[];
  const bpjsDataSementara = await db.$queryRawUnsafe(
    `SELECT "bpjs", COUNT(*)::int as count FROM "PendudukSementara" WHERE "bpjs" IS NOT NULL AND "bpjs" != '' GROUP BY "bpjs"`
  ) as any[];

  const bpjsMerged: Record<string, number> = {};
  [...bpjsDataPenduduk, ...bpjsDataSementara].forEach((b: any) => {
    bpjsMerged[b.bpjs] = (bpjsMerged[b.bpjs] || 0) + b.count;
  });
  const bpjsData = Object.entries(bpjsMerged).map(([bpjs, count]) => ({ bpjs, count })).sort((a, b) => b.count - a.count);

  const totalPenduduk = await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "Penduduk"`) as any[];
  const totalSementara = await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "PendudukSementara"`) as any[];
  const totalTetap = totalPenduduk[0]?.count || 0;
  const totalSem = totalSementara[0]?.count || 0;
  const total = totalTetap + totalSem;

  let msg = `*DATA BANTUAN SOSIAL & BPJS*
━━━━━━━━━━━━━━━━━
*Penduduk Tetap:* ${totalTetap} orang
*Penduduk Sementara:* ${totalSem} orang
*Total Penduduk:* ${total} orang
*Penerima Bantuan:* ${totalPenerima} orang (${total > 0 ? Math.round(totalPenerima / total * 100) : 0}%)\n`;

  msg += `\n*DESKRIPSI KEMISKINAN (DESLIL):*
  _(Khusus Penduduk Tetap)_\n`;
  if (desilData.length > 0) {
    desilData.forEach((d: any) => { msg += `  ${d.desil}: ${d.count} orang\n`; });
  } else {
    msg += `  _Belum ada data desil_\n`;
  }

  msg += `\n*JENIS BANTUAN YANG DITERIMA:*\n  _(Tetap + Sementara)_\n`;
  if (Object.keys(bantuanCount).length > 0) {
    Object.entries(bantuanCount).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).forEach(([nama, count]) => {
      msg += `  - ${nama}: ${count} orang\n`;
    });
  } else {
    msg += `  _Belum ada data bantuan_\n`;
  }

  msg += `\n*KEPEMILIKAN BPJS:*\n  _(Tetap + Sementara)_\n`;
  if (bpjsData.length > 0) {
    bpjsData.forEach((b: any) => { msg += `  - ${b.bpjs}: ${b.count} orang\n`; });
  } else {
    msg += `  _Belum ada data BPJS_\n`;
  }

  msg += `\n━━━━━━━━━━━━━━━━━
_Data dari Sistem Kependudukan RT.001 RW.002_`;

  return await sendEvo(target, msg);
}

async function handleBantuanNik(target: string, nik: string) {
  if (!/^\d{16}$/.test(nik)) {
    return await sendEvo(target, `NIK harus 16 digit angka.\n\nContoh: #BANTUAN 3201010101010001`);
  }

  const penduduk = await db.$queryRawUnsafe(
    `SELECT *, 'PENDUDUK' as _sumber FROM "Penduduk" WHERE "nik" = $1 LIMIT 1`, nik
  ) as any[];

  let p: any = null;
  let isSementara = false;

  if (penduduk && penduduk.length > 0) {
    p = penduduk[0];
  } else {
    const sem = await db.$queryRawUnsafe(
      `SELECT *, 'SEMENTARA' as _sumber FROM "PendudukSementara" WHERE "nik" = $1 LIMIT 1`, nik
    ) as any[];
    if (sem && sem.length > 0) { p = sem[0]; isSementara = true; }
  }

  if (!p) {
    return await sendEvo(target, `Data penduduk dengan NIK *${nik}* tidak ditemukan.`);
  }

  const bantuanArr = p.bantuan ? JSON.parse(p.bantuan) : [];
  const bantuanStr = bantuanArr.length > 0 ? bantuanArr.map((b: string) => `- ${b}`).join('\n  ') : '_Tidak menerima bantuan_';
  const bpjsStr = p.bpjs && p.bpjs !== '' ? p.bpjs : '_Tidak memiliki BPJS_';
  const desilStr = isSementara ? '_Data desil khusus Penduduk Tetap_' : (p.desil && p.desil !== '' ? p.desil : '_Tidak ada data desil_');

  const msg = `*DATA BANTUAN SOSIAL & BPJS*
━━━━━━━━━━━━━━━━━
*Nama:* ${p.namaLengkap || '-'}
*NIK:* ${p.nik}
*Status:* ${isSementara ? 'Penduduk Sementara' : 'Penduduk Tetap'}

*DESKRIPSI KEMISKINAN (DESLIL):*
  ${desilStr}

*JENIS BANTUAN YANG DITERIMA:*
  ${bantuanStr}

*KEPEMILIKAN BPJS:*
  ${bpjsStr}

━━━━━━━━━━━━━━━━━
_Data dari Sistem Kependudukan RT.001 RW.002_`;

  return await sendEvo(target, msg);
}

async function handleKasRT(target: string) {
  const allData = await db.$queryRawUnsafe(
    `SELECT * FROM "KasRT" ORDER BY "tanggal" ASC`
  ) as any[];

  if (!allData || allData.length === 0) {
    return await sendEvo(target, `Belum ada data kas RT.`);
  }

  let totalMasuk = 0;
  let totalKeluar = 0;
  let lastMasuk: any = null;
  let lastKeluar: any = null;

  allData.forEach((d: any) => {
    const jml = Number(d.jumlah) || 0;
    if (d.jenis === 'PEMASUKAN') {
      totalMasuk += jml;
      if (!lastMasuk || new Date(d.tanggal) >= new Date(lastMasuk.tanggal)) {
        lastMasuk = { ...d, jumlah: jml };
      }
    } else {
      totalKeluar += jml;
      if (!lastKeluar || new Date(d.tanggal) >= new Date(lastKeluar.tanggal)) {
        lastKeluar = { ...d, jumlah: jml };
      }
    }
  });

  const saldoAkhir = totalMasuk - totalKeluar;
  const saldoAwal = lastMasuk ? saldoAkhir - lastMasuk.jumlah : 0;

  let msg = `*KAS RT - RINGKASAN*
━━━━━━━━━━━━━━━━━
*Saldo Awal:* Rp ${formatRp(saldoAwal)}
*- Total Pengeluaran:* Rp ${formatRp(totalKeluar)}
*= Saldo Akhir:* Rp ${formatRp(saldoAkhir)}\n`;

  if (lastMasuk) {
    msg += `\n*PEMASUKAN TERAKHIR:*
  Rp ${formatRp(lastMasuk.jumlah)}
  ${formatTanggal(new Date(lastMasuk.tanggal))}
  ${lastMasuk.keterangan || '-'}\n`;
  } else {
    msg += `\n*PEMASUKAN TERAKHIR:*
  _Belum ada_\n`;
  }

  if (lastKeluar) {
    msg += `\n*PENGELUARAN TERAKHIR:*
  Rp ${formatRp(lastKeluar.jumlah)}
  ${formatTanggal(new Date(lastKeluar.tanggal))}
  ${lastKeluar.keterangan || '-'}\n`;
  } else {
    msg += `\n*PENGELUARAN TERAKHIR:*
  _Belum ada_\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━
_Data dari Sistem Kependudukan RT.001 RW.002_`;

  return await sendEvo(target, msg);
}

// ===== COMMAND PROCESSOR =====

async function processCommand(target: string, message: string, senderName: string) {
  const text = message.trim();

  if (!text.startsWith('#')) {
    return { ok: false, detail: 'ignored - not a command' };
  }

  const upper = text.toUpperCase();
  console.log(`[EVO] Processing command from ${senderName} (${target}): "${upper}"`);

  if (upper === '#HELP' || upper === '#MENU') {
    return await handleHelp(target);
  } else if (upper.startsWith('#NIK ')) {
    const nik = upper.replace('#NIK ', '').trim();
    return await handleCekNik(target, nik);
  } else if (upper.startsWith('#KK ')) {
    const noKK = text.substring(4).trim();
    return await handleCekKK(target, noKK);
  } else if (upper.startsWith('#BANTUAN ')) {
    const nik = upper.replace('#BANTUAN ', '').trim();
    return await handleBantuanNik(target, nik);
  } else if (upper === '#BANTUAN') {
    return await handleBantuan(target);
  } else if (upper === '#KAS') {
    return await handleKasRT(target);
  } else {
    return await sendEvo(target,
      `Perintah tidak dikenali.\n\nKetik *#HELP* untuk melihat daftar perintah.`
    );
  }
}

// ===== WEBHOOK ENDPOINTS =====

export async function POST(request: NextRequest) {
  let body: any = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('[EVO] Webhook received:', body.event || 'unknown event');

  evoLogs.unshift({
    time: new Date().toISOString(),
    event: body.event || 'unknown',
    from: body.data?.key?.remoteJid || body.instance || '',
    message: '',
    replyStatus: 'received',
    replyDetail: '',
  });
  if (evoLogs.length > MAX_LOGS) evoLogs.pop();

  // Hanya proses event messages.upsert
  if (body.event !== 'messages.upsert') {
    console.log(`[EVO] Skipping event: ${body.event}`);
    return NextResponse.json({ status: 'ignored', event: body.event });
  }

  const data = body.data;
  if (!data) {
    return NextResponse.json({ status: 'ignored', reason: 'no data' });
  }

  const key = data.key;
  if (!key) {
    return NextResponse.json({ status: 'ignored', reason: 'no key' });
  }

  // Lewati pesan dari bot sendiri
  if (key.fromMe === true) {
    return NextResponse.json({ status: 'ignored', reason: 'fromMe' });
  }

  // Ekstrak pesan teks
  let messageText = '';
  if (data.message?.conversation) {
    messageText = data.message.conversation;
  } else if (data.message?.extendedTextMessage?.text) {
    messageText = data.message.extendedTextMessage.text;
  }

  if (!messageText || !messageText.startsWith('#')) {
    return NextResponse.json({ status: 'ignored', reason: 'not a command' });
  }

  // Target: untuk grup reply ke group JID, untuk pribadi reply ke sender JID
  const target = key.remoteJid;
  const senderName = data.pushName || key.participant || 'Unknown';

  console.log(`[EVO] Message from ${senderName}: "${messageText}" target=${target} isGroup=${target.includes('@g.us')}`);

  const replyResult = await processCommand(target, messageText, senderName);
  console.log(`[EVO] Reply result: ok=${replyResult.ok}`);

  const logEntry = evoLogs.find(l => l.from === target);
  if (logEntry) {
    logEntry.message = messageText;
    logEntry.replyStatus = replyResult.ok ? 'sent' : 'failed';
    logEntry.replyDetail = replyResult.detail;
  }

  return NextResponse.json({
    status: 'ok',
    target,
    command: messageText.substring(0, 50),
    reply: replyResult.ok,
  });
}

// GET - status check & logs
export async function GET() {
  return NextResponse.json({
    service: 'Evolution API WA Bot',
    status: 'active',
    configured: !!(EVO_API_URL && EVO_API_KEY && EVO_INSTANCE),
    api_url: EVO_API_URL || 'NOT SET',
    instance: EVO_INSTANCE || 'NOT SET',
    api_key_set: EVO_API_KEY ? 'YES' : 'NO',
    commands: ['#HELP', '#NIK', '#KK', '#BANTUAN', '#BANTUAN <nik>', '#KAS'],
    note: 'BOT INI TERPISAH DARI FONNTE',
    recent_webhooks: evoLogs.slice(0, 10),
    total_webhooks: evoLogs.length,
  });
}
