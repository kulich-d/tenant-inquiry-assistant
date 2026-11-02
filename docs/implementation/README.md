# Implementation details

The plans written before each step, in the order they were built. Each one was agreed before coding and kept as written, so later steps can replace earlier choices — the current state is the code and the top-level [README](../../README.md).

| # | Plan | What it added | Replaced later by |
|---|---|---|---|
| 1 | [Late rent page](01-late-rent-page.md) | User flow, table UI, per-invoice "emailed" checkboxes — frontend only, everything mocked | 2 (real debt calculation), 3 (real storage) |
| 2 | [Debt calculation](02-debt-calculation.md) | Late list computed from invoices + payments; editable grace period; payments per invoice | — |
| 3 | [Shared emailed marks](03-emailed-marks.md) | SQLite + Drizzle, Server Actions, "first mark wins", optimistic ticks, auto-refresh | — |
| 4 | [Full-name matching](04-full-name-matching.md) | Payments without an invoice number whose reference is a tenant's full name count automatically | 5 generalises the matcher |
| 5 | [Partial name matching](05-partial-name-matching.md) | "Payments to review": suggestions for name-part references, confirmed once as rules | — |
