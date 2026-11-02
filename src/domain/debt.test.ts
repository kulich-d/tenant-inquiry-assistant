/**
 * Debt calculation — who is late and by how much, from invoices + bank payments.
 *
 * Scenarios:
 * - Paid in full with one payment, or in two halves → not listed.
 * - Overpaid → not listed.
 * - Partly paid → listed as partial with the remaining amount and its payments.
 * - Nothing paid → listed as late.
 * - A payment without an invoice number (invoice_id = null) is ignored.
 * - Not yet due, or due today → not open.
 * - Grace period boundary: 7 days overdue with grace 7 → not late; 8 days → late; grace 0 → late from day 1.
 * - Two invoices for the same month (duplicate) → both counted (documents current behaviour).
 * - Tenant status: "late" if any invoice is unpaid, otherwise "partial"; total owed is summed.
 * - Tenants are sorted by their oldest overdue invoice; invoices oldest first.
 * - As-of date is the latest booking date in the bank export.
 * - Grace period typed by the user: whole days 0–60, anything else rejected.
 */
import { describe, expect, it } from "vitest";

import { computeOpenInvoices, groupLateTenants, latestBookingDate, parseGraceDays } from "./debt";
import type { Invoice, Payment } from "./types";

const AS_OF = "2026-10-13";

function invoice(id: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id,
    tenantId: "T001",
    tenant: "Sara Andersen",
    address: "Gammel Kongevej 85, st. tv",
    period: "2026-10",
    amount: 7200,
    issuedAt: "2026-09-22",
    dueAt: "2026-10-01",
    ...overrides,
  };
}

let paymentSeq = 0;
function payment(invoiceId: string | null, amount: number, bookedAt = "2026-10-02"): Payment {
  paymentSeq += 1;
  return { id: `PAY-${paymentSeq}`, bookedAt, amount, reference: invoiceId ?? "rent", invoiceId };
}

const lateTenants = (invoices: Invoice[], payments: Payment[], graceDays = 7) =>
  groupLateTenants(computeOpenInvoices(invoices, payments, AS_OF), graceDays);

describe("computeOpenInvoices", () => {
  it("leaves out an invoice paid in full", () => {
    expect(computeOpenInvoices([invoice("INV-1")], [payment("INV-1", 7200)], AS_OF)).toEqual([]);
  });

  it("leaves out an invoice paid in two halves", () => {
    const payments = [payment("INV-1", 3600, "2026-09-30"), payment("INV-1", 3600, "2026-10-08")];

    expect(computeOpenInvoices([invoice("INV-1")], payments, AS_OF)).toEqual([]);
  });

  it("leaves out an overpaid invoice", () => {
    expect(computeOpenInvoices([invoice("INV-1")], [payment("INV-1", 8000)], AS_OF)).toEqual([]);
  });

  it("keeps a partly paid invoice with what was paid, what is left, and the payments", () => {
    const half = payment("INV-1", 3600, "2026-09-30");

    expect(computeOpenInvoices([invoice("INV-1")], [half], AS_OF)).toEqual([
      expect.objectContaining({
        invoiceId: "INV-1",
        paid: 3600,
        remaining: 3600,
        status: "partial",
        daysOverdue: 12,
        payments: [{ paymentId: half.id, bookedAt: "2026-09-30", amount: 3600 }],
      }),
    ]);
  });

  it("keeps an unpaid invoice as unpaid", () => {
    expect(computeOpenInvoices([invoice("INV-1")], [], AS_OF)).toEqual([
      expect.objectContaining({ paid: 0, remaining: 7200, status: "unpaid", payments: [] }),
    ]);
  });

  it("ignores payments without an invoice number", () => {
    const [open] = computeOpenInvoices([invoice("INV-1")], [payment(null, 7200)], AS_OF);

    expect(open?.status).toBe("unpaid");
  });

  it("lists payments oldest first", () => {
    const later = payment("INV-1", 1000, "2026-10-10");
    const earlier = payment("INV-1", 1000, "2026-10-05");

    const [open] = computeOpenInvoices([invoice("INV-1")], [later, earlier], AS_OF);

    expect(open?.payments.map((p) => p.bookedAt)).toEqual(["2026-10-05", "2026-10-10"]);
  });

  it.each([
    ["not yet due", "2026-11-01"],
    ["due today", AS_OF],
  ])("leaves out an invoice that is %s", (_, dueAt) => {
    expect(computeOpenInvoices([invoice("INV-1", { dueAt })], [], AS_OF)).toEqual([]);
  });
});

describe("groupLateTenants — grace period", () => {
  it("does not count 7 days overdue as late with a 7-day grace period", () => {
    expect(lateTenants([invoice("INV-1", { dueAt: "2026-10-06" })], [], 7)).toEqual([]);
  });

  it("counts 8 days overdue as late with a 7-day grace period", () => {
    const [debt] = lateTenants([invoice("INV-1", { dueAt: "2026-10-05" })], [], 7);

    expect(debt?.maxDaysOverdue).toBe(8);
  });

  it("counts an invoice as late from the first day with no grace period", () => {
    expect(lateTenants([invoice("INV-1", { dueAt: "2026-10-12" })], [], 0)).toHaveLength(1);
  });

  it("drops tenants from the list as the grace period grows", () => {
    const invoices = [invoice("INV-1")]; // 12 days overdue

    expect(lateTenants(invoices, [], 11)).toHaveLength(1);
    expect(lateTenants(invoices, [], 12)).toHaveLength(0);
  });
});

describe("groupLateTenants — tenants", () => {
  it("groups a tenant's overdue invoices, oldest first, and sums what is owed", () => {
    const invoices = [
      invoice("INV-OCT", { period: "2026-10", dueAt: "2026-10-01" }),
      invoice("INV-AUG", { period: "2026-08", dueAt: "2026-08-01" }),
    ];

    const [debt] = lateTenants(invoices, [payment("INV-AUG", 3600)]);

    expect(debt).toMatchObject({
      tenantId: "T001",
      totalRemaining: 3600 + 7200,
      maxDaysOverdue: 73,
    });
    expect(debt?.invoices.map((i) => i.invoiceId)).toEqual(["INV-AUG", "INV-OCT"]);
  });

  it("marks a tenant late if any invoice is unpaid, partly paid if all have some payment", () => {
    const unpaidAndPartial = [invoice("INV-1"), invoice("INV-2", { period: "2026-09", dueAt: "2026-09-01" })];
    const [late] = lateTenants(unpaidAndPartial, [payment("INV-2", 100)]);
    const [partial] = lateTenants(unpaidAndPartial, [payment("INV-1", 100), payment("INV-2", 100)]);

    expect(late?.status).toBe("late");
    expect(partial?.status).toBe("partial");
  });

  it("counts both invoices when a month was invoiced twice", () => {
    const duplicate = [invoice("INV-0617", { period: "2026-03" }), invoice("INV-0618", { period: "2026-03" })];

    const [debt] = lateTenants(duplicate, [payment("INV-0617", 7200)]);

    expect(debt?.invoices.map((i) => i.invoiceId)).toEqual(["INV-0618"]);
  });

  it("sorts tenants by their oldest overdue invoice, then by name", () => {
    const invoices = [
      invoice("INV-A", { tenantId: "T-A", tenant: "Anna", dueAt: "2026-10-01" }),
      invoice("INV-B", { tenantId: "T-B", tenant: "Bo", dueAt: "2026-08-01" }),
      invoice("INV-C", { tenantId: "T-C", tenant: "Ada", dueAt: "2026-10-01" }),
    ];

    expect(lateTenants(invoices, []).map((d) => d.tenant)).toEqual(["Bo", "Ada", "Anna"]);
  });
});

describe("parseGraceDays", () => {
  it.each([
    ["0", 0],
    ["7", 7],
    ["60", 60],
  ])("accepts %s", (raw, days) => {
    expect(parseGraceDays(raw)).toBe(days);
  });

  it.each(["", "-1", "61", "7.5", "abc", null])("rejects %j", (raw) => {
    expect(parseGraceDays(raw)).toBeNull();
  });
});

describe("latestBookingDate", () => {
  it("is the latest booking date in the export", () => {
    const payments = [payment("INV-1", 1, "2026-10-01"), payment("INV-2", 1, "2026-10-13"), payment(null, 1, "2026-10-07")];

    expect(latestBookingDate(payments)).toBe("2026-10-13");
  });

  it("fails loudly on an empty export", () => {
    expect(() => latestBookingDate([])).toThrow();
  });
});
