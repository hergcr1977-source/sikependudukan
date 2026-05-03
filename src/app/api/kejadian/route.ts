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
      tanggal, keterangan, noKKBaru,
    } = body;

    // DATANG: namaLengkap boleh kosong di body utama, ambil dari anggotaBaru pertama
    let finalNamaLengkap = namaLengkap || '';
    let finalTanggal = tanggal || '';
    const jenis = toUpperCase(jenisKejadian);

    if (jenis === 'DATANG') {
      const anggotaBaru = body.anggotaBaru;
      if (anggotaBaru && Array.isArray(anggotaBaru) && anggotaBaru.length > 0) {
        // Ambil nama dan tanggal dari anggota pertama sebagai fallback
        const first = anggotaBaru[0];
        if (!finalNamaLengkap && first.namaLengkap) {
          finalNamaLengkap = first.namaLengkap;
        }
        if (!finalTanggal && first.tanggalLahir) {
          finalTanggal = first.tanggalLahir;
        }
      }
    }

    if (!jenisKejadian || !finalNamaLengkap || !finalTanggal) {
      return NextResponse.json(
        { error: 'Jenis kejadian, nama, dan tanggal wajib diisi' },
        { status: 400 }
      );
    }

    const rtId = auth.rtId || 1;

    // ===== SIDE EFFECTS =====

    if (jenis === 'MATI') {
      // --- MATI: Jika KKL meninggal, istri jadi KKL ---
      if (noKK && nik) {
        const deceased = await db.penduduk.findFirst({
          where: { noKK, nik, rtId },
        });

        if (deceased && deceased.statusKeluarga === 'KEPALA KELUARGA') {
          // Cari istri di KK yang sama
          const wife = await db.penduduk.findFirst({
            where: {
              noKK,
              rtId,
              jenisKelamin: 'PEREMPUAN',
              statusKeluarga: 'ISTRI',
            },
          });

          if (wife) {
            await db.penduduk.update({
              where: { id: wife.id },
              data: { statusKeluarga: 'KEPALA KELUARGA' },
            });
          } else {
            // Jika tidak ada istri, cari anggota dewasa pertama
            const otherMember = await db.penduduk.findFirst({
              where: {
                noKK,
                rtId,
                statusKeluarga: { not: 'KEPALA KELUARGA' },
              },
              orderBy: { createdAt: 'asc' },
            });

            if (otherMember) {
              await db.penduduk.update({
                where: { id: otherMember.id },
                data: { statusKeluarga: 'KEPALA KELUARGA' },
              });
            }
          }
        }
      }

      // Update noKK jika ada perubahan
      if (noKK && noKKBaru && noKKBaru !== noKK) {
        await db.penduduk.updateMany({
          where: { noKK, rtId },
          data: { noKK: noKKBaru },
        });
      }
    }

    if (jenis === 'LAHIR') {
      // --- LAHIR: Tambah penduduk baru ---
      if (noKK && nik) {
        const exists = await db.penduduk.findFirst({
          where: { nik, rtId },
        });

        if (!exists) {
          // Cari KKL untuk ambil info KK
          const kepala = await db.penduduk.findFirst({
            where: { noKK, statusKeluarga: 'KEPALA KELUARGA', rtId },
          });

          await db.penduduk.create({
            data: {
              noKK: noKKBaru || noKK,
              nik,
              namaLengkap: toUpperCase(namaLengkap),
              jenisKelamin: toUpperCase(jenisKelamin) || 'LAKI-LAKI',
              tanggalLahir: new Date(tanggal),
              tempatLahir: '',
              statusKeluarga: 'ANAK',
              agama: kepala?.agama || 'ISLAM',
              pendidikan: 'TIDAK/BELUM SEKOLAH',
              pekerjaan: 'BELUM/TIDAK BEKERJA',
              statusPerkawinan: 'BELUM MENIKAH',
              kewarganegaraan: 'WNI',
              punyaKTP: 'BELUM',
              namaAyah: kepala?.namaAyah || '-',
              namaIbu: kepala?.namaIbu || '-',
              rtId,
            },
          });
        }
      }

      // Update noKK jika ada perubahan
      if (noKK && noKKBaru && noKKBaru !== noKK) {
        await db.penduduk.updateMany({
          where: { noKK, rtId },
          data: { noKK: noKKBaru },
        });
      }
    }

    if (jenis === 'PINDAH') {
      // --- PINDAH: Murni catatan, tidak menghapus data penduduk ---
    }

    if (jenis === 'DATANG') {
      // --- DATANG: Tambah penduduk baru ke KK tujuan atau buat KK baru ---
      const anggotaBaru = body.anggotaBaru;
      if (anggotaBaru && Array.isArray(anggotaBaru) && anggotaBaru.length > 0) {
        const targetNoKK = noKKBaru || noKK;
        for (const a of anggotaBaru) {
          if (!a.nik || !a.namaLengkap) continue;

          const exists = await db.penduduk.findFirst({
            where: { nik: a.nik, rtId },
          });
          if (exists) continue;

          await db.penduduk.create({
            data: {
              noKK: targetNoKK,
              nik: a.nik,
              namaLengkap: toUpperCase(a.namaLengkap),
              jenisKelamin: toUpperCase(a.jenisKelamin) || 'LAKI-LAKI',
              tanggalLahir: a.tanggalLahir ? new Date(a.tanggalLahir) : null,
              tempatLahir: a.tempatLahir || '',
              statusKeluarga: toUpperCase(a.statusKeluarga) || 'LAINNYA',
              agama: a.agama || 'ISLAM',
              pendidikan: a.pendidikan || 'TIDAK/BELUM SEKOLAH',
              pekerjaan: a.pekerjaan || 'BELUM/TIDAK BEKERJA',
              statusPerkawinan: a.statusPerkawinan || 'BELUM MENIKAH',
              kewarganegaraan: 'WNI',
              punyaKTP: a.punyaKTP || 'BELUM',
              namaAyah: a.namaAyah || '-',
              namaIbu: a.namaIbu || '-',
              rtId,
            },
          });
        }
      }
    }

    // Simpan catatan kejadian
    const data = await db.kejadian.create({
      data: {
        rtId,
        jenisKejadian: jenis,
        noKK: noKKBaru || noKK || '',
        namaLengkap: toUpperCase(finalNamaLengkap),
        nik: nik || null,
        jenisKelamin: toUpperCase(jenisKelamin) || '',
        tanggal: new Date(finalTanggal),
        keterangan: keterangan || null,
      },
    });

    revalidatePath('/api/kejadian');
    revalidatePath('/api/statistik');
    revalidatePath('/api/penduduk');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Gagal menambah kejadian: ${msg}` }, { status: 500 });
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

    const existing = await db.kejadian.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Kejadian tidak ditemukan' }, { status: 404 });
    }
    if (auth.rtId && existing.rtId !== auth.rtId) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.jenisKejadian !== undefined) updateData.jenisKejadian = toUpperCase(data.jenisKejadian);
    if (data.noKK !== undefined) updateData.noKK = data.noKK || '';
    if (data.namaLengkap !== undefined) updateData.namaLengkap = toUpperCase(data.namaLengkap);
    if (data.nik !== undefined) updateData.nik = data.nik || null;
    if (data.jenisKelamin !== undefined) updateData.jenisKelamin = toUpperCase(data.jenisKelamin);
    if (data.tanggal !== undefined) updateData.tanggal = new Date(data.tanggal);
    if (data.keterangan !== undefined) updateData.keterangan = data.keterangan || null;

    const result = await db.kejadian.update({
      where: { id },
      data: updateData,
    });

    revalidatePath('/api/kejadian');
    revalidatePath('/api/statistik');
    return NextResponse.json(result);
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

    await db.kejadian.delete({ where: { id } });
    revalidatePath('/api/kejadian');
    revalidatePath('/api/statistik');
    return NextResponse.json({ message: 'Kejadian berhasil dihapus' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal menghapus data' }, { status: 500 });
  }
}
