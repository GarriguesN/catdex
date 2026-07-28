import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import fs from "fs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const thumb = _req.nextUrl.searchParams.get("thumb") === "1";

  const db = getDb();
  const photo = db
    .prepare("SELECT * FROM photos WHERE id = ? AND user_id = ?")
    .get(id, session.user.id) as any;

  if (!photo) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const filePath = thumb ? photo.thumb_path : photo.file_path;

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const ext = filePath.split(".").pop() || "webp";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": `image/${ext}`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
