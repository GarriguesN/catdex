import PocketBase from "pocketbase";

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "https://catdex.nglab.es/pb";

let pb: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  if (!pb) {
    pb = new PocketBase(PB_URL);
    // Auto-refresh auth
    pb.authStore.onChange(() => {
      // Trigger React re-render via custom event
      window.dispatchEvent(new Event("pb-auth-change"));
    });
  }
  return pb;
}

/**
 * True if `err` is PocketBase's own auto-cancellation (a newer request to the
 * same endpoint superseded this one) rather than a real failure — e.g. a
 * refetch-on-focus firing while an earlier load of the same collection is
 * still in flight. Callers should skip logging/surfacing these.
 * https://github.com/pocketbase/js-sdk#auto-cancellation
 */
export function isAbortError(err: unknown): boolean {
  return !!(err as { isAbort?: boolean })?.isAbort;
}

/** Get typed records from a PocketBase collection */
export async function getList<T = any>(
  collection: string,
  page = 1,
  perPage = 50,
  options: Record<string, any> = {}
): Promise<{ items: T[]; totalItems: number }> {
  const pb = getPocketBase();
  const result = await pb.collection(collection).getList(page, perPage, options);
  return { items: result.items as unknown as T[], totalItems: result.totalItems };
}

export async function getOne<T = any>(collection: string, id: string): Promise<T> {
  const pb = getPocketBase();
  return pb.collection(collection).getOne(id) as Promise<T>;
}

export async function createRecord<T = any>(collection: string, data: any): Promise<T> {
  const pb = getPocketBase();
  return pb.collection(collection).create(data) as Promise<T>;
}

export async function updateRecord<T = any>(collection: string, id: string, data: any): Promise<T> {
  const pb = getPocketBase();
  return pb.collection(collection).update(id, data) as Promise<T>;
}

export async function deleteRecord(collection: string, id: string): Promise<void> {
  const pb = getPocketBase();
  await pb.collection(collection).delete(id);
}
