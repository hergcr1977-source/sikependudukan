import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'SIKEPENDUDUKAN-Offline.apk');
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="SIKEPENDUDUKAN-Offline.apk"',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
