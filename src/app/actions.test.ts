// @vitest-environment node
/**
 * Server Actions for "emailed" marks — the boundary the browser calls.
 *
 * Scenarios:
 * - Marking returns what is stored and refreshes the page.
 * - Someone else's earlier mark is reported back as "already marked".
 * - Unknown team member, malformed invoice id, or an empty list → rejected, nothing written.
 * - Unmarking removes the mark and refreshes the page.
 * - A database failure becomes a friendly error, not a crash.
 */
import { refresh } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listContacts } from "@/server/contacts";
import { createDb, migrateDb, type Db } from "@/server/db";
import { getDb } from "@/server/db/client";

import { markEmailedAction, unmarkEmailedAction } from "./actions";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/server/db/client", () => ({ getDb: vi.fn() }));

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
