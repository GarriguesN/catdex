import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** Get or auto-create user from session. Call at top of every API route. */
export async function requireUser(): Promise<{ id: string; email: string }> {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error("No autorizado");
  }

  const db = getDb();
  const email = session.user.email;
  let row = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;

  if (!row) {
    const id = crypto.randomUUID();
    db.prepare(
      "INSERT INTO users (id, email, name, image) VALUES (?, ?, ?, ?)"
    ).run(id, email, session.user.name || null, session.user.image || null);
    row = { id };
  }

  return { id: row.id, email };
}
