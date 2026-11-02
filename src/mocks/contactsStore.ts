import { z } from "zod";

import { TEAM, type Contact, type ContactsByInvoice, type TeamMember } from "@/domain/contacts";

/**
 * Where "emailed" marks live. The UI depends only on this interface, so the
 * localStorage mock can be swapped for an API-backed store without UI changes.
 * Shaped for `useSyncExternalStore`.
 */
export interface ContactsStore {
  subscribe(onChange: () => void): () => void;
  getSnapshot(): ContactsByInvoice;
  getServerSnapshot(): ContactsByInvoice;
  mark(invoiceId: string, sentBy: TeamMember): void;
  unmark(invoiceId: string): void;
}

const contactSchema = z.object({
  invoiceId: z.string(),
  sentBy: z.enum(TEAM),
  sentAt: z.iso.datetime(),
});
const contactsSchema = z.record(z.string(), contactSchema);

export function createLocalStorageContactsStore(
  key: string,
  seed: ContactsByInvoice,
  now: () => Date = () => new Date(),
): ContactsStore {
  const listeners = new Set<() => void>();
  // Cached so getSnapshot returns a stable reference between changes.
  let snapshot: ContactsByInvoice | null = null;

  function read(): ContactsByInvoice {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return seed;
      const parsed = contactsSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : seed;
    } catch {
      return seed;
    }
  }

  function write(next: ContactsByInvoice) {
    snapshot = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode, quota): keep the in-memory state.
    }
    listeners.forEach((l) => l());
  }

  function onStorage(e: StorageEvent) {
    if (e.key !== key) return;
    snapshot = null;
    listeners.forEach((l) => l());
  }

  const getSnapshot = () => (snapshot ??= read());

  // Plain closures (no `this`), so methods can be passed around unbound.
  return {
    subscribe(onChange) {
      listeners.add(onChange);
      // Another tab (e.g. "Jonas") changed the marks.
      if (listeners.size === 1) window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot,
    getServerSnapshot: () => seed,
    mark(invoiceId, sentBy) {
      const contact: Contact = { invoiceId, sentBy, sentAt: now().toISOString() };
      write({ ...getSnapshot(), [invoiceId]: contact });
    },
    unmark(invoiceId) {
      const next = { ...getSnapshot() };
      delete next[invoiceId];
      write(next);
    },
  };
}
