import { eq, inArray } from "drizzle-orm";

import { indexByInvoice, type Contact, type ContactsByInvoice, type TeamMember } from "@/domain/contacts";

import type { Db } from "./db";
import { contacts } from "./db/schema";

export async function listContacts(db: Db): Promise<ContactsByInvoice> {
  return indexByInvoice(await db.select().from(contacts));
}

export type MarkOutcome = {
  /** The marks now stored for the requested invoices. */
  stored: Contact[];
  /** Marks that already existed — someone got there first, so they were kept as they are. */
  alreadyMarked: Contact[];
};

/** Marks invoices as emailed. First mark wins: an existing mark is never overwritten. */
export async function markEmailed(
  db: Db,
  invoiceIds: readonly string[],
  sentBy: TeamMember,
  now: Date = new Date(),
): Promise<MarkOutcome> {
  const ids = [...new Set(invoiceIds)];
  if (ids.length === 0) return { stored: [], alreadyMarked: [] };

  return db.transaction(async (tx) => {
    const existing = await tx.select().from(contacts).where(inArray(contacts.invoiceId, ids));
    const sentAt = now.toISOString();
    await tx
      .insert(contacts)
      .values(ids.map((invoiceId) => ({ invoiceId, sentBy, sentAt })))
      .onConflictDoNothing({ target: contacts.invoiceId });
    const stored = await tx.select().from(contacts).where(inArray(contacts.invoiceId, ids));
    return { stored, alreadyMarked: existing };
  });
}

export async function unmarkEmailed(db: Db, invoiceId: string): Promise<void> {
  await db.delete(contacts).where(eq(contacts.invoiceId, invoiceId));
}
