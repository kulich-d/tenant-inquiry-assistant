# Late rent

A page for Sarah and Jonas at Rumli: who is late on rent, how much they owe, and who has already emailed them — so the two of them stop emailing the same tenant twice, or a tenant who has already paid.

Trade-offs and what was left out are in [DECISIONS.md](DECISIONS.md); the plan behind each step is in [docs/implementation](docs/implementation/README.md).

## Quick start

Requires Node.js 22.22+, 24.15+ or 26.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The SQLite database (`data/late-rent.db`) is created and migrated on first request — no setup.

### Try it as Sarah and Jonas

Open the page twice with separate browser storage: http://localhost:3000 and http://jonas.localhost:3000 (Chrome, Firefox), or a normal and a private window. Pick "Sarah" in one and "Jonas" in the other ("You:" in the header): a mark made in one appears in the other when you switch back to it (or within 30 s).

## What the page does

- **Late list.** Every tenant with an invoice more than *N* days past due and not fully paid. *N* is the "Late after … days" field (default 7, remembered per browser). Data is as of the latest bank booking (13 Oct 2026).
- **Payments per invoice.** Expand a tenant to see each overdue invoice and the payments made against it. Payments matched by name are labelled as such.
- **Emailed marks.** Tick an invoice (or "Mark all emailed") after emailing the tenant. Marks are shared through the database; if two people mark the same invoice, the first mark is kept and the second person is told.
- **Matching payments to invoices**, in three tiers:
  1. the tenant typed the invoice number (`invoice_id` is set) → counted;
  2. no invoice number, but the reference is exactly the tenant's full name ("Ida Johansen") → counted automatically;
  3. no invoice number, the reference is part of a name ("Alma", "husleje schmidt") → suggested in the **Payments to review** panel. Confirming once creates a rule (signature + amount → tenant) that covers every payment signed the same way. Tenants who might have sent such payments show "Possibly paid · N to review".

  Payments with no name at all ("rent", "husleje", empty) are not matched.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm test` | All tests (Vitest + Testing Library), once |
| `npm run test:watch` | Tests in watch mode |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | Production build / server |
| `npm run db:generate` | New migration after changing `src/server/db/schema.ts` |

## Project structure

```
data/                     challenge exports (read-only) + local SQLite file
docs/implementation/      the plan written before each step, in build order
drizzle/                  SQL migrations, applied automatically
src/
  domain/                 pure logic, no I/O — debt, matching, emailed marks, sorting, ledger snapshot
  server/                 server-only: JSON loading (zod), DB (Drizzle + libsql), repositories
  app/
    page.tsx              server component: reads emailed marks and rules fresh on every request
    actions.ts            Server Actions: emailed marks, payment rules
  components/late-rent/   client UI: table, rows, review panel, header controls
  test/                   shared test fixture
```

Tests sit next to the code they cover (`*.test.ts[x]`).

## Configuration

- `DATABASE_URL` — libsql URL, default `file:data/late-rent.db`. A hosted libsql database (e.g. Turso, `libsql://…`) also needs its auth token passed to `createClient` in `src/server/db/index.ts` — not wired up yet.
- Reset local state (marks and rules): stop the server and delete `data/late-rent.db*`.
- New bank or invoice exports: replace the files in `data/`. The dev server picks them up on reload; for production run `npm run build` again — the exports are bundled and parsed at build time.

## Stack

Next.js 16 (App Router, Server Components, Server Actions) · React 19 · TypeScript (strict) · Tailwind + Shadcn (Base UI) · Drizzle ORM + SQLite (libsql) · zod · Vitest + Testing Library.
