import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][];

    const info: {
      totalRows: number;
      headers: { rowIndex: number; columns: string[] }[];
      sampleRows: { rowIndex: number; data: string[] }[];
    } = {
      totalRows: rows.length,
      headers: [],
      sampleRows: [],
    };

    // Ambil 3 baris pertama (biasanya header + sub-header + data pertama)
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i];
      if (!row) continue;

      if (i < 2) {
        info.headers.push({
          rowIndex: i,
          columns: row.map((cell, idx) => `[${idx}] ${cell}`).filter(Boolean),
        });
      } else {
        info.sampleRows.push({
          rowIndex: i,
          data: row.map((cell, idx) => `[${idx}] ${cell}`).filter(Boolean),
        });
      }
    }

    return NextResponse.json({
      message: 'Diagnostic berhasil',
      sheetName: workbook.SheetNames[0],
      ...info,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
