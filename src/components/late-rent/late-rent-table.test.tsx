/**
 * Late rent table — Sarah's flow, driven through the UI like a user.
 *
 * Scenarios:
 * - Every late tenant is listed with their contact status (Nobody yet / 1 of 2 invoices).
 * - Expand a tenant → each overdue invoice shows its payments, or "No payments".
 * - Expand a tenant → tick an invoice → it shows "Sarah · 2 Nov" and the tenant summary updates.
 * - Unticking an invoice removes the mark and the summary goes back.
 * - The mark is attributed to whoever is selected in the "You:" switcher (Jonas).
 * - An expanded tenant can be collapsed again.
 * - With nobody late, an empty state is shown.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ContactsByInvoice } from "@/domain/contacts";
import { groupLateTenants } from "@/domain/debt";
import { createLocalStorageContactsStore } from "@/mocks/contactsStore";
import { TEST_SNAPSHOT } from "@/test/ledgerFixture";

import { LateRentTable } from "./late-rent-table";
import { ContactsStoreContext } from "./stores";

const NOW = new Date("2026-11-02T09:30:00.000Z");
const SEED: ContactsByInvoice = {
  "INV-0683": { invoiceId: "INV-0683", sentBy: "Jonas", sentAt: "2026-08-12T13:40:00.000Z" },
};
const DEBTS = groupLateTenants(TEST_SNAPSHOT.openInvoices, 7);

function renderTable() {
  const store = createLocalStorageContactsStore("test:contacts", SEED, () => NOW);
  render(
    <ContactsStoreContext.Provider value={store}>
      <LateRentTable debts={DEBTS} />
    </ContactsStoreContext.Provider>,
  );
  return { user: userEvent.setup() };
}

const tenantRow = (name: string) => screen.getByText(name).closest("tr")!;

describe("LateRentTable", () => {
  it("lists every late tenant with their contact status", () => {
    renderTable();

    expect(screen.getAllByRole("button", { name: /^Show invoices for/ })).toHaveLength(DEBTS.length);
    expect(within(tenantRow("Rasmus Pedersen")).getByText("1 of 2 invoices")).toBeInTheDocument();
    expect(within(tenantRow("Line Bach")).getByText("Nobody yet")).toBeInTheDocument();
  });

  it("shows the payments made against each overdue invoice", async () => {
    const { user } = renderTable();

    await user.click(screen.getByRole("button", { name: "Show invoices for Clara Nielsen" }));
    await user.click(screen.getByRole("button", { name: "Show invoices for Line Bach" }));

    const september = screen.getByRole("list", { name: "Payments for Sept 2026" });
    expect(within(september).getByText("31 Aug · 6.950 kr")).toBeInTheDocument();
    const october = screen.getByRole("list", { name: "Payments for Oct 2026" });
    expect(within(october).getByText("No payments")).toBeInTheDocument();
  });

  it("marks an invoice as emailed by the current user and updates the summary", async () => {
    const { user } = renderTable();

    await user.click(screen.getByRole("button", { name: "Show invoices for Rasmus Pedersen" }));
    const october = screen.getByRole("checkbox", { name: "Emailed about Oct 2026" });
    expect(october).not.toBeChecked();

    await user.click(october);

    expect(october).toBeChecked();
    expect(screen.getByText("Sarah · 2 Nov")).toBeInTheDocument();
    expect(within(tenantRow("Rasmus Pedersen")).getByText("All 2 · last Sarah · 2 Nov")).toBeInTheDocument();
  });

  it("unticking removes the mark", async () => {
    const { user } = renderTable();

    await user.click(screen.getByRole("button", { name: "Show invoices for Rasmus Pedersen" }));
    await user.click(screen.getByRole("checkbox", { name: "Emailed about Aug 2026" }));

    expect(within(tenantRow("Rasmus Pedersen")).getByText("Nobody yet")).toBeInTheDocument();
  });

  it("attributes the mark to whoever is selected in the switcher", async () => {
    window.localStorage.setItem("late-rent:user", "Jonas");
    const { user } = renderTable();

    await user.click(screen.getByRole("button", { name: "Show invoices for Line Bach" }));
    await user.click(screen.getByRole("checkbox", { name: "Emailed about Oct 2026" }));

    expect(within(tenantRow("Line Bach")).getByText("Jonas · 2 Nov")).toBeInTheDocument();
  });

  it("collapses a tenant's invoices again", async () => {
    const { user } = renderTable();

    await user.click(screen.getByRole("button", { name: "Show invoices for Rasmus Pedersen" }));
    await user.click(screen.getByRole("button", { name: "Hide invoices for Rasmus Pedersen" }));

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows an empty state when nobody is late", () => {
    render(<LateRentTable debts={[]} />);

    expect(screen.getByText("Everyone is paid up.")).toBeInTheDocument();
  });
});
