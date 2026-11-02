import "server-only";

import { createDb, migrateDb, type Db } from "./index";

const DEFAULT_DATABASE_URL = "file:data/late-rent.db";

// Kept on globalThis so dev hot reloads reuse one connection.
const globalForDb = globalThis as typeof globalThis & { lateRentDb?: Promise<Db> };

/** The app's database, migrated on first use so `npm run dev` works on a fresh checkout. */
export function getDb(): Promise<Db> {
  globalForDb.lateRentDb ??= (async () => {
    const db = createDb(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
    await migrateDb(db);
    return db;
  })().catch((error: unknown) => {
    globalForDb.lateRentDb = undefined; // let the next request retry
    throw error;
  });
  return globalForDb.lateRentDb;
}
