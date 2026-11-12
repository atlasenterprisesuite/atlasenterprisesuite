import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, it, expect } from "vitest";
import { GoogleWorkspacePage } from "../../apps/web/src/modules/connect/GoogleWorkspacePage";
const mocks = vi.hoisted(() => ({ request: vi.fn(), accounts: vi.fn() }));
vi.mock("../../apps/web/src/lib/googleWorkspaceApi", () => ({
  workspaceRequest: mocks.request,
  loadWorkspaceAccounts: mocks.accounts,
  chooseGoogleSheet: async () => ({ id: "file1", name: "Ledger" }),
}));
vi.mock("../../apps/web/src/lib/atlasSession", () => ({
  getActiveAtlasOrganization: async () => ({ id: "org", role: "owner" }),
  ATLAS_SESSION_EVENT: "atlas-session-changed",
}));
it("selects a file, previews it and imports drafts only after both accounts are chosen", async () => {
  mocks.accounts.mockResolvedValue([
    { id: "debit", account_number: "1000", name: "Bank" },
    { id: "credit", account_number: "4000", name: "Sales" },
  ]);
  mocks.request.mockImplementation(async (action: string) =>
    action === "status"
      ? { connected: true }
      : action === "sheets"
        ? { sheets: [{ id: 0, title: "Ledger" }] }
        : action === "preview"
          ? {
              rows: [
                {
                  rowNumber: 2,
                  reference: "R1",
                  date: "2026-11-11",
                  description: "Sale",
                  amountMinor: 1234,
                  currency: "USD",
                },
              ],
              issues: [],
              fingerprint: "hash",
            }
          : action === "import"
            ? { imported: 1, duplicates: 0 }
            : { accessToken: "test" },
  );
  render(
    <MemoryRouter>
      <GoogleWorkspacePage />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Choose spreadsheet" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Choose spreadsheet" }));
  await screen.findByRole("button", { name: "Preview transactions" });
  fireEvent.click(screen.getByRole("button", { name: "Preview transactions" }));
  await screen.findByText("R1");
  expect(
    screen.getByRole("button", { name: "Import journal drafts" }),
  ).toBeDisabled();
  fireEvent.change(
    screen.getByLabelText("Debit account for positive amounts"),
    { target: { value: "debit" } },
  );
  fireEvent.change(
    screen.getByLabelText("Credit account for positive amounts"),
    { target: { value: "credit" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Import journal drafts" }),
  );
  await screen.findByText(/1 drafts imported/);
  expect(mocks.request).toHaveBeenCalledWith(
    "import",
    expect.objectContaining({
      fileId: "file1",
      sheetTitle: "Ledger",
      fingerprint: "hash",
      debitAccountId: "debit",
      creditAccountId: "credit",
    }),
    "org",
  );
});
