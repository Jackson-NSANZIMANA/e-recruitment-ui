import { test } from "node:test";
import assert from "node:assert/strict";
import {
  READINESS_RUNGS,
  joinRoutePath,
  mountDecision,
  normaliseRoutePath,
  readinessIndex,
  rungAtLeast,
} from "../src/readiness/model.ts";

const SURFACES = [
  { id: "officer.gate-notice", routes: [{ path: "/gate", app: "officer-console" }], readiness: { rung: "E2E-PROVEN" } },
  { id: "field.gate", routes: [{ path: "/gate", app: "field-station" }], readiness: { rung: "E2E-PROVEN" } },
  { id: "officer.amber", routes: [{ path: "/adjudication/amber-queue", app: "officer-console" }], readiness: { rung: "CLIENT-WIRED" } },
  { id: "bogus", routes: [{ path: "/bogus", app: "officer-console" }], readiness: { rung: "ALMOST-DONE" } },
];

test("the ladder is ordered and the floor sits at SCREEN-BUILT", () => {
  assert.equal(READINESS_RUNGS.length, 7);
  assert.ok(rungAtLeast("SCREEN-BUILT", "SCREEN-BUILT"));
  assert.ok(rungAtLeast("OPERATIONALLY-READY", "SCREEN-BUILT"));
  assert.ok(!rungAtLeast("CLIENT-WIRED", "SCREEN-BUILT"));
  assert.ok(!rungAtLeast("DECLARED", "EDGE-AVAILABLE"));
});

test("paths are normalised the way manifests write them", () => {
  assert.equal(normaliseRoutePath("gate"), "/gate");
  assert.equal(normaliseRoutePath("/gate/"), "/gate");
  assert.equal(normaliseRoutePath(""), "/");
  assert.equal(joinRoutePath("/", "applications/:id"), "/applications/:id");
  assert.equal(joinRoutePath("/field", "check-in"), "/field/check-in");
  assert.equal(joinRoutePath("/field", "/login"), "/login");
});

test("the index is per app, and an off-ladder rung contributes nothing", () => {
  const officer = readinessIndex(SURFACES, "officer-console");
  assert.equal(officer.get("/gate")?.surface, "officer.gate-notice");
  assert.equal(officer.get("/adjudication/amber-queue")?.rung, "CLIENT-WIRED");
  assert.equal(officer.has("/bogus"), false);
  const field = readinessIndex(SURFACES, "field-station");
  assert.deepEqual([...field.keys()], ["/gate"]);
});

test("production mounts only SCREEN-BUILT and above, and fails closed on an undeclared route", () => {
  assert.deepEqual(mountDecision({ rung: "E2E-PROVEN", surface: "s" }, true), { kind: "mount" });
  assert.deepEqual(mountDecision({ rung: "SCREEN-BUILT", surface: "s" }, true), { kind: "mount" });
  assert.deepEqual(mountDecision({ rung: "CLIENT-WIRED", surface: "s" }, true), { kind: "omit" });
  assert.deepEqual(mountDecision({ rung: "DECLARED", surface: "s" }, true), { kind: "omit" });
  assert.deepEqual(mountDecision(null, true), { kind: "omit" });
});

test("development mounts everything and marks what is not built", () => {
  assert.deepEqual(mountDecision({ rung: "E2E-PROVEN", surface: "s" }, false), { kind: "mount" });
  assert.deepEqual(mountDecision({ rung: "CLIENT-WIRED", surface: "s" }, false), {
    kind: "mount-with-banner",
    rung: "CLIENT-WIRED",
    surface: "s",
  });
  assert.deepEqual(mountDecision(null, false), { kind: "mount-with-banner", rung: null, surface: null });
});
