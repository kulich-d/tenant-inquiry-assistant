import "server-only";

import { cacheLife } from "next/cache";
import { z } from "zod";

import invoicesJson from "../../data/invoices.json";
import paymentsJson from "../../data/payments.json";
import type { Invoice, LedgerData, Payment } from "@/domain/types";

// Parse at the boundary: the raw exports are snake_case and untrusted.

const isoDate = z.iso.date();

const invoiceSchema = z
  .object({
    id: z.string(),
    tenant_id: z.string(),
    tenant: z.string(),
    address: z.string(),
    period: z.string().regex(/^\d{4}-\d{2}$/),
    amount: z.number().int().positive(),
    issued_at: isoDate,
    due_at: isoDate,
  })
  .transform(
    (r): Invoice => ({
      id: r.id,
      tenantId: r.tenant_id,
      tenant: r.tenant,
      address: r.address,
      period: r.period,
      amount: r.amount,
      issuedAt: r.issued_at,
      dueAt: r.due_at,
    }),
  );

const paymentSchema = z
  .object({
    id: z.string(),
    booked_at: isoDate,
    amount: z.number().int().positive(),
    reference: z.string(),
    invoice_id: z.string().nullable(),
  })
  .transform(
    (r): Payment => ({
      id: r.id,
      bookedAt: r.booked_at,
      amount: r.amount,
      reference: r.reference,
      invoiceId: r.invoice_id,
    }),
  );

/**
 * The parsed exports. Cached: they are static files, so parsing runs once, not per request.
 * Matching depends on confirmed rules, so it happens per request in `buildLedgerSnapshot`.
 */
export async function getLedgerData(): Promise<LedgerData> {
  "use cache";
  cacheLife("max");

  return {
    invoices: z.array(invoiceSchema).parse(invoicesJson),
    payments: z.array(paymentSchema).parse(paymentsJson),
  };
}
