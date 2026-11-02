/**
 * Late rent table — Sarah's flow, driven through the UI like a user, against a fake server.
 *
 * Scenarios:
 * - Every late tenant is listed with their contact status (Nobody yet / 1 of 2 invoices).
 * - Expand a tenant → each overdue invoice shows its payments, or "No payments".
 * - Tick an invoice → "Sarah · 2 Nov" shows at once, before the server answers; the server is asked to store it.
 * - The save fails → the tick rolls back and an error is shown.
 * - Jonas already marked it (Sarah's page was stale) → his mark is shown and Sarah is told; nothing is overwritten.
 * - Untick → the mark is removed on the server and the summary goes back.
 * - "Mark all emailed" marks every invoice of the tenant not marked yet, in one request.
 * - The mark is attributed to whoever is selected in the "You:" switcher (Jonas).
 * - Sorting: opens by days overdue (most first); clicking Status flips to least first.
 * - An expanded tenant can be collapsed again; with nobody late, an empty state is shown.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { markEmailedAction, unmarkEmailedAction, type MarkEmailedResult } from "@/app/actions";
import { applyContactChange, type ContactsByInvoice } from "@/domain/contacts";
import { groupLateTenants } from "@/domain/debt";
import { TEST_SNAPSHOT } from "@/test/ledgerFixture";

import { LateRentTable } from "./late-rent-table";

vi.mock("@/app/actions", () => ({ markEmailedAction: vi.fn(), unmarkEmailedAction: vi.fn() }));

const NOW = new Date("2026-11-02T09:30:00.000Z");
const DEBTS = groupLateTenants(TEST_SNAPSHOT.openInvoices, 7);
const JONAS_AUG = { invoiceId: "INV-0683", sentBy: "Jonas", sentAt: "2026-08-12T13:40:00.000Z" } as const;

// --- Fake server: actions write here; the harness re-renders with it, like `refresh()` does. ---

let server: ContactsByInvoice;
let syncFromServer: () => void = () => {};

function Harness({ initial }: { initial: ContactsByInvoice }) {
  const [contacts, setContacts] = useState(initial);
  useEffect(() => {
    syncFromServer = () => setContacts(server);
  }, []);
  return <LateRentTable debts={DEBTS} contacts={contacts} />;
}

function renderTable({ page = server }: { page?: ContactsByInvoice } = {}) {
  render(<Harness initial={page} />);
  return userEvent.setup();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  server = { [JONAS_AUG.invoiceId]: JONAS_AUG };

  vi.mocked(markEmailedAction).mockImplementation(async ({ invoiceIds, sentBy }) => {
    const alreadyMarked = invoiceIds.flatMap((id) => server[id] ?? []);
    server = applyContactChange(server, { type: "mark", invoiceIds, sentBy, sentAt: NOW.toISOString() });
    syncFromServer();
    return { ok: true, stored: invoiceIds.map((id) => server[id]!), alreadyMarked };
  });
  vi.mocked(unmarkEmailedAction).mockImplementation(async ({ invoiceId }) => {
    server = applyContactChange(server, { type: "unmark", invoiceIds: [invoiceId] });
    syncFromServer();
    return { ok: true };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const tenantRow = (name: string) => screen.getByText(name).closest("tr")!;
const tenantOrder = () =>
  screen
    .getAllByRole("button", { name: /^Show invoices for/ })
    .map((b) => b.getAttribute("aria-label")!.replace("Show invoices for ", ""));
const columnHeader = (name: string) => screen.getByRole("columnheader", { name });
const expand = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole("button", { name: `Show invoices for ${name}` }));

describe("LateRentTable", () => {
  it("lists every late tenant with their contact status", () => {
    renderTable();

    expect(screen.getAllByRole("button", { name: /^Show invoices for/ })).toHaveLength(DEBTS.length);
    expect(within(tenantRow("Rasmus Pedersen")).getByText("1 of 2 invoices")).toBeInTheDocument();
    expect(within(tenantRow("Line Bach")).getByText("Nobody yet")).toBeInTheDocument();
  });

  it("shows the payments made against each overdue invoice", async () => {
    const user = renderTable();

    await expand(user, "Clara Nielsen");
    await expand(user, "Line Bach");

    const september = screen.getByRole("list", { name: "Payments for Sept 2026" });
    expect(within(september).getByText("31 Aug · 6.950 kr")).toBeInTheDocument();
    const october = screen.getByRole("list", { name: "Payments for Oct 2026" });
    expect(within(october).getByText("No payments")).toBeInTheDocument();
  });

  it("shows a tick at once, before the server answers", async () => {
    let answer!: (result: MarkEmailedResult) => void;
    vi.mocked(markEmailedAction).mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const user = renderTable();

    await expand(user, "Rasmus Pedersen");
    await user.click(screen.getByRole("checkbox", { name: "Emailed about Oct 2026" }));

    expect(screen.getByRole("checkbox", { name: "Emailed about Oct 2026" })).toBeChecked();
    expect(screen.getByText("Sarah · 2 Nov")).toBeInTheDocument();
    expect(markEmailedAction).toHaveBeenCalledWith({ invoiceIds: ["INV-0685"], sentBy: "Sarah" });
    answer({ ok: true, stored: [], alreadyMarked: [] });
  });

  it("keeps the tick once the server has stored it", async () => {
    const user = renderTable();

    await expand(user, "Rasmus Pedersen");
    await user.click(screen.getByRole("checkbox", { name: "Emailed about Oct 2026" }));

    expect(await within(tenantRow("Rasmus Pedersen")).findByText("All 2 · last Sarah · 2 Nov")).toBeInTheDocument();
    expect(server["INV-0685"]?.sentBy).toBe("Sarah");
  });

  it("rolls the tick back and shows an error when the save fails", async () => {
    vi.mocked(markEmailedAction).mockResolvedValueOnce({ ok: false, error: "Couldn't save. Try again." });
    const user = renderTable();

    await expand(user, "Line Bach");
    await user.click(screen.getByRole("checkbox", { name: "Emailed about Oct 2026" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
    expect(screen.getByRole("checkbox", { name: "Emailed about Oct 2026" })).not.toBeChecked();
    expect(within(tenantRow("Line Bach")).getByText("Nobody yet")).toBeInTheDocument();
  });

  it("keeps Jonas's mark and tells Sarah when he got there first", async () => {
    const jonasOct = { invoiceId: "INV-0168", sentBy: "Jonas", sentAt: "2026-11-01T08:00:00.000Z" } as const;
    const stalePage = server;
    server = { ...server, [jonasOct.invoiceId]: jonasOct };
    const user = renderTable({ page: stalePage });

    await expand(user, "Line Bach");
    await user.click(screen.getByRole("checkbox", { name: "Emailed about Oct 2026" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Jonas already emailed about this invoice (1 Nov). Their mark was kept.",
    );
    expect(within(tenantRow("Line Bach")).getByText("Jonas · 1 Nov")).toBeInTheDocument();
  });

  it("removes the mark on the server when unticked", async () => {
    const user = renderTable();

    await expand(user, "Rasmus Pedersen");
    await user.click(screen.getByRole("checkbox", { name: "Emailed about Aug 2026" }));

    expect(unmarkEmailedAction).toHaveBeenCalledWith({ invoiceId: "INV-0683" });
    expect(await within(tenantRow("Rasmus Pedersen")).findByText("Nobody yet")).toBeInTheDocument();
  });

  it("marks every not-yet-emailed invoice of a tenant in one request", async () => {
    const user = renderTable();

    await user.click(screen.getByRole("button", { name: "Mark Rasmus Pedersen as emailed" }));

    expect(markEmailedAction).toHaveBeenCalledExactlyOnceWith({ invoiceIds: ["INV-0685"], sentBy: "Sarah" });
    expect(await within(tenantRow("Rasmus Pedersen")).findByText("All 2 · last Sarah · 2 Nov")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Rasmus Pedersen as emailed" })).not.toBeInTheDocument();
  });

  it("attributes the mark to whoever is selected in the switcher", async () => {
    window.localStorage.setItem("late-rent:user", "Jonas");
    const user = renderTable();

    await user.click(screen.getByRole("button", { name: "Mark Line Bach as emailed" }));

    expect(markEmailedAction).toHaveBeenCalledWith({ invoiceIds: ["INV-0168"], sentBy: "Jonas" });
    expect(await within(tenantRow("Line Bach")).findByText("Jonas · 2 Nov")).toBeInTheDocument();
  });

  it("opens sorted by days overdue, most overdue first", () => {
    renderTable();

    expect(tenantOrder()).toEqual(["Rasmus Pedersen", "Clara Nielsen", "Line Bach"]);
    expect(columnHeader("Status")).toHaveAttribute("aria-sort", "descending");
  });

  it("flips the Status sort to least overdue first", async () => {
    const user = renderTable();

    await user.click(screen.getByRole("button", { name: "Status" }));

    expect(tenantOrder()).toEqual(["Line Bach", "Clara Nielsen", "Rasmus Pedersen"]);
    expect(columnHeader("Status")).toHaveAttribute("aria-sort", "ascending");
  });

  it("collapses a tenant's invoices again", async () => {
    const user = renderTable();

    await expand(user, "Rasmus Pedersen");
    await user.click(screen.getByRole("button", { name: "Hide invoices for Rasmus Pedersen" }));

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows an empty state when nobody is late", () => {
    render(<LateRentTable debts={[]} contacts={{}} />);

    expect(screen.getByText("Everyone is paid up.")).toBeInTheDocument();
  });
});
