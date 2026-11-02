import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { TEAM } from "@/domain/contacts";

/** One "emailed" mark per invoice. No history: unticking deletes the row. */
export const contacts = sqliteTable("contacts", {
  invoiceId: text("invoice_id").primaryKey(),
  sentBy: text("sent_by", { enum: TEAM }).notNull(),
  /** ISO timestamp. */
  sentAt: text("sent_at").notNull(),
});

/** "Payments signed like this, for this amount, come from this tenant" — confirmed by someone on the team. */
export const paymentRules = sqliteTable(
  "payment_rules",
  {
    signature: text("signature").notNull(),
    amount: integer("amount").notNull(),
    tenantId: text("tenant_id").notNull(),
    confirmedBy: text("confirmed_by", { enum: TEAM }).notNull(),
    /** ISO timestamp. */
    confirmedAt: text("confirmed_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.signature, t.amount] })],
);
