# Plan — partial name matching, confirmed by Sarah (human in the loop)

## Goal

Payments signed with only a first name or surname ("Alma", "husleje schmidt") are almost certainly from a known tenant, but not certain enough to apply automatically.
The page suggests who paid; Sarah confirms once; the confirmation becomes a rule that applies to every payment with the same signature — past and future.

Out of scope: payments with no name at all ("rent", "husleje", empty, "2026-02 rent"), half-rent payments, and "this is not that tenant" rejections.

## What the data says (after full-name matching)

- 49 payments are signed with a name part. They fall into **16 patterns** (signature + amount), e.g. `"alma" · 8.500 kr` × 5.
- 13 patterns have one possible tenant. 3 have two:
  - `"alma"` · 8.500 → Alma Andersen / Alma Hassan (owes nothing) → suggest Alma Andersen
  - `"sørensen"` · 11.000 → Piotr Sørensen / Magnus Sørensen (owes nothing) → suggest Piotr
  - `"hansen"` · 7.900 → Louise Hansen / Laura Hansen → Sarah chooses
- If Sarah confirms all 16: outstanding 1.194.850 → 743.850 kr. Late tenants stay 56 — the habitual tenants still have months paid with "rent"/"husleje" (out of scope).

## Rules

- **Signature** = reference, normalized like full names (NFC, lower case, whitespace), with filler words (`husleje`, `leje`, `rent`) and period tokens (`2026-02`) removed. `"husleje Schmidt"` → `"schmidt"`. Empty signature → not a name, out of scope.
- **Pattern** = signature + amount.
- **Candidates** = tenants whose rent equals the amount and whose full name contains every word of the signature.
- **Suggested tenant** = the only candidate, or the only candidate who still owes something. Otherwise no suggestion: Sarah picks.
- **Confirmed rule** = pattern → tenant, stored with who confirmed it and when. Its payments are allocated exactly like full-name matches (still-owed invoice with the closest due date).
- A pattern that is confirmed is no longer suggested. Undo deletes the rule and the payments go back to "to review".

## Design

- **DB**: table `payment_rules` — `signature`, `amount` (PK together), `tenant_id`, `confirmed_by`, `confirmed_at`. Drizzle migration like `contacts`.
- **Domain** (`src/domain/matching.ts`, pure):
  - `signature(reference)`
  - `matchUnlinkedPayments(invoices, payments, rules)` — replaces `matchPaymentsByFullName`: resolves the tenant by full name **or** confirmed rule, then the same allocation. Tag `matchedBy: "name" | "confirmed"`.
  - `findSuggestions(invoices, payments, rules)` → per pattern: payments, candidates (with "owes something"), suggested tenant if any.
- **Server**: invoices/payments are still parsed once and cached; open invoices and suggestions are computed per request (they depend on rules), next to the emailed marks inside `<Suspense>`.
- **Actions**: `confirmRuleAction({ signature, amount, tenantId, confirmedBy })` — re-checks on the server that the tenant is a candidate for that pattern; `undoRuleAction({ signature, amount })`. zod-validated, typed results, `refresh()`.

## UI

- **"Payments to review"** panel above the table (collapsible, shows the count):
  `"Alma" · 8.500 kr · 5 payments (5 Nov, 4 Jan, …)` → **Suggested: Alma Andersen** [Confirm] · or pick: [Alma Hassan]
  `"hansen" · 7.900 kr · 3 payments` → pick: [Louise Hansen] [Laura Hansen]
  After confirming, the pattern leaves the list and the tenants' debts update.
- **Tenant row**: a "Possibly paid · N payments to review" badge when the tenant is a candidate in an unconfirmed pattern — a warning before emailing.
- **Invoice row**: a confirmed payment is labelled `confirmed by Sarah · "Alma"`.
- **Confirmed rules**: small list at the bottom of the panel, each with Undo.

## Tests

- `signature`: strips filler and period tokens; empty for "rent", "husleje", "".
- `findSuggestions`: one candidate → suggested; two, one owes nothing → suggested; two who both owe → no suggestion; amount must equal rent; confirmed patterns are not suggested; full-name payments are not suggested.
- `matchUnlinkedPayments`: confirmed rule applies to all payments of the pattern; same allocation as full name; undo (no rule) → not applied.
- Repository: confirm, undo, confirming an existing rule keeps the first (like emailed marks).
- Actions: tenant who is not a candidate → rejected; invalid input → rejected.
- UI: confirm suggested / pick a candidate → action called, panel updates; badge on candidate rows; undo.

## Steps

1. `signature`, `findSuggestions`, `matchUnlinkedPayments` + tests
2. `payment_rules` table, migration, repository + tests
3. Actions + tests
4. Page: per-request open invoices + suggestions
5. UI: review panel, badge, invoice label, undo + tests
6. Check in the browser: confirm all 16 → 743.850 kr
