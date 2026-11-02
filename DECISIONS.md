# Decisions

Sarah asked for "a page with the late tenants where I can tick the ones I've already emailed, so Jonas sees it too". Her message has two problems in it: she and Jonas email the **same tenant twice**, and they email tenants who **already paid**. Everything below is judged against those two.

## Priorities (2 hours)

1. A working user flow
2. Corner cases
3. Tests and code quality
4. Data flow and hosting

When about 35 minutes were left, the options were corner cases, hosting, a way to load new data, and reminders. I picked corner cases (payments without an invoice number), because saving Sarah from emailing people who already paid saves her the most time.

## Key decisions

- **UI on mocks first, backend after** — the request is about how Sarah works; the backend is built for an agreed page. Cost: mocks thrown away.
- **Row = tenant, mark = invoice** — Sarah emails a person about specific debt; a newly overdue month shows as not emailed. Cost: one tick per invoice ("Mark all emailed" helps).
- **Delta 7 days, editable** — transfers take days; 89 payments arrive 1–7 days late. Cost: lists can differ per browser.
- **"Today" = latest bank booking** — the data can only speak for the export date. Cost: an old export means an old page (shown in the header).
- **First mark wins** — that's the double-email problem; the second person is told. Cost: a wrong mark must be unticked first.
- **Refresh on focus + every 30 s, no websockets** — two people. Cost: not instant.
- **Switcher instead of login** — out of scope for two hours. Cost: anyone with the link can act as Sarah.
- **No mark history** — nothing needs it until reminders. Cost: undone marks leave no trace.
- **Unlinked payments: auto only for exact full names, partial names confirmed by Sarah once as a rule, no names ignored** — a wrong match means not chasing a debtor, a missing match means emailing someone who paid. Cost: 16 confirmations; 54 no-name payments stay unmatched.
- **A matched payment pays the closest due date, not the oldest debt** — Victor pays on 31 May for June, not February. Cost: differs from the usual accounting rule; the total is the same.
- **Next.js Server Actions + SQLite instead of NestJS + Postgres** — one page, runs with `npm run dev`; Drizzle keeps Postgres a driver change. Cost: in Rumli this would be a NestJS module.
- **Left out:** hosting, data upload, reminders, sending emails — corner cases saved Sarah more time.

## How I approached it

| Step | What | Commit |
|---|---|---|
| 1 | Understand the data | — |
| 2 | Define the user flow and mock it (UI only, no backend) | [19fb20c](https://github.com/kulich-d/tenant-inquiry-assistant/commit/19fb20cc5cc17f83b8548c62b1d4db17322c966a) |
| 3 | Tests for the flow | [ee8145f](https://github.com/kulich-d/tenant-inquiry-assistant/commit/ee8145fff1e893b068160e2a1c45f97c02c30e67) |
| 4 | Calculate who is late, with a grace period | [d01fc47](https://github.com/kulich-d/tenant-inquiry-assistant/commit/d01fc4766722a43f21730ab85488524c7d17ae06) |
| 5 | Shared "emailed" marks | [193042b](https://github.com/kulich-d/tenant-inquiry-assistant/commit/193042b6ab2cd53b097a4d93a0a8c01d37f8cc27) |
| 6 | Review the flow myself: sort by days overdue | [755b861](https://github.com/kulich-d/tenant-inquiry-assistant/commit/755b861e80000e80747dbf01ed4f1376a888324b) |
| 7 | Corner case: payments without an invoice number, by full name | [8f3679b](https://github.com/kulich-d/tenant-inquiry-assistant/commit/8f3679b340b931f852a2ad9846bb3b4a122216a0) |
| 8 | Show late tenants out of all tenants — how much of the work is automated | [db9ee92](https://github.com/kulich-d/tenant-inquiry-assistant/commit/db9ee92ab0ac9b54ce9578bb1928bfcae782fd66) |
| 9 | Corner case: partial names, human in the loop | [d1d3a35](https://github.com/kulich-d/tenant-inquiry-assistant/commit/d1d3a35f391fbd38ed3b3ea80a30a3374f2550e4) |

Each step was planned before it was built; the plans are in [docs/implementation](docs/implementation/README.md).

## Details

### Data

- **Payments link to invoices by `payment.invoice_id == invoice.id`.** It is set only when the tenant typed the invoice number — 139 of 1256 payments have `invoice_id = null`. The first version ignored those on purpose (easy level first) and added them back as a separate step.
- **"Paid" is the sum of all payments for an invoice.** Several tenants pay in two halves.
- **"Today" is the latest bank booking (13 Oct 2026), not the real date.** The page says so ("Bank data as of …"), so it is clear how fresh the numbers are.

### Who is late

- **One row per tenant, not per invoice.** Sarah emails a person; the row shows the total owed, and expanding it shows each invoice and the payments made against it.
- **Grace period ("delta"), default 7 days, editable on the page.** Late means more than *N* days past due: 7 days with *N* = 7 is not late, 8 is. Bank transfers take a few days, and 89 payments arrive 1–7 days after the due date — emailing those tenants would annoy people who pay normally.
  Questions for Sarah: how long does a transfer take to show up? Can the bank tell us when it was sent? Should the delta be predicted from each tenant's past payments?
- **Status: "Late" if any invoice has no payment at all, "Partly paid" otherwise.** The email is different: "you haven't paid" vs. "3.600 kr is still missing".
- **Sorting by days overdue only.** I also tried sorting by how many invoices were emailed about; it was confusing to read and didn't help decide who to email, so I removed it.

### "Emailed" marks

- **A mark belongs to an invoice, not to a tenant.** An email is about specific debt. When a new month becomes overdue after an email, it shows as not emailed yet — no separate "when to remind again" logic needed.
- **First mark wins.** If Jonas ticks an invoice Sarah already marked, her mark is kept and he is told "Sarah already emailed about this invoice". This is the double-email case, enforced on the server.
- **No login.** A "You: Sarah / Jonas" switcher, remembered per browser. Login for two people is out of scope for a test.
- **No websockets.** Too much for two people. The page refreshes when the tab gets focus and every 30 s.
- **Ticks show at once** (`useOptimistic`) and roll back with a message if saving fails.
- **No history.** Unticking deletes the mark. History is only needed once there are reminders.
- **"Mark all emailed"** per tenant — one email usually covers every overdue month.

### Payments without an invoice number

In real life I would first ask Sarah how she handles these today, and build something that mimics it. For the test I made assumptions, split by how sure we can be:

| Reference looks like | Payments | What happens |
|---|---|---|
| Exactly the tenant's full name ("Ida Johansen") | 36 | Counted automatically, labelled "matched by name" |
| Part of a name ("Alma", "husleje schmidt") | 49 | **Human in the loop:** suggested in "Payments to review". Sarah confirms once — "this signature and amount is this tenant" — and the rule applies to every such payment, past and future |
| No name ("rent", "husleje", empty) | 54 | Not matched |

- **Suggestions:** candidates are tenants whose rent equals the amount and whose name contains the words. If one candidate still owes something and the other doesn't, that one is suggested; otherwise Sarah chooses (e.g. Louise vs. Laura Hansen). The server re-checks every confirmation.
- **Which month a matched payment pays:** the still-owed invoice with the due date closest to the payment date. "Oldest debt first" would get it wrong: Victor Kristensen owes February and June and pays on 31 May — that is June's rent.
- **Tenants who might have sent an unconfirmed payment** show "Possibly paid · N to review" — a warning before anyone emails them.

Effect (as of 13 Oct 2026, delta 7): outstanding goes from 1.542.050 kr (invoice numbers only) to 1.194.850 kr (full names) to 743.850 kr (all 16 name patterns confirmed).

## Tech stack

Rumli's stack, minus what doesn't pay off in two hours.

| Layer | Choice | Why |
|---|---|---|
| UI | Next.js + React + Shadcn + Tailwind | Rumli's frontend. Shadcn has Table, Checkbox and Select ready, so the UI comes together fast |
| Backend | Server Actions in Next.js, no NestJS | One page and two actions don't need a separate service. In Rumli's system this would be a NestJS module |
| DB | Drizzle + SQLite (libsql) | Drizzle is Rumli's ORM. SQLite runs with `npm run dev` — no Docker or Postgres for the reviewer. Moving to Postgres is a driver change in Drizzle |
| Data | Invoices and payments are read from the JSON exports; the DB holds only what we create: emailed marks and confirmed payment rules | The exports are the bank's and billing's data; we don't change them |
| Tests | Vitest + Testing Library | The logic (paid, partly paid, late, delta boundary, duplicates, matching) is pure functions; the UI is tested through clicks |

## Known limits

- **56 of 100 tenants still show as late** even with every name pattern confirmed. Most of them have a month paid with a no-name transfer. Only 9 have no unmatched payment that could be theirs. The bank export has no payer account number; with it, most of the rest could be matched.
- **The duplicate invoice INV-0618** (Lars Kowalski, March 2026, invoiced twice) is shown as unpaid. It's a billing error, not debt.
- **Runs on one machine.** For Sarah to send Jonas a link it needs hosting (Vercel), a hosted database (Turso works with the same libsql client plus an auth token), and a login.
- **New exports need a rebuild.** The JSON is bundled at build time.

## Future

- [ ] "Payments to review": show the invoice the payment would pay (due date, amount) so Sarah decides with more context
- [ ] Upload button for new invoices and payments
- [ ] Reminders after reminders — ask Sarah about her current flow first
- [ ] Fully automated flow with AI: tenants' emails, automatic reminder emails with a generated message and automatic ticks, so Sarah only writes to tenants where it's unclear whether they paid; more personal messages
- [ ] Better human in the loop by predicting tenant behaviour, e.g. the same tenant pays on the 25th with "Johan rent" — use date and habit, not only name and amount
- [ ] Use the payer's bank account number, if the bank export can include it
- [ ] Integrate into the existing Rumli platform (if it makes sense)
- [ ] More on testing: AI-assisted QA
- [ ] Ask Sarah whether she also wants to see the tenants who are fine
