import { LateRentView } from "@/components/late-rent/late-rent-view";
import { getLedgerSnapshot } from "@/server/ledger";

export default function LateRentPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <LateRentView snapshot={getLedgerSnapshot()} />
    </main>
  );
}
