// @vitest-environment node
/**
 * Contacts repository — "emailed" marks in SQLite (in-memory, real migrations).
 *
 * Scenarios:
 * - A fresh database has no marks.
 * - Marking an invoice stores who and when.
 * - Marking several invoices at once (one email about all of a tenant's debt).
 * - First mark wins: marking an already-marked invoice keeps the original author and reports it.
 * - Marking the same invoice twice in one request stores it once.
 * - Unmarking deletes the mark; unmarking an unmarked invoice is a no-op.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { listContacts, markEmailed, unmarkEmailed } from "./contacts";
import { createDb, migrateDb, type Db } from "./db";

const MONDAY = new Date("2026-11-02T09:30:00.000Z");
const TUESDAY = new Date("2026-11-03T10:00:00.000Z");

let db: Db;

beforeEach(async () => {
  db = createDb(":memory:");
  await migrateDb(db);
});

describe("contacts repository", () => {
  it("starts empty", async () => {
    expect(await listContacts(db)).toEqual({});
  });

  it("stores who marked an invoice and when", async () => {
    const outcome = await markEmailed(db, ["INV-0685"], "Sarah", MONDAY);

    const mark = { invoiceId: "INV-0685", sentBy: "Sarah", sentAt: MONDAY.toISOString() };
    expect(outcome).toEqual({ stored: [mark], alreadyMarked: [] });
    expect(await listContacts(db)).toEqual({ "INV-0685": mark });
  });

  it("marks several invoices at once", async () => {
    await markEmailed(db, ["INV-0683", "INV-0685"], "Jonas", MONDAY);

    expect(Object.keys(await listContacts(db)).sort()).toEqual(["INV-0683", "INV-0685"]);
  });

  it("keeps the first mark when someone else marks the same invoice", async () => {
    await markEmailed(db, ["INV-0685"], "Sarah", MONDAY);

    const outcome = await markEmailed(db, ["INV-0683", "INV-0685"], "Jonas", TUESDAY);

    const sarahs = { invoiceId: "INV-0685", sentBy: "Sarah", sentAt: MONDAY.toISOString() };
    expect(outcome.alreadyMarked).toEqual([sarahs]);
    expect(outcome.stored).toContainEqual(sarahs);
    expect((await listContacts(db))["INV-0683"]?.sentBy).toBe("Jonas");
  });

  it("stores a duplicated invoice id once", async () => {
    const outcome = await markEmailed(db, ["INV-0685", "INV-0685"], "Sarah", MONDAY);

    expect(outcome.stored).toHaveLength(1);
  });

  it("deletes a mark on unmark, and ignores unmarking an unmarked invoice", async () => {
    await markEmailed(db, ["INV-0685"], "Sarah", MONDAY);

    await unmarkEmailed(db, "INV-0685");
    await unmarkEmailed(db, "INV-9999");

    expect(await listContacts(db)).toEqual({});
  });
});
