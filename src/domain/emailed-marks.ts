import type { TeamMember } from "./team";

/** A record that someone emailed the tenant about one invoice. */
export type EmailedMark = {
  invoiceId: string;
  sentBy: TeamMember;
  /** ISO timestamp. */
  sentAt: string;
};

export type EmailedMarksByInvoice = Readonly<Record<string, EmailedMark>>;

export function indexByInvoice(marks: readonly EmailedMark[]): EmailedMarksByInvoice {
  return Object.fromEntries(marks.map((c) => [c.invoiceId, c]));
}

export type EmailedMarkChange =
  | { type: "mark"; invoiceIds: readonly string[]; sentBy: TeamMember; sentAt: string }
  | { type: "unmark"; invoiceIds: readonly string[] };

/** Applies a tick/untick locally, with the same rule as the server: an existing mark is never overwritten. */
export function applyEmailedMarkChange(marks: EmailedMarksByInvoice, change: EmailedMarkChange): EmailedMarksByInvoice {
  const next = { ...marks };
  for (const invoiceId of change.invoiceIds) {
    if (change.type === "unmark") delete next[invoiceId];
    else next[invoiceId] ??= { invoiceId, sentBy: change.sentBy, sentAt: change.sentAt };
  }
  return next;
}

export type EmailedSummary =
  | { kind: "none" }
  | { kind: "some"; emailed: number; total: number }
  | { kind: "all"; total: number; latest: EmailedMark };

export function summarizeEmailedMarks(
  invoiceIds: readonly string[],
  marks: EmailedMarksByInvoice,
): EmailedSummary {
  const found = invoiceIds.flatMap((id) => marks[id] ?? []);
  if (found.length === 0) return { kind: "none" };
  if (found.length < invoiceIds.length) {
    return { kind: "some", emailed: found.length, total: invoiceIds.length };
  }
  const latest = found.reduce((a, b) => (b.sentAt > a.sentAt ? b : a));
  return { kind: "all", total: invoiceIds.length, latest };
}
