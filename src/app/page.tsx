import { connection } from "next/server";
import { Suspense } from "react";

import { AutoRefresh } from "@/components/late-rent/auto-refresh";
import { LateRentView } from "@/components/late-rent/late-rent-view";
import { buildLedgerSnapshot } from "@/domain/ledger";
import { listEmailedMarks } from "@/server/emailed-marks";
import { getDb } from "@/server/db/client";
import { getLedgerData } from "@/server/ledger";
import { listRules } from "@/server/rules";

export default function LateRentPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="py-12 text-center text-muted-foreground">Loading late rent…</p>}>
        <LateRent />
      </Suspense>
      <AutoRefresh />
    </main>
  );
}

/**
 * Emailed marks and confirmed payment rules change all the time, so they are read fresh on every
 * request (never prerendered). The exports themselves are parsed once and cached.
 */
async function LateRent() {
  await connection();
  const db = await getDb();
  const [data, marks, rules] = await Promise.all([getLedgerData(), listEmailedMarks(db), listRules(db)]);
  return <LateRentView snapshot={buildLedgerSnapshot(data, rules)} marks={marks} />;
}
