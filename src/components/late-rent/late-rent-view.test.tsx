/**
 * Late rent page — grace period and summary.
 *
 * Scenarios:
 * - Default grace period is 7 days: tenants 12+ days overdue are listed, the summary counts them.
 * - Raising the grace period to 12 days drops tenants who are exactly 12 days overdue; the summary follows.
 * - Lowering it brings them back.
 * - The chosen grace period is remembered after a reload.
 * - An invalid value (over 60) shows an error and keeps the current list.
 * - The as-of date of the bank data is shown.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TEST_SNAPSHOT } from "@/test/ledgerFixture";

import { LateRentView } from "./late-rent-view";

vi.mock("@/app/actions", () => ({ markEmailedAction: vi.fn(), unmarkEmailedAction: vi.fn() }));

function renderView() {
  const result = render(<LateRentView snapshot={TEST_SNAPSHOT} contacts={{}} />);
  return { ...result, user: userEvent.setup(), input: screen.getByLabelText("Late after") };
}

const listed = (name: string) => screen.queryByRole("button", { name: `Show invoices for ${name}` });

describe("LateRentView", () => {
  it("lists tenants past the default 7-day grace period", () => {
    renderView();

    expect(screen.getByLabelText("Late after")).toHaveValue(7);
    expect(screen.getByText("3 tenants · 38.075 kr outstanding")).toBeInTheDocument();
    expect(listed("Line Bach")).toBeInTheDocument();
    expect(listed("Sara Andersen")).not.toBeInTheDocument();
  });

  it("updates the list and summary when the grace period changes", async () => {
    const { user, input } = renderView();

    await user.clear(input);
    await user.type(input, "12");

    expect(listed("Line Bach")).not.toBeInTheDocument();
    expect(listed("Rasmus Pedersen")).toBeInTheDocument(); // August is still 73 days late
    expect(screen.getByText("2 tenants · 15.275 kr outstanding")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "3");

    expect(listed("Line Bach")).toBeInTheDocument();
  });

  it("remembers the grace period after a reload", async () => {
    const { user, input, unmount } = renderView();
    await user.clear(input);
    await user.type(input, "12");
    unmount();

    renderView();

    expect(screen.getByLabelText("Late after")).toHaveValue(12);
    expect(listed("Line Bach")).not.toBeInTheDocument();
  });

  it("rejects a grace period over 60 days and keeps the current list", async () => {
    const { user, input } = renderView();

    await user.clear(input);
    await user.type(input, "61");

    expect(screen.getByText("Enter whole days from 0 to 60")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    // The last valid value ("6", typed on the way to "61") still applies.
    expect(listed("Line Bach")).toBeInTheDocument();
    expect(window.localStorage.getItem("late-rent:grace-days")).toBe("6");
  });

  it("shows the date the bank data is valid for", () => {
    renderView();

    expect(screen.getByText("Bank data as of 13 Oct 2026")).toBeInTheDocument();
  });
});
