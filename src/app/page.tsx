import { connection } from "next/server";
import { Suspense } from "react";

import { AutoRefresh } from "@/components/late-rent/auto-refresh";
import { LateRentView } from "@/components/late-rent/late-rent-view";
import type { LedgerSnapshot } from "@/domain/types";
import { listContacts } from "@/server/contacts";
import { getDb } from "@/server/db/client";
import { getLedgerSnapshot } from "@/server/ledger";

export default async function LateRentPage() {
  const snapshot = await getLedgerSnapshot();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="py-12 text-center text-muted-foreground">Loading late rent…</p>}>
        <LateRentWithContacts snapshot={snapshot} />
      </Suspense>
      <AutoRefresh />
    </main>
  );
}

/** Emailed marks change all the time, so they are read fresh on every request (never prerendered). */
async function LateRentWithContacts({ snapshot }: { snapshot: LedgerSnapshot }) {
  await connection();
  const contacts = await listContacts(await getDb());
  return <LateRentView snapshot={snapshot} contacts={contacts} />;
}
