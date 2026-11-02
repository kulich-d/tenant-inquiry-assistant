/**
 * Contacts store — where "emailed" marks are kept (localStorage mock).
 *
 * Scenarios:
 * - First visit with nothing stored → example marks (seed) are shown.
 * - Ticking an invoice records who ticked it and when.
 * - Unticking removes the mark.
 * - Marks survive a page reload.
 * - The snapshot stays the same object until something changes (needed by React).
 * - Subscribers are notified on change, and not after they unsubscribe.
 * - A mark made in another tab ("Jonas") shows up without a reload.
 * - Corrupted or invalid stored data falls back to the seed instead of breaking the page.
 * - Server rendering uses the seed.
 */
import { describe, expect, it, vi } from "vitest";

import type { ContactsByInvoice } from "@/domain/contacts";

import { createLocalStorageContactsStore } from "./contactsStore";

const KEY = "test:contacts";
const NOW = new Date("2026-11-02T09:30:00.000Z");
const SEED: ContactsByInvoice = {
  "INV-0683": { invoiceId: "INV-0683", sentBy: "Jonas", sentAt: "2026-08-12T13:40:00.000Z" },
};

const createStore = () => createLocalStorageContactsStore(KEY, SEED, () => NOW);

describe("createLocalStorageContactsStore", () => {
  it("starts from the seed when nothing is stored", () => {
    expect(createStore().getSnapshot()).toEqual(SEED);
  });

  it("records who marked an invoice and when", () => {
    const store = createStore();

    store.mark("INV-0685", "Sarah");

    expect(store.getSnapshot()["INV-0685"]).toEqual({
      invoiceId: "INV-0685",
      sentBy: "Sarah",
      sentAt: NOW.toISOString(),
    });
  });

  it("removes a mark", () => {
    const store = createStore();

    store.unmark("INV-0683");

    expect(store.getSnapshot()).toEqual({});
  });

  it("keeps marks across a page reload", () => {
    createStore().mark("INV-0685", "Sarah");

    const reloaded = createStore();

    expect(Object.keys(reloaded.getSnapshot())).toEqual(["INV-0683", "INV-0685"]);
  });

  it("returns the same snapshot until something changes", () => {
    const store = createStore();
    const first = store.getSnapshot();

    expect(store.getSnapshot()).toBe(first);
    store.mark("INV-0685", "Sarah");
    expect(store.getSnapshot()).not.toBe(first);
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.mark("INV-0685", "Sarah");
    unsubscribe();
    store.unmark("INV-0685");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("picks up marks made in another tab", () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.getSnapshot();

    // The other tab writes to storage and the browser fires a `storage` event here.
    createStore().mark("INV-0685", "Jonas");
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()["INV-0685"]?.sentBy).toBe("Jonas");
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["unknown team member", JSON.stringify({ X: { invoiceId: "X", sentBy: "Eve", sentAt: NOW.toISOString() } })],
  ])("falls back to the seed when storage holds %s", (_, raw) => {
    window.localStorage.setItem(KEY, raw);

    expect(createStore().getSnapshot()).toEqual(SEED);
  });

  it("uses the seed for server rendering", () => {
    expect(createStore().getServerSnapshot()).toBe(SEED);
  });
});
