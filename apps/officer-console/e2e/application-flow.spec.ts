import { test, expect } from "@playwright/test";

// ─── Mock data ────────────────────────────────────────────────────────────────

const OFFICER = {
  id: "off-001",
  email: "officer@rdf.gov.rw",
  role: "RECRUITMENT_OFFICER",
  agency: "RDF",
  displayName: "Test Officer",
};

const METRICS = {
  pendingReview: 5,
  requiresAction: 2,
  scheduledToday: 1,
  acceptedThisWeek: 3,
};

const APP = {
  id: "app-001",
  applicantName: "Jean Baptiste Niyonzima",
  agency: "RDF",
  status: "SUBMITTED",
  submittedAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-01T08:00:00.000Z",
  requiresAction: true,
  applicant: {
    id: "appl-001",
    displayName: "Jean Baptiste Niyonzima",
    phoneFragment: "250-7XXX",
    dateOfBirth: "1995-04-12",
    gender: "MALE",
  },
  postCode: "RDF-98001",
  postTitle: "Infantry Recruit",
  history: [],
  documents: [],
};

const APP_APPROVED = { ...APP, status: "SHORTLISTED" };

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Officer happy path", () => {
  test("login → dashboard → open application → approve", async ({ page }) => {
    // ── Step 1: Session check returns 401 before login ──────────────────────
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({ status: 401, body: '{"message":"Unauthenticated"}' }),
    );

    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);

    // ── Step 2: Wire login and post-login session endpoints ─────────────────
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(OFFICER),
      }),
    );
    // After a successful login the AuthProvider re-fetches /auth/me.
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(OFFICER),
      }),
    );
    await page.route("**/api/dashboard/metrics", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(METRICS),
      }),
    );

    // ── Step 3: Fill and submit the login form ──────────────────────────────
    await page.getByLabel("Email address").fill("officer@rdf.gov.rw");
    await page.getByLabel("Password").fill("s3cr3t!");
    await page.getByRole("button", { name: "Sign in" }).click();

    // ── Step 4: Dashboard is visible ────────────────────────────────────────
    // The pending-review metric is rendered by DashboardMetricCard.
    await expect(page.getByText("5")).toBeVisible();

    // ── Step 5: Wire application list and detail endpoints ──────────────────
    await page.route("**/api/applications*", (route) => {
      const url = route.request().url();
      if (url.includes("/app-001/status")) {
        // Status-transition PATCH — handled in step 7.
        return;
      }
      if (url.match(/\/applications\/app-001$/)) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(APP),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [APP],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }
    });

    // ── Step 6: Navigate to applications list ───────────────────────────────
    await page.getByRole("link", { name: /applications/i }).click();
    await expect(page).toHaveURL(/\/applications/);
    await expect(
      page.getByText("Jean Baptiste Niyonzima"),
    ).toBeVisible();

    // ── Step 7: Open the application detail ─────────────────────────────────
    await page.getByText("Jean Baptiste Niyonzima").click();
    await expect(page).toHaveURL(/\/applications\/app-001/);
    await expect(page.getByText("RDF-98001")).toBeVisible();

    // ── Step 8: Wire the approve mutation ───────────────────────────────────
    await page.route("**/api/applications/app-001/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(APP_APPROVED),
      }),
    );

    // ── Step 9: Approve the application ─────────────────────────────────────
    await page.getByRole("button", { name: /approve/i }).click();
    // The mutation resolves → onActionComplete fires.
    // There should be no uncaught errors on the page.
    await expect(page.locator("[data-testid='error']")).not.toBeVisible();
  });
});
