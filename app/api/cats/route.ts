import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const db = getDb();
  const cats = db
    .prepare("SELECT * FROM cats WHERE user_id = ? ORDER BY last_seen DESC")
    .all(user.id);

  return NextResponse.json(cats);
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const db = getDb();
  const body = await req.json();
  const { id, name, hash } = body;

  if (!id || !name) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const now = Date.now();
  db.prepare(
    `INSERT INTO cats (id, user_id, name, hash, created_at, last_seen, photo_count, thumb_blob_id, manually_named)
     VALUES (?, ?, ?, ?, ?, ?, 0, '', 0)`
  ).run(id, user.id, name, hash || "", now, now);

  return NextResponse.json({ id }, { status: 201 });
}
