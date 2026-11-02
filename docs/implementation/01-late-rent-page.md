# Implementation plan — late rent page (FE + user flow)

## Goal

Sarah and Jonas see one shared list of tenants who are late on rent, and mark which overdue invoices they have already emailed about — so they stop emailing the same tenant twice.

## User flow

1. Sarah opens the page and picks herself in the "You:" switcher (Sarah / Jonas).
2. She sees tenants who are late: name, property, status, total owed, contact summary.
3. She expands a tenant to see each overdue invoice: paid vs. due, remaining, days overdue, who emailed about it and when.
4. She emails the tenant outside the app.
5. She ticks the invoice(s) the email was about → the invoice shows "Sarah · today".
6. Jonas opens the same page and sees her marks.

## Scope

In:
- Frontend only. No backend, no DB, no API — everything is mocked.
- Late list computed in the browser from `invoices.json` + payments linked by `invoice_id`.
- Per-invoice "emailed" marks stored in a mock contacts store (localStorage, seeded with a few example marks).

Out (for now):
- Real backend and sharing between devices. The mock store sits behind an interface, so a real API can replace it without touching the UI.
- Payments with `invoice_id = null` (139 of 1256) — ignored; level 2.
- Re-contact rules ("time to follow up"), sending emails from the app, auth, uploading new bank exports.

## Rules

- **As-of date** = latest `booked_at` in `payments.json` (2026-10-13). Shown in the header as "data as of …".
- **Paid for an invoice** = sum of all payments with that `invoice_id` (tenants may pay in two halves).
- **Overdue invoice** = `paid < amount` and `due_at + 7 days < as-of`.
- **Invoice status**: `unpaid` (paid = 0) or `partial` (0 < paid < amount).
- **Tenant row** = tenants with at least one overdue invoice. Status = "Late" if any invoice is unpaid, otherwise "Partly paid". Days overdue = oldest overdue invoice.
- **Contact summary**: "nobody" / "N of M" / "all" (or "Jonas · 9 Oct" when there's one invoice).
- Default sort: days overdue, descending.

## Stack

Next.js (App Router) · React · Shadcn · Tailwind · Vitest · TypeScript.
No backend: JSON is imported as static data, contacts live in a mock store. Rationale goes to `DECISIONS.md`.

## Structure

```
data/                     invoices.json, payments.json (read-only source)
src/
  domain/
    types.ts              Invoice, Payment, Contact, OverdueInvoice, TenantDebt
    reconcile.ts          pure: (invoices, payments, asOf, graceDays) → TenantDebt[]
    reconcile.test.ts
  mocks/
    contactsStore.ts      ContactsStore interface + localStorage implementation
    seedContacts.ts       a few example marks (e.g. "Jonas · 12 Aug")
  app/
    page.tsx              imports JSON → reconcile → <LateTable>
  components/
    LateTable.tsx         'use client': table, expand/collapse, marks from the store
    TenantRow.tsx
    InvoiceRow.tsx
    UserSwitcher.tsx      Sarah / Jonas, stored in localStorage
```

## Data contracts

```ts
type Contact = {
  invoiceId: string;
  sentBy: string;        // "Sarah" | "Jonas"
  sentAt: string;        // ISO date
};

type OverdueInvoice = {
  invoiceId: string;
  period: string;        // "2026-08"
  amount: number;
  paid: number;
  remaining: number;
  dueAt: string;
  daysOverdue: number;
  status: 'unpaid' | 'partial';
};

type TenantDebt = {
  tenantId: string;
  tenant: string;
  address: string;
  status: 'late' | 'partial';
  totalRemaining: number;
  maxDaysOverdue: number;
  invoices: OverdueInvoice[];
};

interface ContactsStore {
  list(): Contact[];
  mark(invoiceId: string, sentBy: string): Contact;
  unmark(invoiceId: string): void;
}
```

Contacts are joined to invoices in the UI by `invoiceId`. One contact per invoice; unticking removes it.

## UI

Header: title "Late rent", "data as of 13 Oct 2026 · overdue > 7 days", "You: [Sarah ▾]".

Table (Shadcn `Table`):

| | Tenant | Property | Status | Emailed |
|---|---|---|---|---|
| ▸ | name + total owed | address | badge "Late · 73 d" / "Partly paid · 165 d" | summary |

Expanded rows, one per invoice: period · "paid X of Y" · "remaining Z · N d" · checkbox + "Sarah · 5 Aug" / "not emailed".

Shadcn components: `Table`, `Badge`, `Checkbox`, `Select`, `Collapsible` (or row state).
Amounts formatted with `Intl.NumberFormat('da-DK')` + "kr".

## Interaction

- Tick → `store.mark(invoiceId, currentUser)` → React state updates → row shows "Sarah · today".
- Untick → `store.unmark(invoiceId)`.
- Current user is read from localStorage on mount, default "Sarah".
- "Jonas sees it too" is simulated: switch the user to Jonas in the same browser and the marks are there.

## Steps (~2h)

1. Scaffold Next.js + Tailwind + Shadcn, copy data into `data/` — 15 min
2. `domain/reconcile.ts` + tests (full, partial in halves, grace period, duplicate invoice, as-of) — 35 min
3. Mock contacts store + seed + tests — 15 min
4. `page.tsx` + `LateTable` / rows / switcher — 35 min
5. Manual check in the browser against the mockup — 10 min
6. `DECISIONS.md` + README (how to run) — 10 min

## Known data quirks (not handled in v1, noted in DECISIONS.md)

- `INV-0618` is a duplicate March 2026 invoice for T052 — will show as overdue.
- 8 tenants never put the invoice number in the transfer → look unpaid every month until level 2 matches unlinked payments.
