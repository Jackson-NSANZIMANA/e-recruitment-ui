// @vitest-environment jsdom
/**
 * D8 applicant upload — UI proof.
 *
 * WHAT IS REAL HERE, AND WHAT IS NOT. The panel under test is the production
 * component, so this suite runs DocumentsPanel → useUploadMyDocument →
 * uploadMyDocument → the real ApiClient transport → fetch, in a browser-like
 * DOM. Only the edge HTTP RESPONSE is controlled, and every body below is the
 * contract shape from the task's §2: `{ status, documentId, documentType,
 * revision }` on success, `{ error: 'DOCUMENT_REVIEW_CLOSED', reason }` on
 * refusal.
 *
 * WHY THE FETCH STUB IS INSTALLED BEFORE THE PANEL IS IMPORTED. `createApiClient`
 * binds the global `fetch` ONCE, when api-client's module factory runs, and the
 * app builds its client at module scope. Stubbing `fetch` after importing the
 * panel therefore leaves the client holding the real one, every request fails as
 * a network error, and every assertion is satisfied by the GENERIC error text —
 * a green suite proving nothing. Hence the dynamic import below.
 *
 * WHAT THIS CANNOT PROVE. It does not prove that the backend numbers revisions
 * or that a reviewed document is really refused. That is the backend E2E, which
 * waits on e-recruitment PR #61; a controlled edge response proves only that the
 * UI renders the server's answer truthfully.
 */
import React from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@usrp/i18n";
import en from "@usrp/i18n/locales/en/common.json" with { type: "json" };
import fr from "@usrp/i18n/locales/fr/common.json" with { type: "json" };
import rw from "@usrp/i18n/locales/rw/common.json" with { type: "json" };

const APP = "33333333-3333-4333-8333-333333333333";
const ROUTE = "/edge/v1/me/applications/documents";
/** An internal identifier the citizen must never see. */
const DOCUMENT_ID = "doc-internal-0001";

/** The English copy the assertions are written against, read from the bundle. */
const COPY = en.apply.upload_review_closed;
const GENERIC = en.apply.upload_error;

interface EdgeReply {
  readonly status: number;
  readonly body: unknown;
}

const OK = (revision: number, documentType = "NATIONAL_ID"): EdgeReply => ({
  status: 201,
  body: { status: "UPLOADED", documentId: DOCUMENT_ID, documentType, revision },
});

const NO_REVISION: EdgeReply = {
  status: 201,
  body: { status: "UPLOADED", documentId: DOCUMENT_ID, documentType: "NATIONAL_ID" },
};

/**
 * A 2xx whose `revision` is not a positive safe integer. Every one of these is
 * contract drift rather than a revision: printing it would put invented
 * evidence on an evidence-integrity screen.
 */
const BAD_REVISION = (revision: unknown): EdgeReply => ({
  status: 201,
  body: { status: "UPLOADED", documentId: DOCUMENT_ID, documentType: "NATIONAL_ID", revision },
});

const CLOSED = (reason?: string): EdgeReply => ({
  status: 409,
  body: reason === undefined ? { error: "DOCUMENT_REVIEW_CLOSED" } : { error: "DOCUMENT_REVIEW_CLOSED", reason },
});

let replies: readonly EdgeReply[] = [];
let index = 0;
const urls: string[] = [];

vi.stubGlobal(
  "fetch",
  (url: string, _init: RequestInit): Promise<Response> => {
    urls.push(String(url));
    const reply = replies[Math.min(index, replies.length - 1)]!;
    index += 1;
    return Promise.resolve(
      new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { "content-type": "application/json" },
      }),
    );
  },
);

// Imported AFTER the stub: see the note above.
const { DocumentsPanel } = await import("./index.js");

/** Queue the edge replies the transport will receive, in order. */
function queue(next: readonly EdgeReply[]): void {
  replies = next;
  index = 0;
  urls.length = 0;
}

function renderPanel(): HTMLElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <DocumentsPanel applicationId={APP} agency="RDF" />
    </QueryClientProvider>,
  );
  return container;
}

/** Choose a file and press Upload — the only two citizen actions on this panel. */
async function upload(container: HTMLElement, name: string, label: string = en.apply.upload): Promise<void> {
  const input = container.querySelector("#document-file");
  if (!(input instanceof HTMLInputElement)) throw new Error("the file input is not rendered");
  const user = userEvent.setup();
  await user.upload(input, new File([`%PDF-1.4 ${name}`], name, { type: "application/pdf" }));
  await user.click(screen.getByRole("button", { name: label }));
}

const text = (container: HTMLElement): string => container.textContent ?? "";

/**
 * The success confirmation alone. The document-type picker also displays the
 * selected type, so a "listed once" assertion has to be scoped to the receipt.
 */
const receivedText = (container: HTMLElement): string =>
  container.querySelector('[data-testid="documents-received"]')?.textContent ?? "";

beforeEach(async () => {
  // The language detector reads the host machine; these assertions are about copy.
  await i18n.changeLanguage("en");
  queue([]);
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("D8 upload confirmation", () => {
  it("a first upload shows the revision the server accepted", async () => {
    queue([OK(1)]);
    const container = renderPanel();
    await upload(container, "id-v1.pdf");

    await waitFor(() => expect(text(container)).toContain("National ID (revision 1)"));
    expect(urls).toEqual([ROUTE]);
    // The confirmation says "received" and no more: there is no verdict to show.
    expect(text(container)).toContain(en.apply.upload_ok_title);
  });

  it("replacing a document updates the revision shown for that same type", async () => {
    queue([OK(1), OK(2)]);
    const container = renderPanel();
    await upload(container, "id-v1.pdf");
    await waitFor(() => expect(text(container)).toContain("National ID (revision 1)"));

    await upload(container, "id-v2.pdf");
    await waitFor(() => expect(text(container)).toContain("National ID (revision 2)"));
    // The type is listed ONCE, at its latest revision — not twice, not still at 1.
    const receipt = receivedText(container);
    expect(receipt.match(/National ID/g)?.length).toBe(1);
    expect(receipt).toContain("National ID (revision 2)");
    expect(receipt).not.toContain("revision 1");
    expect(urls).toEqual([ROUTE, ROUTE]);
  });

  it("an identical retry shows the same revision, never a new one", async () => {
    queue([OK(1), OK(1)]);
    const container = renderPanel();
    await upload(container, "id-v1.pdf");
    await waitFor(() => expect(text(container)).toContain("National ID (revision 1)"));

    await upload(container, "id-v1.pdf");
    await waitFor(() => expect(urls.length).toBe(2));
    expect(text(container)).toContain("National ID (revision 1)");
    expect(text(container)).not.toContain("revision 2");
  });

  it("a 2xx that carries no revision names the document and claims no revision", async () => {
    queue([NO_REVISION]);
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(en.apply.upload_ok_title));
    expect(text(container)).not.toMatch(/revision/i);
  });

  // A revision is a positive whole count the backend assigns. Each case below
  // is a shape that must never be echoed back to a citizen as a revision.
  it.each([
    ["zero", 0],
    ["negative", -3],
    ["fractional", 2.5],
    ["a stringified number", "2"],
    ["past the safe-integer range", Number.MAX_SAFE_INTEGER + 1],
  ])("a revision that is %s is refused, not shown", async (_label, revision) => {
    queue([BAD_REVISION(revision)]);
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(en.apply.upload_ok_title));
    // The document is still named as received…
    expect(receivedText(container)).toContain("National ID");
    // …but no revision is claimed, and nothing unprintable leaks into the copy.
    expect(receivedText(container)).not.toMatch(/revision/i);
    expect(text(container)).not.toMatch(/NaN|Infinity|undefined|null/i);
    expect(text(container)).not.toContain(DOCUMENT_ID);
  });

  it("a second document type keeps its own revision", async () => {
    queue([OK(1), OK(1, "OLEVEL_CERTIFICATE")]);
    const container = renderPanel();
    await upload(container, "id.pdf");
    await waitFor(() => expect(text(container)).toContain("National ID (revision 1)"));

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("O-Level certificate"));
    await upload(container, "olevel.pdf");

    await waitFor(() => expect(text(container)).toContain("O-Level certificate (revision 1)"));
    expect(text(container)).toContain("National ID (revision 1)");
  });
});

describe("D8 closed-review refusals", () => {
  it("HUMAN_REVIEWED shows its approved explanation", async () => {
    queue([CLOSED("HUMAN_REVIEWED")]);
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(COPY.HUMAN_REVIEWED));
    expect(text(container)).toContain("contact the recruitment office to re-open it");
    expect(text(container)).not.toContain(COPY.CASE_ADVANCED);
  });

  it("CASE_ADVANCED shows its approved explanation", async () => {
    queue([CLOSED("CASE_ADVANCED")]);
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(COPY.CASE_ADVANCED));
    expect(text(container)).toContain("no longer be replaced");
    expect(text(container)).not.toContain(COPY.HUMAN_REVIEWED);
  });

  it("an unknown reason falls back to the generic safe error, not backend text", async () => {
    queue([CLOSED("SOMETHING_NEW")]);
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(GENERIC));
    expect(text(container)).not.toContain("SOMETHING_NEW");
    expect(text(container)).not.toContain(COPY.HUMAN_REVIEWED);
    expect(text(container)).not.toContain(COPY.CASE_ADVANCED);
  });

  it("a refusal with no reason at all is still only the generic safe error", async () => {
    queue([CLOSED()]);
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(GENERIC));
    expect(text(container)).not.toContain(COPY.HUMAN_REVIEWED);
    expect(text(container)).not.toContain(COPY.CASE_ADVANCED);
    expect(text(container)).not.toContain("undefined");
  });

  it("a refusal renders no re-open control: the upload button is the only control", async () => {
    queue([CLOSED("HUMAN_REVIEWED")]);
    const container = renderPanel();
    await upload(container, "id.pdf");
    await waitFor(() => expect(text(container)).toContain(COPY.HUMAN_REVIEWED));

    const controls = [...screen.queryAllByRole("button"), ...screen.queryAllByRole("link")];
    expect(controls.map((control) => control.textContent ?? "").join(" | ")).toBe(en.apply.upload);
    expect(controls.some((control) => /re-?open|unlock|replace/i.test(control.textContent ?? ""))).toBe(false);
    expect(container.innerHTML).not.toMatch(/(href|action)="[^"]*re-?open/i);
  });
});

describe("D8 evidence integrity on the citizen screen", () => {
  it("renders no document id, verdict, score, lane, flag or hash", async () => {
    queue([OK(2)]);
    const container = renderPanel();
    await upload(container, "id-v2.pdf");
    await waitFor(() => expect(text(container)).toContain("National ID (revision 2)"));

    expect(text(container)).not.toContain(DOCUMENT_ID);
    expect(container.innerHTML).not.toContain(DOCUMENT_ID);
    expect(text(container)).not.toMatch(/score|lane|flag|verdict|hmac|forensic|GREEN|AMBER/i);
  });

  it("a closed review is refused without any upstream diagnostic", async () => {
    queue([CLOSED("CASE_ADVANCED")]);
    const container = renderPanel();
    await upload(container, "id.pdf");
    await waitFor(() => expect(text(container)).toContain(COPY.CASE_ADVANCED));

    expect(text(container)).not.toContain(DOCUMENT_ID);
    expect(text(container)).not.toMatch(/score|lane|flag|verdict|hmac|forensic|GREEN|AMBER/i);
    expect(text(container)).not.toContain("DOCUMENT_REVIEW_CLOSED");
  });

  it("is explained in French and Kinyarwanda too, never as a raw key", async () => {
    const locales = [
      ["fr", fr.apply.upload_review_closed, fr.apply.upload],
      ["rw", rw.apply.upload_review_closed, rw.apply.upload],
    ] as const;

    for (const [language, copy, uploadLabel] of locales) {
      await i18n.changeLanguage(language);
      queue([CLOSED("HUMAN_REVIEWED")]);
      const container = renderPanel();
      await upload(container, "id.pdf", uploadLabel);

      await waitFor(() => expect(text(container)).toContain(copy.HUMAN_REVIEWED));
      expect(text(container)).not.toContain("apply.upload_review_closed");
      cleanup();
    }
  });
});
