import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "photos");

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Ensure upload dir exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const formData = await req.formData();
  const catId = formData.get("catId") as string;
  const photoFile = formData.get("photo") as File;
  const thumbFile = formData.get("thumb") as File;
  const phash = (formData.get("phash") as string) || "";
  const lat = formData.get("lat") ? parseFloat(formData.get("lat") as string) : null;
  const lng = formData.get("lng") ? parseFloat(formData.get("lng") as string) : null;
  const width = formData.get("width") ? parseInt(formData.get("width") as string) : 0;
  const height = formData.get("height") ? parseInt(formData.get("height") as string) : 0;

  if (!catId || !photoFile || !thumbFile) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  // Verify cat belongs to user
  const db = getDb();
  const cat = db
    .prepare("SELECT * FROM cats WHERE id = ? AND user_id = ?")
    .get(catId, session.user.id) as any;

  if (!cat) {
    return NextResponse.json({ error: "Gato no encontrado" }, { status: 404 });
  }

  const photoId = crypto.randomUUID();
  const ext = photoFile.name.split(".").pop() || "webp";
  const fileName = `${photoId}.${ext}`;
  const thumbName = `${photoId}_thumb.${ext}`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  const thumbPath = path.join(UPLOAD_DIR, thumbName);

  // Save files
  fs.writeFileSync(filePath, Buffer.from(await photoFile.arrayBuffer()));
  fs.writeFileSync(thumbPath, Buffer.from(await thumbFile.arrayBuffer()));

  const now = Date.now();

  // Insert photo record
  db.prepare(
    `INSERT INTO photos (id, cat_id, user_id, file_path, thumb_path, taken_at, lat, lng, phash, width, height, bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    photoId, catId, session.user.id, filePath, thumbPath,
    now, lat, lng, phash, width, height, photoFile.size
  );

  // Update cat counters
  db.prepare(
    "UPDATE cats SET photo_count = photo_count + 1, last_seen = ? WHERE id = ?"
  ).run(now, catId);

  // Set thumb if first photo
  if (cat.photo_count === 0) {
    db.prepare("UPDATE cats SET thumb_blob_id = ? WHERE id = ?").run(photoId, catId);
  }

  return NextResponse.json({ id: photoId, url: `/api/photos/${photoId}` }, { status: 201 });
}
