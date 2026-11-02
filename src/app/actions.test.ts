// @vitest-environment node
/**
 * Server Actions for "emailed" marks and payment rules — the boundary the browser calls.
 *
 * Scenarios:
 * - Marking returns what is stored and refreshes the page.
 * - Someone else's earlier mark is reported back as "already marked".
 * - Unknown team member, malformed invoice id, or an empty list → rejected, nothing written.
 * - Unmarking removes the mark and refreshes the page.
 * - A database failure becomes a friendly error, not a crash.
 * - Confirming a rule: stores it and refreshes; a tenant who isn't a candidate for the pattern,
 *   or invalid input, is rejected; a pattern someone already confirmed keeps their answer.
 * - Undoing a rule removes it and refreshes.
 */
import { refresh } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listContacts } from "@/server/contacts";
import { listRules } from "@/server/rules";
import { createDb, migrateDb, type Db } from "@/server/db";
import { getDb } from "@/server/db/client";

import { confirmRuleAction, markEmailedAction, undoRuleAction, unmarkEmailedAction } from "./actions";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/server/db/client", () => ({ getDb: vi.fn() }));
// Two Almas with the same rent; Alma Andersen owes June, Alma Hassan owes nothing. One payment signed "Alma".
vi.mock("@/server/ledger", () => ({
  getLedgerData: async () => ({
    invoices: [
      { id: "INV-AA", tenantId: "T066", tenant: "Alma Andersen", address: "", period: "2026-06", amount: 8500, issuedAt: "2026-05-22", dueAt: "2026-06-01" },
      { id: "INV-AH", tenantId: "T069", tenant: "Alma Hassan", address: "", period: "2026-06", amount: 8500, issuedAt: "2026-05-22", dueAt: "2026-06-01" },
    ],
    payments: [{ id: "PAY-1", bookedAt: "2026-06-07", amount: 8500, reference: "Alma", invoiceId: null }],
  }),
}));

let db: Db;

beforeEach(async () => {
  vi.clearAllMocks();
  db = createDb(":memory:");
  await migrateDb(db);
  vi.mocked(getDb).mockResolvedValue(db);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("markEmailedAction", () => {
  it("stores the mark and refreshes the page", async () => {
    const result = await markEmailedAction({ invoiceIds: ["INV-0685"], sentBy: "Sarah" });

    expect(result).toMatchObject({ ok: true, alreadyMarked: [], stored: [{ invoiceId: "INV-0685", sentBy: "Sarah" }] });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("reports a mark someone else made first", async () => {
    await markEmailedAction({ invoiceIds: ["INV-0685"], sentBy: "Jonas" });

    const result = await markEmailedAction({ invoiceIds: ["INV-0685"], sentBy: "Sarah" });

    expect(result).toMatchObject({ ok: true, alreadyMarked: [{ invoiceId: "INV-0685", sentBy: "Jonas" }] });
  });

  it.each([
    ["an unknown team member", { invoiceIds: ["INV-0685"], sentBy: "Eve" }],
    ["a malformed invoice id", { invoiceIds: ["'; DROP TABLE contacts"], sentBy: "Sarah" }],
    ["no invoices", { invoiceIds: [], sentBy: "Sarah" }],
  ])("rejects %s without writing", async (_, input) => {
    // Simulates a hand-crafted POST: the types don't stop it at runtime.
    const result = await markEmailedAction(input as Parameters<typeof markEmailedAction>[0]);

    expect(result).toEqual({ ok: false, error: "Invalid request." });
    expect(await listContacts(db)).toEqual({});
    expect(refresh).not.toHaveBeenCalled();
  });

  it("turns a database failure into a friendly error", async () => {
    vi.mocked(getDb).mockRejectedValue(new Error("disk full"));

    const result = await markEmailedAction({ invoiceIds: ["INV-0685"], sentBy: "Sarah" });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/couldn't save/i) });
  });
});

describe("unmarkEmailedAction", () => {
  it("removes the mark and refreshes the page", async () => {
    await markEmailedAction({ invoiceIds: ["INV-0685"], sentBy: "Sarah" });
    vi.mocked(refresh).mockClear();

    const result = await unmarkEmailedAction({ invoiceId: "INV-0685" });

    expect(result).toEqual({ ok: true });
    expect(await listContacts(db)).toEqual({});
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("rejects a malformed invoice id", async () => {
    expect(await unmarkEmailedAction({ invoiceId: "nope" })).toEqual({ ok: false, error: "Invalid request." });
  });
});

describe("confirmRuleAction", () => {
  const ALMA = { signature: "alma", amount: 8500, tenantId: "T066", confirmedBy: "Sarah" } as const;

  it("stores the rule and refreshes the page", async () => {
    expect(await confirmRuleAction(ALMA)).toEqual({ ok: true });

    expect(await listRules(db)).toMatchObject([{ signature: "alma", amount: 8500, tenantId: "T066", confirmedBy: "Sarah" }]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("accepts the other candidate too — Sarah may know better", async () => {
    expect(await confirmRuleAction({ ...ALMA, tenantId: "T069" })).toEqual({ ok: true });
  });

  it.each([
    ["a tenant who isn't a candidate", { ...ALMA, tenantId: "T001" }, "That tenant doesn't match these payments."],
    ["a pattern with no payments", { ...ALMA, signature: "zed" }, "That tenant doesn't match these payments."],
    ["an unknown team member", { ...ALMA, confirmedBy: "Eve" }, "Invalid request."],
    ["an empty signature", { ...ALMA, signature: "" }, "Invalid request."],
  ])("rejects %s without writing", async (_, input, error) => {
    const result = await confirmRuleAction(input as Parameters<typeof confirmRuleAction>[0]);

    expect(result).toEqual({ ok: false, error });
    expect(await listRules(db)).toEqual([]);
  });

  it("keeps the first answer when someone already confirmed the pattern", async () => {
    await confirmRuleAction({ ...ALMA, confirmedBy: "Jonas" });

    expect(await confirmRuleAction({ ...ALMA, tenantId: "T069" })).toEqual({
      ok: false,
      error: "Jonas already confirmed who sends these payments.",
    });
    expect((await listRules(db))[0]?.tenantId).toBe("T066");
  });
});

describe("undoRuleAction", () => {
  it("removes the rule and refreshes the page", async () => {
    await confirmRuleAction({ signature: "alma", amount: 8500, tenantId: "T066", confirmedBy: "Sarah" });
    vi.mocked(refresh).mockClear();

    expect(await undoRuleAction({ signature: "alma", amount: 8500 })).toEqual({ ok: true });

    expect(await listRules(db)).toEqual([]);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
