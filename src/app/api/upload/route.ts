import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file missing' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `${Date.now()}-${safeName(file.name)}`;
    const uploadsDir = process.env.UPLOADS_DIR
      ? path.resolve(process.env.UPLOADS_DIR)
      : path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, fileName), buffer);

    return NextResponse.json({ url: `/api/files/${fileName}` });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }
}
