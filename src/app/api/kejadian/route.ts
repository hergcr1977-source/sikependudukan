import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { toUpperCase } from '@/lib/utils-kependudukan';
import { requireAdmin, requireAuth, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const jenis = searchParams.get('jenis') || '';
    const bulan = searchParams.get('bulan') || '';
    const tahun = searchParams.get('tahun') || '';

    const where: Record<string, unknown> = {};
    if (auth.rtId) where.rtId = auth.rtId;
    if (jenis) where.jenisKejadian = jenis;
    if (bulan && tahun) {
      const startDate = new Date(parseInt(tahun), parseInt(bulan) - 1, 1);
      const endDate = new Date(parseInt(tahun), parseInt(bulan), 0, 23, 59, 59);
      where.tanggal = { gte: startDate, lte: endDate };
    }

    const data = await db.kejadian.findMany({
      where,
      orderBy: { tanggal: 'desc' },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengambil data kejadian' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;
    const body = await request.json();
    const {
      jenisKejadian, noKK, namaLengkap, nik, jenisKelamin,
      tanggal, keterangan,
      // Field tambahan untuk DATANG/LAHIR (anggota keluarga)
      modeDatang, statusKeluarga, tempatLahir, tanggalLahir, agama,
      pendidikan, pekerjaan, statusPerkawinan, kewarganegaraan,
      namaAyah, namaIbu, namaPanggilan, noHP, punyaKTP, bantuan,
      // Field tambahan untuk MATI/PINDAH (perubahan No KK)
      noKKStatus, noKKBaru,
    } = body;

    const isLahir = toUpperCase(jenisKejadian) === 'LAHIR';
    const isMati = toUpperCase(jenisKejadian) === 'MATI';
    const isPindah = toUpperCase(jenisKejadian) === 'PINDAH';
    const isDatang = toUpperCase(jenisKejadian) === 'DATANG';
    const isModeBaru = toUpperCase(modeDatang) === 'BARU';

    let pendudukAdded = false;
    let pendudukRemoved = false;
    let kkBaru = false;
    let kkDissolved = false;
    let kkHeadChanged = '';
    let kkUpdated = false;

    // ======================== LAHIR: Tambah Penduduk baru (ANAK) ========================
    if (isLahir && noKK && namaLengkap) {
      const tempNik = nik ? String(nik) : `BAYI_${Date.now()}`;

      // Cek NIK jika ada
      if (nik) {
        const existingNik = await db.penduduk.findFirst({ where: { nik: tempNik } });
        if (existingNik) {
          return NextResponse.json(
            { error: `NIK ${nik} sudah terdaftar atas nama ${existingNik.namaLengkap}` },
            { status: 400 }
          );
        }
      }

      await db.penduduk.create({
        data: {
          rtId: auth.rtId || 1,
          noKK: String(noKK),
          nik: tempNik,
          namaLengkap: toUpperCase(namaLengkap),
          jenisKelamin: toUpperCase(jenisKelamin) || 'LAKI-LAKI',
          statusKeluarga: toUpperCase(statusKeluarga) || 'ANAK',
          tempatLahir: toUpperCase(tempatLahir) || '-',
          tanggalLahir: tanggalLahir ? new Date(tanggalLahir) : new Date(tanggal),
          agama: toUpperCase(agama) || 'ISLAM',
          pendidikan: toUpperCase(pendidikan) || 'TIDAK/BELUM SEKOLAH',
          pekerjaan: toUpperCase(pekerjaan) || 'BELUM/TIDAK BEKERJA',
          statusPerkawinan: toUpperCase(statusPerkawinan) || 'BELUM MENIKAH',
          kewarganegaraan: toUpperCase(kewarganegaraan) || 'WNI',
          namaAyah: toUpperCase(namaAyah) || '-',
          namaIbu: toUpperCase(namaIbu) || '-',
          namaPanggilan: toUpperCase(namaPanggilan) || null,
          noHP: noHP || null,
          punyaKTP: 'BELUM',
          bantuan: Array.isArray(bantuan) ? JSON.stringify(bantuan) : '[]',
          keterangan: null,
        },
      });
      pendudukAdded = true;
    }

    // ======================== MATI: Hapus Penduduk ========================
    if (isMati && nik) {
      const target = await db.penduduk.findFirst({ where: { nik: String(nik), ...(auth.rtId ? { rtId: auth.rtId } : {}) } });
      if (!target) {
        return NextResponse.json(
          { error: `Penduduk dengan NIK ${nik} tidak ditemukan` },
          { status: 400 }
        );
      }

      // Jika No KK berubah, update semua anggota KK yang tersisa ke No KK baru (hanya RT sendiri)
      if (toUpperCase(noKKStatus) === 'BERUBAH' && noKKBaru) {
        const remaining = await db.penduduk.findMany({
          where: { noKK: target.noKK, id: { not: target.id }, ...(auth.rtId ? { rtId: auth.rtId } : {}) },
        });
        if (remaining.length > 0) {
          // Validasi No KK Baru tidak sudah ada di database (di RT sendiri)
          const existingNewKK = await db.penduduk.findFirst({
            where: { noKK: String(noKKBaru), ...(auth.rtId ? { rtId: auth.rtId } : {}) },
          });
          if (existingNewKK) {
            return NextResponse.json(
              { error: `No. KK ${noKKBaru} sudah terdaftar atas nama ${existingNewKK.namaLengkap}` },
              { status: 400 }
            );
          }

          // Update No KK semua anggota tersisa
          for (const member of remaining) {
            await db.penduduk.update({
              where: { id: member.id },
              data: { noKK: String(noKKBaru) },
            });
          }
          kkUpdated = true;
        }
      }

      // Jika Kepala Keluarga, cek sisa anggota (setelah update No KK jika ada)
      if (target.statusKeluarga === 'KEPALA KELUARGA') {
        const currentNoKK = toUpperCase(noKKStatus) === 'BERUBAH' && noKKBaru ? String(noKKBaru) : target.noKK;
        const remaining = await db.penduduk.findMany({
          where: { noKK: currentNoKK, id: { not: target.id }, ...(auth.rtId ? { rtId: auth.rtId } : {}) },
        });
        if (remaining.length === 0) {
          kkDissolved = true;
        } else {
          // Promosi anggota pertama menjadi Kepala Keluarga
          await db.penduduk.update({
            where: { id: remaining[0].id },
            data: { statusKeluarga: 'KEPALA KELUARGA' },
          });
          kkHeadChanged = remaining[0].namaLengkap;
        }
      }

      await db.penduduk.delete({ where: { id: target.id } });
      pendudukRemoved = true;
    }

    // ======================== PINDAH: Hapus Penduduk ========================
    if (isPindah && nik) {
      const target = await db.penduduk.findFirst({ where: { nik: String(nik), ...(auth.rtId ? { rtId: auth.rtId } : {}) } });
      if (!target) {
        return NextResponse.json(
          { error: `Penduduk dengan NIK ${nik} tidak ditemukan` },
          { status: 400 }
        );
      }

      // Jika No KK berubah, update semua anggota KK yang tersisa ke No KK baru (hanya RT sendiri)
      if (toUpperCase(noKKStatus) === 'BERUBAH' && noKKBaru) {
        const remaining = await db.penduduk.findMany({
          where: { noKK: target.noKK, id: { not: target.id }, ...(auth.rtId ? { rtId: auth.rtId } : {}) },
        });
        if (remaining.length > 0) {
          // Validasi No KK Baru tidak sudah ada di database (di RT sendiri)
          const existingNewKK = await db.penduduk.findFirst({
            where: { noKK: String(noKKBaru), ...(auth.rtId ? { rtId: auth.rtId } : {}) },
          });
          if (existingNewKK) {
            return NextResponse.json(
              { error: `No. KK ${noKKBaru} sudah terdaftar atas nama ${existingNewKK.namaLengkap}` },
              { status: 400 }
            );
          }

          // Update No KK semua anggota tersisa
          for (const member of remaining) {
            await db.penduduk.update({
              where: { id: member.id },
              data: { noKK: String(noKKBaru) },
            });
          }
          kkUpdated = true;
        }
      }

      // Jika Kepala Keluarga, cek sisa anggota (setelah update No KK jika ada) — PINDAH
      if (target.statusKeluarga === 'KEPALA KELUARGA') {
        const currentNoKK = toUpperCase(noKKStatus) === 'BERUBAH' && noKKBaru ? String(noKKBaru) : target.noKK;
        const remaining = await db.penduduk.findMany({
          where: { noKK: currentNoKK, id: { not: target.id }, ...(auth.rtId ? { rtId: auth.rtId } : {}) },
        });
        if (remaining.length === 0) {
          kkDissolved = true;
        } else {
          // Promosi anggota pertama menjadi Kepala Keluarga
          await db.penduduk.update({
            where: { id: remaining[0].id },
            data: { statusKeluarga: 'KEPALA KELUARGA' },
          });
          kkHeadChanged = remaining[0].namaLengkap;
        }
      }

      await db.penduduk.delete({ where: { id: target.id } });
      pendudukRemoved = true;
    }

    // ======================== DATANG: Tambah Penduduk ========================
    if (isDatang && noKK && tanggalLahir && namaLengkap) {
      if (isModeBaru) {
        const existingKK = await db.penduduk.findFirst({
          where: { noKK: String(noKK) },
        });
        if (existingKK) {
          return NextResponse.json(
            { error: `No. KK ${noKK} sudah terdaftar atas nama ${existingKK.namaLengkap}` },
            { status: 400 }
          );
        }
        kkBaru = true;
      }

      if (nik) {
        const existingNik = await db.penduduk.findFirst({
          where: { nik: String(nik) },
        });
        if (existingNik) {
          return NextResponse.json(
            { error: `NIK ${nik} sudah terdaftar atas nama ${existingNik.namaLengkap}` },
            { status: 400 }
          );
        }
      }

      await db.penduduk.create({
        data: {
          rtId: auth.rtId || 1,
          noKK: String(noKK),
          nik: nik ? String(nik) : `PEND_${Date.now()}`,
          namaLengkap: toUpperCase(namaLengkap),
          jenisKelamin: toUpperCase(jenisKelamin) || 'LAKI-LAKI',
          statusKeluarga: isModeBaru
            ? 'KEPALA KELUARGA'
            : toUpperCase(statusKeluarga) || 'LAINNYA',
          tempatLahir: toUpperCase(tempatLahir) || '-',
          tanggalLahir: new Date(tanggalLahir),
          agama: toUpperCase(agama) || 'ISLAM',
          pendidikan: toUpperCase(pendidikan) || '-',
          pekerjaan: toUpperCase(pekerjaan) || '-',
          statusPerkawinan: toUpperCase(statusPerkawinan) || '-',
          kewarganegaraan: toUpperCase(kewarganegaraan) || 'WNI',
          namaAyah: toUpperCase(namaAyah) || '-',
          namaIbu: toUpperCase(namaIbu) || '-',
          namaPanggilan: toUpperCase(namaPanggilan) || null,
          noHP: noHP || null,
          punyaKTP: toUpperCase(punyaKTP) || 'BELUM',
          bantuan: Array.isArray(bantuan) ? JSON.stringify(bantuan) : '[]',
          keterangan: keterangan ? String(keterangan) : null,
        },
      });
      pendudukAdded = true;
    }

    // Simpan kejadian
    const data = await db.kejadian.create({
      data: {
        rtId: auth.rtId || 1,
        jenisKejadian: toUpperCase(jenisKejadian),
        noKK: noKK || '',
        namaLengkap: toUpperCase(namaLengkap),
        nik: nik || null,
        jenisKelamin: toUpperCase(jenisKelamin),
        tanggal: new Date(tanggal),
        keterangan: keterangan || null,
      },
    });

    revalidatePath('/api/kejadian');
    revalidatePath('/api/penduduk');
    revalidatePath('/api/statistik');
    return NextResponse.json({
      ...data,
      pendudukAdded,
      pendudukRemoved,
      kkBaru,
      kkDissolved,
      kkHeadChanged,
      kkUpdated,
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal menambah kejadian' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;
    const body = await request.json();
    const { id, noKKStatus, noKKBaru, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
    }

    // Ambil data kejadian asli sebelum update (untuk No KK asli)
    const existingKejadian = await db.kejadian.findUnique({ where: { id } });
    if (!existingKejadian) {
      return NextResponse.json({ error: 'Kejadian tidak ditemukan' }, { status: 404 });
    }
    // Verify ownership (superadmin can access all)
    if (auth.rtId && existingKejadian.rtId !== auth.rtId) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    const originalNoKK = existingKejadian.noKK;

    const updateData: Record<string, unknown> = {};
    if (data.jenisKejadian !== undefined) updateData.jenisKejadian = toUpperCase(data.jenisKejadian);
    if (data.noKK !== undefined) updateData.noKK = data.noKK || '';
    if (data.namaLengkap !== undefined) updateData.namaLengkap = toUpperCase(data.namaLengkap);
    if (data.nik !== undefined) updateData.nik = data.nik || null;
    if (data.jenisKelamin !== undefined) updateData.jenisKelamin = toUpperCase(data.jenisKelamin);
    if (data.tanggal !== undefined) updateData.tanggal = new Date(data.tanggal);
    if (data.keterangan !== undefined) updateData.keterangan = data.keterangan || null;

    revalidatePath('/api/kejadian');
    revalidatePath('/api/statistik');
    const result = await db.kejadian.update({
      where: { id },
      data: updateData,
    });

    // Handle No KK change untuk edit MATI/PINDAH
    let kkUpdated = false;
    if (toUpperCase(noKKStatus) === 'BERUBAH' && noKKBaru) {
      const jenis = toUpperCase(existingKejadian.jenisKejadian);
      if (jenis === 'MATI' || jenis === 'PINDAH') {
        // Cari anggota KK yang tersisa berdasarkan No KK asli
        const remaining = await db.penduduk.findMany({
          where: { noKK: originalNoKK },
        });
        if (remaining.length > 0) {
          // Validasi No KK Baru tidak sudah ada di database
          const existingNewKK = await db.penduduk.findFirst({
            where: { noKK: String(noKKBaru) },
          });
          if (existingNewKK) {
            return NextResponse.json(
              { error: `No. KK ${noKKBaru} sudah terdaftar atas nama ${existingNewKK.namaLengkap}` },
              { status: 400 }
            );
          }

          // Update No KK semua anggota tersisa
          for (const member of remaining) {
            await db.penduduk.update({
              where: { id: member.id },
              data: { noKK: String(noKKBaru) },
            });
          }
          kkUpdated = true;
        }
      }
    }

    revalidatePath('/api/penduduk');
    return NextResponse.json({ ...result, kkUpdated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengupdate kejadian' }, { status: 500 });
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

    const existing = await db.kejadian.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Kejadian tidak ditemukan' }, { status: 404 });
    }
    if (auth.rtId && existing.rtId !== auth.rtId) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const jenis = toUpperCase(existing.jenisKejadian);

    // Catatan: penduduk yang dihapus saat kejadian MATI/PINDAH tidak bisa dikembalikan
    // karena data lengkap penduduk (ttl, agama, pendidikan dll) tidak tersimpan di kejadian

    await db.kejadian.delete({ where: { id } });
    revalidatePath('/api/kejadian');
    revalidatePath('/api/statistik');
    revalidatePath('/api/penduduk');
    return NextResponse.json({
      message: 'Kejadian berhasil dihapus',
      jenisKejadian: jenis,
      namaLengkap: existing.namaLengkap,
      nik: existing.nik,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal menghapus data' }, { status: 500 });
  }
}
