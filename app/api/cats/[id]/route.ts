import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  const cat = db
    .prepare("SELECT * FROM cats WHERE id = ? AND user_id = ?")
    .get(id, session.user.id);

  if (!cat) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Get photos for this cat
  const photos = db
    .prepare("SELECT * FROM photos WHERE cat_id = ? ORDER BY taken_at DESC")
    .all(id);

  return NextResponse.json({ ...cat as any, photos });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const cat = db
    .prepare("SELECT * FROM cats WHERE id = ? AND user_id = ?")
    .get(id, session.user.id) as any;

  if (!cat) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) {
    updates.push("name = ?");
    values.push(body.name);
  }
  if (body.notes !== undefined) {
    updates.push("notes = ?");
    values.push(body.notes);
  }
  if (body.manuallyNamed !== undefined) {
    updates.push("manually_named = ?");
    values.push(body.manuallyNamed ? 1 : 0);
  }

  if (updates.length > 0) {
    values.push(id, session.user.id);
    db.prepare(
      `UPDATE cats SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).run(...values);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  // Delete photos from filesystem
  const photos = db
    .prepare("SELECT file_path, thumb_path FROM photos WHERE cat_id = ?")
    .all(id) as any[];

  const fs = require("fs");
  for (const p of photos) {
    try { fs.unlinkSync(p.file_path); } catch {}
    try { fs.unlinkSync(p.thumb_path); } catch {}
  }

  db.prepare("DELETE FROM photos WHERE cat_id = ?").run(id);
  db.prepare("DELETE FROM cats WHERE id = ? AND user_id = ?").run(id, session.user.id);

  return NextResponse.json({ ok: true });
}
