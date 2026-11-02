# Plan — debt calculation (replace the late-list mock)

## Goal

The late list is computed from `data/invoices.json` + `data/payments.json` instead of the hand-written mock.
Sarah can change the grace period on the page and the list updates at once.

## Rules

- **Payments per invoice** = all payments whose `invoice_id` is that invoice. Payments with `invoice_id = null` are ignored (level 2).
- **Paid** = sum of those payments. **Remaining** = invoice amount − paid.
- `remaining <= 0` → invoice is settled (incl. overpaid), not shown.
- **As-of date** = latest `booked_at` in the bank export.
- **Days overdue** = as-of − `due_at`, in whole days.
- **Grace period** (delta) = number of days after `due_at` that don't count as late. Default 7, editable on the page.
- **Overdue** = `remaining > 0` and `daysOverdue > graceDays`. Exactly 7 days with grace 7 → not overdue; 8 → overdue.
- **Tenant row**: tenants with ≥ 1 overdue invoice. Status "Late" if any overdue invoice has no payment, otherwise "Partly paid". Sorted by oldest overdue invoice.

## Design

Split by where it runs:

1. **Server** (page render): load + validate JSON, compute every *open* invoice (remaining > 0, past due) with its payments. Only this list goes to the browser, not the raw exports.
2. **Browser**: filter open invoices by the current grace period and group by tenant. Pure function, so changing the grace period is instant.

```
src/
  domain/
    types.ts         + InvoicePayment, OpenInvoice, LedgerSnapshot
    dates.ts         daysBetween (UTC, whole days)
    debt.ts          latestBookingDate, computeOpenInvoices, groupLateTenants
    debt.test.ts
  server/
    ledger.ts        'server-only': read + zod-parse JSON → LedgerSnapshot
  app/page.tsx       getLedgerSnapshot() → <LateRentView>
  components/late-rent/
    late-rent-view.tsx     'use client': grace input, summary, table
    grace-period-input.tsx
    stores.ts              + useGraceDays (localStorage, like the user switcher)
    invoice-row.tsx        + list of payments for the invoice
```

Removed: `mocks/lateTenantsApi.ts`, `mocks/lateTenantsFixture.ts`. Emailed marks stay mocked.

## UI changes

- Header: "Grace period [ 7 ] days" input next to the user switcher. Integer, 0–60. Remembered per browser.
- Summary line ("N tenants · X kr outstanding") follows the grace period.
- Expanded invoice row lists its payments: "31 Oct · 6.950 kr", or "No payments".

## Tests

`debt.test.ts`:
- paid in full with one payment / in two halves → not listed
- partly paid → listed as partial with the right remaining
- unpaid → listed as late
- grace boundary: 7 days → not overdue, 8 days → overdue; grace 0 → overdue from day 1
- overpaid → not listed
- payment with `invoice_id = null` is ignored
- duplicate invoice for the same month is listed (documents current behaviour)
- tenant status, totals, sort order, invoice order
- as-of = latest booking date

UI:
- changing the grace period adds/removes tenants
- expanded invoice shows its payments

## Steps

1. Domain types + `daysBetween` + `debt.ts` with tests
2. `server/ledger.ts` (zod) and page wiring
3. Grace period input + store, `LateRentView`
4. Payments list in the invoice row
5. Update UI tests, remove the late-list mock
6. Check in the browser
