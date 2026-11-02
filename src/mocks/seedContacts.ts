import type { ContactsByInvoice } from "@/domain/contacts";

/** Example marks so the page doesn't start empty. Real invoice ids from the dataset. */
export const SEED_CONTACTS: ContactsByInvoice = {
  // Clara Nielsen — emailed about May–July, not yet about September
  "INV-0199": { invoiceId: "INV-0199", sentBy: "Sarah", sentAt: "2026-08-05T09:12:00.000Z" },
  "INV-0200": { invoiceId: "INV-0200", sentBy: "Sarah", sentAt: "2026-08-05T09:12:00.000Z" },
  "INV-0201": { invoiceId: "INV-0201", sentBy: "Sarah", sentAt: "2026-08-05T09:12:00.000Z" },
  // Rasmus Pedersen — emailed about August, October is new
  "INV-0683": { invoiceId: "INV-0683", sentBy: "Jonas", sentAt: "2026-08-12T13:40:00.000Z" },
  // Clara Lund — emailed about October
  "INV-0877": { invoiceId: "INV-0877", sentBy: "Jonas", sentAt: "2026-10-09T10:05:00.000Z" },
};
