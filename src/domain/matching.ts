import type { TeamMember } from "./contacts";
import { daysBetween } from "./dates";
import type { Invoice, Payment, PaymentRule, PaymentSuggestion, SuggestionCandidate } from "./types";

/** "  Karen  Jørgensen " → "karen jørgensen". NFC so "å" typed two ways compares equal. */
export function normalizeName(value: string): string {
  return value.normalize("NFC").toLowerCase().trim().split(/\s+/).join(" ");
}

const FILLER_WORDS = new Set(["husleje", "leje", "rent"]);

/** The name part of a reference: "husleje Schmidt" → "schmidt", "2026-02 rent" → "". */
export function signature(reference: string): string {
  return normalizeName(reference)
    .split(" ")
    .filter((word) => word && !FILLER_WORDS.has(word) && !/^\d{4}-\d{2}$/.test(word))
    .join(" ");
}

const ruleKey = (signature: string, amount: number) => `${amount}|${signature}`;

/** normalized full name → tenantId. A name shared by two tenants is left out, so it never matches. */
function nameDirectory(invoices: readonly Invoice[]): Map<string, string> {
  const tenantsByName = new Map<string, Set<string>>();
  for (const i of invoices) {
    const name = normalizeName(i.tenant);
    tenantsByName.set(name, (tenantsByName.get(name) ?? new Set()).add(i.tenantId));
  }
  const directory = new Map<string, string>();
  for (const [name, tenants] of tenantsByName) {
    const [only] = tenants;
    if (tenants.size === 1 && only) directory.set(name, only);
  }
  return directory;
}

export type UnlinkedMatch =
  | { invoiceId: string; matchedBy: "name" }
  | { invoiceId: string; matchedBy: "confirmed"; confirmedBy: TeamMember };

/**
 * Matches payments without an invoice number whose reference is exactly a tenant's full name,
 * or whose signature + amount has a confirmed rule. Each goes to that tenant's still-owed invoice
 * with the due date closest to the booking date (tie → older), oldest payment first.
 */
export function matchUnlinkedPayments(
  invoices: readonly Invoice[],
  payments: readonly Payment[],
  rules: readonly PaymentRule[] = [],
): Map<string, UnlinkedMatch> {
  const directory = nameDirectory(invoices);
  const ruleIndex = new Map(rules.map((r) => [ruleKey(r.signature, r.amount), r]));

  const resolve = (p: Payment) => {
    const tenantId = directory.get(normalizeName(p.reference));
    if (tenantId) return { tenantId, matchedBy: "name" as const };
    const rule = ruleIndex.get(ruleKey(signature(p.reference), p.amount));
    if (rule) return { tenantId: rule.tenantId, matchedBy: "confirmed" as const, confirmedBy: rule.confirmedBy };
    return null;
  };

  const paid = new Map<string, number>();
  for (const p of payments) {
    if (p.invoiceId !== null) paid.set(p.invoiceId, (paid.get(p.invoiceId) ?? 0) + p.amount);
  }
  const owes = (i: Invoice) => (paid.get(i.id) ?? 0) < i.amount;

  const resolved = payments
    .filter((p) => p.invoiceId === null)
    .flatMap((p) => {
      const who = resolve(p);
      return who ? [{ payment: p, who }] : [];
    })
    .sort((a, b) => a.payment.bookedAt.localeCompare(b.payment.bookedAt) || a.payment.id.localeCompare(b.payment.id));

  const matches = new Map<string, UnlinkedMatch>();
  for (const { payment, who } of resolved) {
    const distance = (i: Invoice) => Math.abs(daysBetween(i.dueAt, payment.bookedAt));
    const target = invoices
      .filter((i) => i.tenantId === who.tenantId && owes(i))
      .sort((a, b) => distance(a) - distance(b) || a.dueAt.localeCompare(b.dueAt))[0];
    if (!target) continue;

    matches.set(
      payment.id,
      who.matchedBy === "name"
        ? { invoiceId: target.id, matchedBy: "name" }
        : { invoiceId: target.id, matchedBy: "confirmed", confirmedBy: who.confirmedBy },
    );
    paid.set(target.id, (paid.get(target.id) ?? 0) + payment.amount);
  }
  return matches;
}

type TenantInfo = { tenant: string; words: string[]; rents: Set<number>; owes: boolean };

/**
 * Unlinked payments signed with part of a name ("Alma", "husleje schmidt") that no rule covers yet,
 * grouped by signature + amount, with the tenants who could have sent them. Most payments first.
 */
export function findSuggestions(
  invoices: readonly Invoice[],
  payments: readonly Payment[],
  rules: readonly PaymentRule[] = [],
): PaymentSuggestion[] {
  const matched = matchUnlinkedPayments(invoices, payments, rules);

  // What each invoice has received so far, to tell who still owes something.
  const paid = new Map<string, number>();
  for (const p of payments) {
    const invoiceId = p.invoiceId ?? matched.get(p.id)?.invoiceId;
    if (invoiceId) paid.set(invoiceId, (paid.get(invoiceId) ?? 0) + p.amount);
  }

  const tenants = new Map<string, TenantInfo>();
  for (const i of invoices) {
    const t = tenants.get(i.tenantId) ?? {
      tenant: i.tenant,
      words: normalizeName(i.tenant).split(" "),
      rents: new Set<number>(),
      owes: false,
    };
    t.rents.add(i.amount);
    t.owes ||= (paid.get(i.id) ?? 0) < i.amount;
    tenants.set(i.tenantId, t);
  }

  const groups = new Map<string, PaymentSuggestion>();
  for (const p of payments) {
    if (p.invoiceId !== null || matched.has(p.id)) continue;
    const sig = signature(p.reference);
    if (!sig) continue; // "rent", "husleje", empty: no name to go on

    const key = ruleKey(sig, p.amount);
    const group = groups.get(key) ?? {
      signature: sig,
      amount: p.amount,
      payments: [],
      candidates: candidatesFor(sig, p.amount, tenants),
      suggestedTenantId: null,
    };
    group.payments.push({ paymentId: p.id, bookedAt: p.bookedAt, reference: p.reference });
    groups.set(key, group);
  }

  return [...groups.values()]
    .filter((g) => g.candidates.length > 0)
    .map((g) => ({
      ...g,
      payments: g.payments.sort((a, b) => a.bookedAt.localeCompare(b.bookedAt)),
      suggestedTenantId: suggest(g.candidates),
    }))
    .sort((a, b) => b.payments.length - a.payments.length || a.signature.localeCompare(b.signature));
}

/** Tenants whose rent equals the amount and whose full name contains every word of the signature. */
function candidatesFor(sig: string, amount: number, tenants: Map<string, TenantInfo>): SuggestionCandidate[] {
  const words = sig.split(" ");
  return [...tenants]
    .filter(([, t]) => t.rents.has(amount) && words.every((w) => t.words.includes(w)))
    .map(([tenantId, t]) => ({ tenantId, tenant: t.tenant, owesSomething: t.owes }))
    .sort((a, b) => a.tenant.localeCompare(b.tenant));
}

function suggest(candidates: readonly SuggestionCandidate[]): string | null {
  const owing = candidates.filter((c) => c.owesSomething);
  const [pick] = candidates.length === 1 ? candidates : owing.length === 1 ? owing : [];
  return pick?.tenantId ?? null;
}
