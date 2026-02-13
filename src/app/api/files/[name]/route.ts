import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

// Serves uploaded files from a writable directory (works in packaged desktop apps).
export async function GET(
  _req: Request,
  { params }: { params: { nombre: string } }
) {
  try {
    const uploadsDir = process.env.UPLOADS_DIR
      ? path.resolve(process.env.UPLOADS_DIR)
      : path.join(process.cwd(), "public", "uploads");

    const filePath = path.join(uploadsDir, params.nombre);

    const data = await fs.readFile(filePath);

    // Basic content-type sniffing by extension (enough for images + common docs)
    const ext = path.extname(params.nombre).toLowerCase();
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
