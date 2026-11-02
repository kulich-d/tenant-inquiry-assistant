import type { LateTenantsReport } from "@/domain/types";

import { LATE_TENANTS_FIXTURE } from "./lateTenantsFixture";

/** Mock of `GET /late-tenants`. The real backend will build this report from invoices + bank payments. */
export async function getLateTenants(): Promise<LateTenantsReport> {
  return LATE_TENANTS_FIXTURE;
}
