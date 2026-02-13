import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

// /api/archivos/[nombre]
export async function GET(
  _req: Request,
  context: { params: { nombre: string } }
) {
  try {
    const uploadsDir = process.env.UPLOADS_DIR
      ? path.resolve(process.env.UPLOADS_DIR)
      : path.join(process.cwd(), "public", "uploads");

    const nombre = context.params.nombre; // <- coincide con [nombre]
    const filePath = path.join(uploadsDir, nombre);

    const data = await fs.readFile(filePath);

    const ext = path.extname(nombre).toLowerCase();
    const type =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
        ? "image/gif"
        : ext === ".pdf"
        ? "application/pdf"
        : "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }
}
