// @vitest-environment jsdom
/**
 * A rejected clearance number must be correctable without a reload.
 *
 * The page renders the production DocumentsPage through the real ApiClient
 * transport; only the edge HTTP responses are controlled. The fetch stub goes in
 * before the page is imported because the client binds `fetch` at module scope.
 */
import React from "react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const APP = "33333333-3333-4333-8333-333333333333";
const NUMBER = "A000000000000ABCD";

let clearance: { state: string; code: string | null } = { state: "NUMBER_REQUIRED", code: null };
const checklist = () => ({
  applicationId: APP,
  complete: false,
  items: [{ documentType: "CRIMINAL_RECORD_CERTIFICATE", satisfaction: "AWAITING_REGISTRY", registry: "RIB", clearance }],
});
const reply = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string, _init?: RequestInit) => {
    if (String(url).includes("clearance-certificate")) {
      // The verification row is written later by a consumer, so the next read still looks unchanged.
      return reply(202, { status: "ACCEPTED" });
    }
    return reply(200, checklist());
  }),
);

const { default: DocumentsPage } = await import("./index.js");
const { i18n } = await import("@usrp/i18n");

afterEach(cleanup);
afterAll(() => vi.unstubAllGlobals());

describe("clearance number correction", () => {
  it("offers the field again when the sent number is refused", async () => {
    await i18n.changeLanguage("en");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/applications/${APP}/documents`]}>
          <Routes><Route path="/applications/:applicationId/documents" element={<DocumentsPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox"), NUMBER);
    await user.click(screen.getByRole("button", { name: /send the number/i }));
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());

    clearance = { state: "CORRECTION_NEEDED", code: "CERTIFICATE_WRONG_TYPE" };
    expect(await screen.findByRole("textbox", {}, { timeout: 8_000 })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  }, 15_000);
});
