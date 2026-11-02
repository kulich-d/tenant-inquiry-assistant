import { LateRentTable } from "@/components/late-rent/late-rent-table";
import { UserSwitcher } from "@/components/late-rent/user-switcher";
import { formatDate, formatKr } from "@/lib/format";
import { getLateTenants } from "@/mocks/lateTenantsApi";

export default async function LateRentPage() {
  const { asOf, graceDays, tenants } = await getLateTenants();
  const totalOwed = tenants.reduce((sum, t) => sum + t.totalRemaining, 0);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Late rent</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bank data as of {formatDate(asOf)} · invoices more than {graceDays} days overdue
          </p>
          <p className="mt-1 text-sm">
            {tenants.length} tenants · {formatKr(totalOwed)} outstanding
          </p>
        </div>
        <UserSwitcher />
      </header>
      <LateRentTable debts={tenants} />
    </main>
  );
}
