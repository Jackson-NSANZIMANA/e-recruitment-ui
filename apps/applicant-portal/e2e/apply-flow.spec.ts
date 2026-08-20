import { test, expect } from "@playwright/test";

// ─── Mock data ────────────────────────────────────────────────────────────────

const APPLICANT_SESSION = {
  id: "app-user-001",
  email: "jean@example.rw",
  role: "APPLICANT",
  displayName: "Jean Claude Habimana",
};

const NIDA_VERIFIED = {
  verified: true,
  nationalId: "1199512345678901",
  displayName: "Jean Claude Habimana",
  dateOfBirth: "1995-12-01",
  gender: "MALE",
};

const CREATED_APPLICATION = {
  id: "new-app-001",
  applicantName: "Jean Claude Habimana",
  agency: "RDF",
  status: "DRAFT",
  submittedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  requiresAction: false,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Applicant happy path", () => {
  test("NID verified → complete wizard → submit application", async ({
    page,
  }) => {
    // ── Step 1: Applicant is authenticated (session cookie present) ──────────
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(APPLICANT_SESSION),
      }),
    );

    // ── Step 2: Navigate to home (NID verification page) ────────────────────
    await page.goto("/home");
    await expect(page.getByText("Unified Security Recruitment Portal")).toBeVisible();

    // ── Step 3: Wire NIDA verification endpoint ──────────────────────────────
    await page.route("**/api/identity/verify-nida", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(NIDA_VERIFIED),
      }),
    );

    // ── Step 4: Enter a valid 16-digit NID ──────────────────────────────────
    const nidInput = page.getByLabel("National ID number");
    await nidInput.fill("1199512345678901");
    // NIDA verification fires on blur.
    await nidInput.blur();

    // ── Step 5: Confirm the verified identity ────────────────────────────────
    await expect(page.getByText("Identity verified ✓")).toBeVisible();
    await expect(page.getByText("Jean Claude Habimana")).toBeVisible();

    // ── Step 6: Continue to the application wizard ───────────────────────────
    await page.getByRole("button", { name: /start application/i }).click();
    await expect(page).toHaveURL(/\/apply/);

    // ── Step 7: Step 0 — Agency & Post ──────────────────────────────────────
    await page.getByLabel("Which agency are you applying to?").fill("RDF");
    await page.getByLabel("Post code").fill("RDF-98001");
    await page.getByRole("button", { name: /next/i }).first().click();

    // ── Step 8: Step 1 — Contact ─────────────────────────────────────────────
    await page.getByLabel("Your phone number").fill("+250 788 123 456");
    await page.getByRole("button", { name: /next/i }).click();

    // ── Step 9: Step 2 — Education (placeholder, just click Next) ───────────
    await page.getByRole("button", { name: /next/i }).click();

    // ── Step 10: Step 3 — Declaration ───────────────────────────────────────
    await page.getByRole("button", { name: /i agree/i }).click();

    // ── Step 11: Step 4 — Review & Submit ───────────────────────────────────
    // The review shows the collected data before submission.
    await expect(page.getByText("RDF-98001")).toBeVisible();
    await page.getByRole("button", { name: /submit/i }).click();

    // ── Step 12: Confirm submission success message ──────────────────────────
    await expect(page.getByText("Application submitted ✓")).toBeVisible();
    await expect(
      page.getByText("You will be contacted via SMS"),
    ).toBeVisible();
  });
});
