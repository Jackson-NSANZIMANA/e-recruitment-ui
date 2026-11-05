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
 * or that a reviewed document is really refused.
 *
 * Not because the backend work is missing — e-recruitment PR #61 IS merged, at
 * `4683b5615daeecdf13b40bb4930c3aeec83196de`. It is because that proof needs
 * the CONNECTED service chain at that SHA, which needs a Postgres, MinIO, Kafka
 * and ClamAV stack this environment does not have. A controlled edge response
 * proves only that the UI renders the server's answer truthfully.
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
/**
 * An internal identifier the citizen must never see. A real UUID, because the
 * gateway's projection re-checks `documentId` against its UUID pattern and the
 * client's decoder does the same — a synthetic id would be refused as drift and
 * every success-path assertion below would prove nothing.
 */
const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";

/** The English copy the assertions are written against, read from the bundle. */
const COPY = en.apply.upload_review_closed;
const GENERIC = en.apply.upload_error;
const UNCONFIRMED_TITLE = en.apply.upload_unconfirmed_title;
const UNCONFIRMED_BODY = en.apply.upload_unconfirmed_body;
/** A stable fragment of the interpolated "already on file" variant. */
const UNCONFIRMED_ON_FILE = "already on file for this application";

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

/**
 * The advisory checklist the panel reconciles against when an upload's outcome
 * cannot be confirmed. It carries NO revision — by design — so it can only ever
 * say "a document of this type is on file", never "your upload was stored".
 */
const CHECKLIST = (satisfaction: string): EdgeReply => ({
  status: 200,
  body: {
    agency: "RDF",
    source: "POLICY_VERSION",
    complete: false,
    items: [{ documentType: "NATIONAL_ID", satisfaction, registry: null }],
  },
});

let replies: readonly EdgeReply[] = [];
let index = 0;
let checklist: EdgeReply | null = null;
/** When set, the edge answers with this EXACT text — for bodies that are not JSON. */
let raw: string | null = null;
const urls: string[] = [];

vi.stubGlobal(
  "fetch",
  (url: string, _init: RequestInit): Promise<Response> => {
    const target = String(url);
    urls.push(target);
    if (raw !== null) {
      return Promise.resolve(new Response(raw, { status: 201, headers: { "content-type": "application/json" } }));
    }
    // The reconciliation read is a different route and is answered separately;
    // `null` means the checklist itself is unreadable.
    if (target.includes("document-checklist")) {
      return Promise.resolve(
        checklist === null
          ? new Response("UPSTREAM_DOWN", { status: 500, headers: { "content-type": "application/json" } })
          : new Response(JSON.stringify(checklist.body), {
              status: checklist.status,
              headers: { "content-type": "application/json" },
            }),
      );
    }
    const reply = replies[Math.min(index, replies.length - 1)];
    index += 1;
    // A request no reply was queued for is a 500, not a TypeError inside the
    // stub: this suite must fail on an unexpected CALL, not on undefined.
    return Promise.resolve(
      reply === undefined
        ? new Response("NO_REPLY_QUEUED", { status: 500, headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify(reply.body), {
            status: reply.status,
            headers: { "content-type": "application/json" },
          }),
    );
  },
);

// Imported AFTER the stub: see the note above.
const { DocumentsPanel } = await import("./index.js");

/** Queue the edge replies the transport will receive, in order. */
function queue(next: readonly EdgeReply[], checklistReply: EdgeReply | null = null, rawBody: string | null = null): void {
  replies = next;
  index = 0;
  checklist = checklistReply;
  raw = rawBody;
  urls.length = 0;
}

/** How many of the requests so far were the upload itself, not the reconciliation read. */
const uploadCalls = (): readonly string[] => urls.filter((url) => url === ROUTE);

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
  // The panel first reads the application's own required list (the campaign policy).
  const input = await waitFor(() => {
    const found = container.querySelector("#document-file");
    if (!(found instanceof HTMLInputElement)) throw new Error("the file input is not rendered");
    return found;
  });
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
    expect(uploadCalls()).toEqual([ROUTE]);
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
    expect(uploadCalls()).toEqual([ROUTE, ROUTE]);
  });

  it("an identical retry shows the same revision, never a new one", async () => {
    queue([OK(1), OK(1)]);
    const container = renderPanel();
    await upload(container, "id-v1.pdf");
    await waitFor(() => expect(text(container)).toContain("National ID (revision 1)"));

    await upload(container, "id-v1.pdf");
    await waitFor(() => expect(uploadCalls().length).toBe(2));
    expect(text(container)).toContain("National ID (revision 1)");
    expect(text(container)).not.toContain("revision 2");
  });

  it("a 2xx that carries no revision is UNCONFIRMED, never a receipt", async () => {
    queue([NO_REVISION]);
    const container = renderPanel();
    await upload(container, "id.pdf");

    // Not "received": the server's answer is unusable, so there is no receipt.
    await waitFor(() => expect(text(container)).toContain(UNCONFIRMED_TITLE));
    expect(text(container)).toContain(UNCONFIRMED_BODY);
    expect(text(container)).not.toContain(en.apply.upload_ok_title);
    expect(receivedText(container)).toBe("");
    // Not "failed" either: an unreadable answer is not proof nothing was stored.
    expect(text(container)).not.toContain(en.apply.upload_error_title);
    expect(text(container)).not.toContain(GENERIC);
    // And no revision is invented, in any shape.
    expect(text(container)).not.toMatch(/revision/i);
    expect(text(container)).not.toMatch(/NaN|Infinity|undefined|null/i);
    expect(text(container)).not.toContain(DOCUMENT_ID);
  });

  // A revision is a positive whole count the backend assigns. Each case below
  // is contract drift, not a revision, so none of them may reach the citizen as
  // one — and none of them is a receipt either.
  it.each([
    ["zero", 0],
    ["negative", -3],
    ["fractional", 2.5],
    ["a stringified number", "2"],
    ["past the safe-integer range", Number.MAX_SAFE_INTEGER + 1],
    ["null", null],
    ["a boolean", true],
    ["an object", { value: 2 }],
  ])("a revision that is %s is unconfirmed, never shown", async (_label, revision) => {
    queue([BAD_REVISION(revision)]);
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(UNCONFIRMED_TITLE));
    expect(text(container)).not.toContain(en.apply.upload_ok_title);
    expect(receivedText(container)).toBe("");
    // Nothing unprintable leaks into the copy, and no internal id crosses.
    expect(text(container)).not.toMatch(/revision/i);
    expect(text(container)).not.toMatch(/NaN|Infinity|undefined|null/i);
    expect(text(container)).not.toContain(DOCUMENT_ID);
  });

  // A body that is not an answer at all: a 201 that says nothing readable.
  it.each([
    ["JSON null", "null"],
    ["an array", "[]"],
    ["a number", "7"],
    ["a string", '"UPLOADED"'],
    ["text that is not JSON", "UPLOADED 201"],
    ["nothing at all", ""],
  ])("a 201 whose body is %s is unconfirmed, never shown", async (_label, body) => {
    queue([], null, body);
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(UNCONFIRMED_TITLE));
    expect(text(container)).not.toContain(en.apply.upload_ok_title);
    expect(receivedText(container)).toBe("");
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

describe("D8 an upload whose outcome cannot be confirmed", () => {
  /**
   * An unreadable answer is NOT a failed upload. It is also not a receipt. The
   * contract requires `revision` on a 201, so a 2xx without one leaves the panel
   * knowing neither, and the only honest thing it can do is say so.
   */
  it("says the outcome is unconfirmed instead of claiming success or failure", async () => {
    queue([NO_REVISION]);
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(UNCONFIRMED_TITLE));
    // Neither story is told: no "document received", no "could not be uploaded".
    expect(receivedText(container)).toBe("");
    expect(text(container)).not.toContain(en.apply.upload_ok_title);
    expect(text(container)).not.toContain(en.apply.upload_error_title);
    expect(text(container)).not.toContain(GENERIC);
    // No revision, no id, no diagnostic.
    expect(text(container)).not.toMatch(/revision/i);
    expect(text(container)).not.toContain(DOCUMENT_ID);
    expect(text(container)).not.toMatch(/score|lane|flag|verdict|hmac|forensic|GREEN|AMBER/i);
  });

  /**
   * The recovery a client must NOT attempt on its own. Upstream, an identical
   * re-upload is a RETRY — same revision, no new history entry — so resending
   * cannot repair a lost answer and would only put a second attempt in the log.
   */
  it("never re-sends the file: the upload is attempted exactly once", async () => {
    queue([NO_REVISION]);
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(UNCONFIRMED_TITLE));
    expect(uploadCalls()).toEqual([ROUTE]);
    // The reconciliation read is not a second upload, and it is a read: one read of the
    // campaign's required list when the panel mounts, then exactly one reconciliation.
    const reads = urls.filter((url) => url.includes("document-checklist"));
    expect(reads.length).toBe(2);
    expect(reads.every((url) => url.includes(APP))).toBe(true);
  });

  it("reconciles against the checklist, and says a document of that type is on file", async () => {
    queue([NO_REVISION], CHECKLIST("UNDER_REVIEW"));
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(UNCONFIRMED_ON_FILE));
    // Even with a document on file, this upload is not confirmed…
    expect(text(container)).not.toContain(en.apply.upload_ok_title);
    expect(receivedText(container)).toBe("");
    expect(text(container)).not.toMatch(/revision/i);
    // …and the reconciliation is a read, never a second upload.
    expect(uploadCalls()).toEqual([ROUTE]);
  });

  it("treats an unreadable checklist as no record, rather than inventing one", async () => {
    queue([NO_REVISION], null);
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(UNCONFIRMED_TITLE));
    expect(text(container)).toContain(UNCONFIRMED_BODY);
    expect(text(container)).not.toContain(UNCONFIRMED_ON_FILE);
  });

  it("a document the checklist lists as MISSING is not reported as on file", async () => {
    queue([NO_REVISION], CHECKLIST("MISSING"));
    const container = renderPanel();
    await upload(container, "id.pdf");

    await waitFor(() => expect(text(container)).toContain(UNCONFIRMED_TITLE));
    expect(text(container)).not.toContain(UNCONFIRMED_ON_FILE);
  });

  it("a later confirmed upload clears the unconfirmed notice", async () => {
    queue([NO_REVISION, OK(1)]);
    const container = renderPanel();
    await upload(container, "id.pdf");
    await waitFor(() => expect(text(container)).toContain(UNCONFIRMED_TITLE));

    await upload(container, "id-v1.pdf");
    await waitFor(() => expect(text(container)).toContain("National ID (revision 1)"));
    expect(text(container)).not.toContain(UNCONFIRMED_TITLE);
    expect(uploadCalls()).toEqual([ROUTE, ROUTE]);
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

/**
 * The required list comes from the CAMPAIGN (the policy version bound to the
 * application), never from the agency's catalogue of storable types.
 */
describe("documents the campaign asks for", () => {
  const POLICY = (items: readonly Record<string, unknown>[]): EdgeReply => ({
    status: 200,
    body: { agency: "RDF", source: "POLICY_VERSION", complete: false, items },
  });

  it("offers only the campaign's required types, not the agency catalogue", async () => {
    queue([], POLICY([
      { documentType: "GOOD_CONDUCT_CERTIFICATE", satisfaction: "MISSING", registry: null },
      { documentType: "NATIONAL_ID", satisfaction: "API_VERIFIED", registry: "NIDA" },
    ]));
    const container = renderPanel();
    await waitFor(() => expect(container.querySelector('[data-testid="required-docs"]')).not.toBeNull());
    expect(container.querySelector('[data-testid="required-doc-GOOD_CONDUCT_CERTIFICATE"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="required-doc-NATIONAL_ID"]')).not.toBeNull();
    // The picker shows the one type still to send; the verified ID is not offered again.
    expect(text(container)).toContain(en.documents.types.GOOD_CONDUCT_CERTIFICATE);
    expect(container.querySelector('[data-testid="required-docs-fallback"]')).toBeNull();
    // Types the agency can store but this campaign did not ask for are absent.
    expect(container.querySelector('[data-testid="required-doc-BIRTH_CERTIFICATE"]')).toBeNull();
  });

  it("asks for the IremboGov certificate number instead of an upload for the clearance item", async () => {
    queue([], POLICY([
      { documentType: "NON_CONVICTION_CERTIFICATE", satisfaction: "MISSING", registry: "RIB", clearance: { state: "NUMBER_REQUIRED", code: null, reasons: [] } },
    ]));
    const container = renderPanel();
    await waitFor(() => expect(container.querySelector('[data-testid="apply-clearance"]')).not.toBeNull());
    expect(container.querySelector(`#clearance-number-${APP}`)).not.toBeNull();
    // Nothing is left to upload: the certificate is verified from its number.
    expect(container.querySelector("#document-file")).toBeNull();
    expect(container.querySelector('[data-testid="nothing-to-upload"]')).not.toBeNull();
  });

  it("an empty policy list shows that nothing is required, with no upload control", async () => {
    queue([], POLICY([]));
    const container = renderPanel();
    await waitFor(() => expect(container.querySelector('[data-testid="required-docs"]')).not.toBeNull());
    expect(container.querySelector("#document-file")).toBeNull();
  });
});
