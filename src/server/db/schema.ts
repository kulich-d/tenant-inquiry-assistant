import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { TEAM } from "@/domain/contacts";

/** One "emailed" mark per invoice. No history: unticking deletes the row. */
export const contacts = sqliteTable("contacts", {
  invoiceId: text("invoice_id").primaryKey(),
  sentBy: text("sent_by", { enum: TEAM }).notNull(),
  /** ISO timestamp. */
  sentAt: text("sent_at").notNull(),
});
