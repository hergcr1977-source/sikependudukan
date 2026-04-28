import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { toUpperCase, validateNIK, validateNoKK } from '@/lib/utils-kependudukan';
import { requireAdmin, requireAuth, isAuthError } from '@/lib/auth-server';
import { ensureRtIdColumns } from '@/lib/db-migrate';


export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await ensureRtIdColumns();

    const auth = await requireAuth();
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    if (auth.rtId) where.rtId = auth.rtId;
    if (status) where.statusKeterangan = status;
    if (search) {
      where.OR = [
        { namaLengkap: { contains: search } },
        { alamatAsal: { contains: search } },
        { noKK: { contains: search } },
        { nik: { contains: search } },
      ];
    }

    const data = await db.pendudukSementara.findMany({
      where,
      orderBy: { noKK: 'asc' },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengambil data penduduk sementara' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;
    const body = await request.json();
    const {
      noKK, nik, namaLengkap, jenisKelamin, statusKeluarga,
      tempatLahir, tanggalLahir, agama, pendidikan, pekerjaan,
      statusPerkawinan, kewarganegaraan, namaAyah, namaIbu,
      namaPanggilan, noHP, statusKeterangan, alamatAsal,
      bantuan, bpjs, alamat, rt, rw, kelurahan, kecamatan, kabupaten, provinsi,
      tanggalMasuk, tanggalKeluar, keterangan,
    } = body;

    // Validasi NIK dan NoKK
    if (nik && !validateNIK(nik)) {
      return NextResponse.json({ error: 'NIK harus 16 digit angka' }, { status: 400 });
    }
    if (noKK && !validateNoKK(noKK)) {
      return NextResponse.json({ error: 'No. KK harus 16 digit angka' }, { status: 400 });
    }

    // Check NIK uniqueness
    if (nik) {
      const existing = await db.pendudukSementara.findFirst({ where: { nik } });
      if (existing) {
        return NextResponse.json({ error: `NIK ${nik} sudah terdaftar` }, { status: 400 });
      }
    }

    const data = await db.pendudukSementara.create({
      data: {
        rtId: auth.rtId || 1,
        noKK: toUpperCase(noKK || ''),
        nik: toUpperCase(nik || ''),
        namaLengkap: toUpperCase(namaLengkap),
        jenisKelamin: toUpperCase(jenisKelamin),
        statusKeluarga: toUpperCase(statusKeluarga),
        tempatLahir: toUpperCase(tempatLahir),
        tanggalLahir: new Date(tanggalLahir),
        agama: toUpperCase(agama),
        pendidikan: toUpperCase(pendidikan),
        pekerjaan: toUpperCase(pekerjaan),
        statusPerkawinan: toUpperCase(statusPerkawinan),
        kewarganegaraan: toUpperCase(kewarganegaraan || 'WNI'),
        namaAyah: toUpperCase(namaAyah),
        namaIbu: toUpperCase(namaIbu),
        namaPanggilan: namaPanggilan ? toUpperCase(namaPanggilan) : null,
        noHP: noHP || null,
        statusKeterangan: toUpperCase(statusKeterangan),
        alamatAsal: toUpperCase(alamatAsal),
        bantuan: bantuan ? JSON.stringify(bantuan) : '[]',
        bpjs: bpjs ? bpjs.toUpperCase() : null,
        alamat: toUpperCase(alamat || auth.rtInfo?.alamat || 'KP. CEMPLANG'),
        rt: (rt || auth.rtInfo?.namaRT || '001').padStart(3, '0'),
        rw: (rw || auth.rtInfo?.rw || '002').padStart(3, '0'),
        kelurahan: toUpperCase(kelurahan || auth.rtInfo?.kelurahan || 'SUKAMAJU'),
        kecamatan: toUpperCase(kecamatan || auth.rtInfo?.kecamatan || 'CIBUNGBULANG'),
        kabupaten: toUpperCase(kabupaten || auth.rtInfo?.kabupaten || 'BOGOR'),
        provinsi: toUpperCase(provinsi || auth.rtInfo?.provinsi || 'JAWA BARAT'),
        tanggalMasuk: new Date(tanggalMasuk),
        tanggalKeluar: tanggalKeluar ? new Date(tanggalKeluar) : null,
        keterangan: keterangan || null,
      },
    });

    revalidatePath('/api/penduduk-sementara');
    revalidatePath('/api/statistik');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal menambah penduduk sementara' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
    }

    // Verify ownership
    const existing = await db.pendudukSementara.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }
    if (auth.rtId && existing.rtId !== auth.rtId) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    // Validasi NIK dan NoKK saat update
    if (data.nik && !validateNIK(data.nik)) {
      return NextResponse.json({ error: 'NIK harus 16 digit angka' }, { status: 400 });
    }
    if (data.noKK && !validateNoKK(data.noKK)) {
      return NextResponse.json({ error: 'No. KK harus 16 digit angka' }, { status: 400 });
    }

    // Check NIK uniqueness (if NIK changed)
    if (data.nik) {
      const existing = await db.pendudukSementara.findFirst({
        where: { nik: data.nik, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json({ error: `NIK ${data.nik} sudah terdaftar` }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.noKK !== undefined) updateData.noKK = toUpperCase(data.noKK);
    if (data.nik !== undefined) updateData.nik = toUpperCase(data.nik);
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
    if (data.statusKeterangan !== undefined) updateData.statusKeterangan = toUpperCase(data.statusKeterangan);
    if (data.alamatAsal !== undefined) updateData.alamatAsal = toUpperCase(data.alamatAsal);
    if (data.tanggalMasuk !== undefined) updateData.tanggalMasuk = new Date(data.tanggalMasuk);
    if (data.tanggalKeluar !== undefined) updateData.tanggalKeluar = data.tanggalKeluar ? new Date(data.tanggalKeluar) : null;
    if (data.keterangan !== undefined) updateData.keterangan = data.keterangan || null;
    if (data.bantuan !== undefined) updateData.bantuan = JSON.stringify(data.bantuan);
    if (data.bpjs !== undefined) updateData.bpjs = data.bpjs ? data.bpjs.toUpperCase() : null;
    if (data.alamat !== undefined) updateData.alamat = toUpperCase(data.alamat || 'KP. CEMPLANG');
    if (data.rt !== undefined) updateData.rt = (data.rt || '001').padStart(3, '0');
    if (data.rw !== undefined) updateData.rw = (data.rw || '002').padStart(3, '0');
    if (data.kelurahan !== undefined) updateData.kelurahan = toUpperCase(data.kelurahan || 'SUKAMAJU');
    if (data.kecamatan !== undefined) updateData.kecamatan = toUpperCase(data.kecamatan || 'CIBUNGBULANG');
    if (data.kabupaten !== undefined) updateData.kabupaten = toUpperCase(data.kabupaten || 'BOGOR');
    if (data.provinsi !== undefined) updateData.provinsi = toUpperCase(data.provinsi || 'JAWA BARAT');

    revalidatePath('/api/penduduk-sementara');
    revalidatePath('/api/statistik');
    const result = await db.pendudukSementara.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengupdate penduduk sementara' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');

    if (!id) {
      return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
    }

    const existing = await db.pendudukSementara.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }
    if (auth.rtId && existing.rtId !== auth.rtId) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    await db.pendudukSementara.delete({ where: { id } });
    revalidatePath('/api/penduduk-sementara');
    revalidatePath('/api/statistik');
    return NextResponse.json({ message: 'Data berhasil dihapus' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal menghapus data' }, { status: 500 });
  }
}
