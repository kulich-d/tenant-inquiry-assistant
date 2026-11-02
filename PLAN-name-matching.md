# Plan — match unlinked payments by full name

## Goal

139 bank payments have no invoice number (`invoice_id = null`), so their tenants look late although they paid.
Split the problem in two:

1. **This step — certain matches, applied automatically.** The reference is exactly a tenant's full name ("Ida Johansen") → treat it like a payment with an invoice number.
2. **Next step — guesses, human in the loop.** First name only, surname only, "rent", empty, … → suggested to Sarah, never applied automatically.

## Rule

A payment without `invoice_id` is matched to a tenant when its `reference`, normalized, **equals** that tenant's full name:

- normalized = Unicode NFC, lower case, trimmed, inner whitespace collapsed (`"  Karen  Jørgensen "` → `"karen jørgensen"`);
- the whole reference must be the name — "husleje Ida Johansen" or "Ida" are *not* matched here (step 2);
- the name must belong to exactly one tenant. Today all 100 names are unique; if two tenants ever share a name, neither is matched.

## Which invoice the payment pays

The tenant's open invoice whose **due date is closest to the booking date** (ties → the older invoice). Payments are processed oldest first, and an invoice already paid in full is skipped.

Why not "oldest debt first": Victor Kristensen owes February and June and pays by name on 31 May — that is June's rent. Oldest-first would mark February paid and June late, which is the wrong month to chase.

The whole payment goes to that one invoice. In the data every full-name payment equals the tenant's rent, so no splitting is needed; an overpayment is not carried over (noted in DECISIONS.md).

## How the matching works

1. **Name directory.** From the invoices, build `normalized name → tenantId`:
   ```
   "ida johansen"    → T035
   "karen jørgensen" → T005
   ```
   A name that belongs to two tenants is dropped from the directory, so it never matches.
2. **Find matches.** For each payment without `invoice_id`, normalize the `reference` and look it up:
   - `"Ida Johansen"` → `"ida johansen"` → T035 ✓
   - `"Ida"` → not in the directory → skipped (guess, step 2)
   - `"husleje schmidt"` → not in the directory → skipped
3. **Pick the invoice.** Go through the matched payments oldest first. For each, take that tenant's invoices that still have money owed and pick the one whose due date is closest to the booking date (tie → older). The whole payment goes there; an invoice that becomes fully paid is not picked again.
   - Victor Kristensen owes Feb (due 1 Feb) and Jun (due 1 Jun), pays "Victor Kristensen" on 31 May: 119 days to Feb, 1 day to Jun → **June**.
   - Ida Johansen pays by name on 1 Nov, 28 Nov, 31 Mar, 1 May, 1 Oct → closes Nov, Dec, Apr, May, Oct. The other 7 months stay late until step 2 handles her "Ida" payments.
4. **Result.** A map `paymentId → invoiceId` (e.g. `PAY-0075 → INV-0409`). The debt calculation then counts these exactly like payments with an invoice number, tagged `matchedBy: "name"` so the UI can label them.

All of this is one pure function in `src/domain/matching.ts` — no DB, no UI — so each step above has its own test.

## Expected effect (as of 13 Oct 2026, grace 7 days)

- 36 payments matched, 15 tenants affected.
- Late tenants 61 → 56, outstanding 1.542.050 → 1.194.850 kr.
- The 8 "never use the invoice number" tenants still look late for most months: most of their payments say "Kasper", "husleje schmidt", … — that is step 2.

## Code

- `src/domain/matching.ts` (pure): `normalizeName`, `matchPaymentsByFullName(invoices, payments)` → `{ paymentId → invoiceId }`.
- `src/domain/debt.ts`: `computeOpenInvoices` counts linked payments **and** name-matched ones. Unlinked payments that don't match stay ignored.
- `InvoicePayment` gets `matchedBy: "invoice" | "name"` and `reference`.
- UI: a name-matched payment is labelled in the expanded row — `1 Nov · 8.900 kr · matched by name "Ida Johansen"` — so Sarah can see why the invoice counts as paid.

## Tests (`matching.test.ts`, `debt.test.ts`)

- exact full name → matched; case, extra spaces, NFC vs. NFD "ø" → matched
- first name only, surname only, "husleje Ida Johansen", empty → not matched
- name shared by two tenants → not matched
- picks the open invoice closest to the booking date (Victor: February + June, paid 31 May → June)
- skips invoices already paid in full; two payments for the same tenant go to two invoices
- payments with an invoice number are untouched
- debt: a name-matched payment closes the invoice like a linked one; UI shows "matched by name"

## Steps

1. `matching.ts` + tests
2. Wire into `computeOpenInvoices`, extend `InvoicePayment` + tests
3. Label in the invoice row + UI test
4. Check the numbers in the browser (56 tenants, 1.194.850 kr)
