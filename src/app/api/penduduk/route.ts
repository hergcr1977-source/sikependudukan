import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toUpperCase, validateNIK, validateNoKK } from '@/lib/utils-kependudukan';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const noKK = searchParams.get('noKK') || '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { namaLengkap: { contains: search } },
        { nik: { contains: search } },
        { noKK: { contains: search } },
      ];
    }
    if (noKK) {
      where.noKK = noKK;
    }

    const penduduk = await db.penduduk.findMany({
      where,
      orderBy: { noKK: 'asc' },
    });

    return NextResponse.json(penduduk);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengambil data penduduk' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      noKK, nik, namaLengkap, jenisKelamin, statusKeluarga,
      tempatLahir, tanggalLahir, agama, pendidikan, pekerjaan,
      statusPerkawinan, kewarganegaraan, namaAyah, namaIbu,
      namaPanggilan, noHP, punyaKTP, bantuan, bpjs, desil, keterangan,
    } = body;

    if (!validateNoKK(noKK)) {
      return NextResponse.json({ error: 'No. KK harus 16 digit angka' }, { status: 400 });
    }
    if (!validateNIK(nik)) {
      return NextResponse.json({ error: 'NIK harus 16 digit angka' }, { status: 400 });
    }

    const existing = await db.penduduk.findFirst({
      where: { OR: [{ nik }, { noKK: noKK, nik: nik }] },
    });
    if (existing && existing.nik === nik) {
      return NextResponse.json({ error: 'NIK sudah terdaftar' }, { status: 400 });
    }

    // Auto-inherit: jika bukan KK head, warisi keterangan dari KK head
    let finalKeterangan = keterangan || null;
    if (toUpperCase(statusKeluarga) !== 'KEPALA KELUARGA' && (!keterangan || keterangan.trim() === '')) {
      const kkHead = await db.penduduk.findFirst({
        where: { noKK, statusKeluarga: 'KEPALA KELUARGA' },
      });
      if (kkHead && kkHead.keterangan) {
        finalKeterangan = kkHead.keterangan;
      }
    }

    const penduduk = await db.penduduk.create({
      data: {
        noKK,
        nik,
        namaLengkap: toUpperCase(namaLengkap),
        jenisKelamin: toUpperCase(jenisKelamin),
        statusKeluarga: toUpperCase(statusKeluarga),
        tempatLahir: toUpperCase(tempatLahir),
        tanggalLahir: new Date(tanggalLahir),
        agama: toUpperCase(agama),
        pendidikan: toUpperCase(pendidikan),
        pekerjaan: toUpperCase(pekerjaan),
        statusPerkawinan: toUpperCase(statusPerkawinan),
        kewarganegaraan: toUpperCase(kewarganegaraan),
        namaAyah: toUpperCase(namaAyah),
        namaIbu: toUpperCase(namaIbu),
        namaPanggilan: namaPanggilan ? toUpperCase(namaPanggilan) : null,
        noHP: noHP || null,
        punyaKTP: punyaKTP || 'BELUM',
        bantuan: bantuan ? JSON.stringify(bantuan) : '[]',
        bpjs: bpjs || null,
        desil: desil || null,
        keterangan: finalKeterangan,
      },
    });

    return NextResponse.json(penduduk, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal menambah data penduduk' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.noKK !== undefined) {
      if (!validateNoKK(data.noKK)) {
        return NextResponse.json({ error: 'No. KK harus 16 digit angka' }, { status: 400 });
      }
      updateData.noKK = data.noKK;
    }
    if (data.nik !== undefined) {
      if (!validateNIK(data.nik)) {
        return NextResponse.json({ error: 'NIK harus 16 digit angka' }, { status: 400 });
      }
      updateData.nik = data.nik;
    }
    if (data.namaLengkap !== undefined) updateData.namaLengkap = toUpperCase(data.namaLengkap);
    if (data.jenisKelamin !== undefined) updateData.jenisKelamin = toUpperCase(data.jenisKelamin);
    if (data.statusKeluarga !== undefined) updateData.statusKeluarga = toUpperCase(data.statusKeluarga);
    if (data.tempatLahir !== undefined) updateData.tempatLahir = toUpperCase(data.tempatLahir);
    if (data.tanggalLahir !== undefined) updateData.tanggalLahir = new Date(data.tanggalLahir);
    if (data.agama !== undefined) updateData.agama = toUpperCase(data.agama);
    if (data.pendidikan !== undefined) updateData.pendidikan = toUpperCase(data.pendidikan);
    if (data.pekerjaan !== undefined) updateData.pekerjaan = toUpperCase(data.pekerjaan);
    if (data.statusPerkawinan !== undefined) updateData.statusPerkawinan = toUpperCase(data.statusPerkawinan);
    if (data.kewarganegaraan !== undefined) updateData.kewarganegaraan = toUpperCase(data.kewarganegaraan);
    if (data.namaAyah !== undefined) updateData.namaAyah = toUpperCase(data.namaAyah);
    if (data.namaIbu !== undefined) updateData.namaIbu = toUpperCase(data.namaIbu);
    if (data.namaPanggilan !== undefined) updateData.namaPanggilan = data.namaPanggilan ? toUpperCase(data.namaPanggilan) : null;
    if (data.noHP !== undefined) updateData.noHP = data.noHP || null;
    if (data.punyaKTP !== undefined) updateData.punyaKTP = data.punyaKTP;
    if (data.bantuan !== undefined) updateData.bantuan = JSON.stringify(data.bantuan);
    if (data.bpjs !== undefined) updateData.bpjs = data.bpjs || null;
    if (data.desil !== undefined) updateData.desil = data.desil || null;
    if (data.keterangan !== undefined) updateData.keterangan = data.keterangan || null;

    const penduduk = await db.penduduk.update({
      where: { id },
      data: updateData,
    });

    // Auto-propagate: jika edit KK head & keterangan berubah, update semua anggota
    const isKKHead = penduduk.statusKeluarga === 'KEPALA KELUARGA';
    if (isKKHead && data.keterangan !== undefined) {
      await db.penduduk.updateMany({
        where: {
          noKK: penduduk.noKK,
          id: { not: penduduk.id },
        },
        data: { keterangan: data.keterangan || null },
      });
    }

    return NextResponse.json(penduduk);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengupdate data penduduk' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const deleteAll = searchParams.get('all');

if (deleteAll === 'true') {
      const countPenduduk = await db.penduduk.count();
      const countSementara = await db.pendudukSementara.count();
      const countKejadian = await db.kejadian.count();
      const countLaporan = await db.laporanBulanan.count();

      await db.penduduk.deleteMany();
      await db.pendudukSementara.deleteMany();
      await db.kejadian.deleteMany();
      await db.laporanBulanan.deleteMany();

      return NextResponse.json({
        message: `Seluruh data berhasil dihapus: ${countPenduduk} penduduk, ${countSementara} penduduk sementara, ${countKejadian} kejadian, ${countLaporan} laporan tersimpan`
      });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
    }

    await db.penduduk.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ message: 'Data berhasil dihapus' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal menghapus data penduduk' }, { status: 500 });
  }
}