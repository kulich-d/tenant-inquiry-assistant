export const TEAM = ["Sarah", "Jonas"] as const;
export type TeamMember = (typeof TEAM)[number];

export function isTeamMember(value: unknown): value is TeamMember {
  return TEAM.includes(value as TeamMember);
}

/** A record that someone emailed the tenant about one invoice. */
export type Contact = {
  invoiceId: string;
  sentBy: TeamMember;
  /** ISO timestamp. */
  sentAt: string;
};

export type ContactsByInvoice = Readonly<Record<string, Contact>>;

export function indexByInvoice(contacts: readonly Contact[]): ContactsByInvoice {
  return Object.fromEntries(contacts.map((c) => [c.invoiceId, c]));
}

export type ContactChange =
  | { type: "mark"; invoiceIds: readonly string[]; sentBy: TeamMember; sentAt: string }
  | { type: "unmark"; invoiceIds: readonly string[] };

/** Applies a tick/untick locally, with the same rule as the server: an existing mark is never overwritten. */
export function applyContactChange(contacts: ContactsByInvoice, change: ContactChange): ContactsByInvoice {
  const next = { ...contacts };
  for (const invoiceId of change.invoiceIds) {
    if (change.type === "unmark") delete next[invoiceId];
    else next[invoiceId] ??= { invoiceId, sentBy: change.sentBy, sentAt: change.sentAt };
  }
  return next;
}

export type ContactSummary =
  | { kind: "none" }
  | { kind: "some"; contacted: number; total: number }
  | { kind: "all"; total: number; latest: Contact };

export function summarizeContacts(
  invoiceIds: readonly string[],
  contacts: ContactsByInvoice,
): ContactSummary {
  const found = invoiceIds.flatMap((id) => contacts[id] ?? []);
  if (found.length === 0) return { kind: "none" };
  if (found.length < invoiceIds.length) {
    return { kind: "some", contacted: found.length, total: invoiceIds.length };
  }
  const latest = found.reduce((a, b) => (b.sentAt > a.sentAt ? b : a));
  return { kind: "all", total: invoiceIds.length, latest };
}
