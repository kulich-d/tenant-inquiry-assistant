// @vitest-environment node
/**
 * Payment rules repository — "signature + amount → tenant" confirmations in SQLite (in-memory, real migrations).
 *
 * Scenarios:
 * - A fresh database has no rules.
 * - Confirming stores who confirmed and when.
 * - First confirmation wins: confirming the same pattern again keeps the original rule.
 * - The same signature with another amount is a separate rule.
 * - Deleting removes only that pattern.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { createDb, migrateDb, type Db } from "./db";
import { confirmRule, deleteRule, listRules } from "./rules";

const MONDAY = new Date("2026-11-02T09:30:00.000Z");
const ALMA = { signature: "alma", amount: 8500, tenantId: "T066", confirmedBy: "Sarah" } as const;

let db: Db;

beforeEach(async () => {
  db = createDb(":memory:");
  await migrateDb(db);
});

describe("payment rules repository", () => {
  it("starts empty", async () => {
    expect(await listRules(db)).toEqual([]);
  });

  it("stores who confirmed a rule and when", async () => {
    const stored = await confirmRule(db, ALMA, MONDAY);

    expect(stored).toEqual({ ...ALMA, confirmedAt: MONDAY.toISOString() });
    expect(await listRules(db)).toEqual([stored]);
  });

  it("keeps the first confirmation of a pattern", async () => {
    const first = await confirmRule(db, ALMA, MONDAY);

    const second = await confirmRule(db, { ...ALMA, tenantId: "T069", confirmedBy: "Jonas" });

    expect(second).toEqual(first);
  });

  it("treats the same signature with another amount as a separate rule", async () => {
    await confirmRule(db, { ...ALMA, signature: "nowak", amount: 8500, tenantId: "T034" });
    await confirmRule(db, { ...ALMA, signature: "nowak", amount: 10200, tenantId: "T012" });

    expect((await listRules(db)).map((r) => r.tenantId).sort()).toEqual(["T012", "T034"]);
  });

  it("deletes only the given pattern", async () => {
    await confirmRule(db, ALMA);
    await confirmRule(db, { ...ALMA, signature: "kasper", amount: 11800, tenantId: "T076" });

    await deleteRule(db, "alma", 8500);

    expect((await listRules(db)).map((r) => r.signature)).toEqual(["kasper"]);
  });
});
