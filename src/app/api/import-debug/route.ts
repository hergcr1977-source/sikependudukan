import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'penduduk';

    if (!file) {
      return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Parse dengan raw values (Date objects)
    const rowsRaw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

    // Parse dengan formatted strings (untuk perbandingan)
    const rowsFormatted = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][];

    const result: Record<string, any> = {
      type,
      totalRows: rowsRaw.length,
      sheetName: workbook.SheetNames[0],
      fileMeta: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
    };

    // Sample rows (raw vs formatted) untuk perbandingan
    result.sampleRows = [];
    for (let i = 0; i < Math.min(rowsRaw.length, 8); i++) {
      const raw = rowsRaw[i] || [];
      const formatted = rowsFormatted[i] || [];
      result.sampleRows.push({
        rowIndex: i,
        raw: raw.map((v, j) => ({
          col: j,
          value: v,
          type: v instanceof Date ? 'Date' : typeof v,
          isoDate: v instanceof Date ? v.toISOString() : null,
        })),
        formatted: formatted.map((v, j) => ({
          col: j,
          value: v,
          type: typeof v,
        })),
      });
    }

    // Detect header
    for (let i = 0; i < Math.min(rowsRaw.length, 5); i++) {
      const row = rowsRaw[i];
      if (!row) continue;
      const rowStr = row.map(c => String(c || '').toUpperCase()).join('|');
      if (rowStr.includes('NO. KK') || rowStr.includes('NIK') || rowStr.includes('NAMA')) {
        result.detectedHeaderRow = i;
        result.headerContent = (rowsRaw[i] || []).map((c, j) => `[${j}]="${c}"`).join(' | ');
        break;
      }
    }

    // Date column analysis
    const dateColIdx = type === 'sementara' ? 6 : 6; // TGL LAHIR column
    result.dateColumnAnalysis = [];
    for (let i = 1; i < Math.min(rowsRaw.length, 10); i++) {
      const raw = rowsRaw[i]?.[dateColIdx];
      const formatted = rowsFormatted[i]?.[dateColIdx];
      if (raw !== undefined && raw !== '') {
        result.dateColumnAnalysis.push({
          rowIndex: i,
          rawValue: raw,
          rawType: raw instanceof Date ? 'Date' : typeof raw,
          rawISO: raw instanceof Date ? raw.toISOString() : null,
          formattedValue: formatted,
          formattedType: typeof formatted,
        });
      }
    }

    // NoKK column analysis (merged cells check)
    const nkkColIdx = 0;
    result.nokkColumnAnalysis = [];
    for (let i = 0; i < Math.min(rowsRaw.length, 15); i++) {
      const raw = rowsRaw[i]?.[nkkColIdx];
      if (raw !== undefined) {
        result.nokkColumnAnalysis.push({
          rowIndex: i,
          value: raw,
          type: typeof raw,
          isEmpty: raw === '' || raw === undefined || raw === null,
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Import Debug] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
