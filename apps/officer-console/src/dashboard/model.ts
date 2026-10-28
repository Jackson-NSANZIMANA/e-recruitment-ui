// ══════════════════════════════════════════════════════════════════
// officer-console — the administration dashboard's pure model.
//
// Everything the dashboard decides is decided here, from the read models the
// edge already serves (agency campaigns with occupancy, application search
// totals, the amber queue, the officer list, the tablet fleet). No I/O, no
// clock of its own: `now` is passed in, so every rule is unit-provable.
//
// The dashboard is exception-first: the attention list comes before the
// figures, and an item appears only when someone has something to do.
// ══════════════════════════════════════════════════════════════════

import type { CampaignAdminSummary, FleetDevice, OfficerRow } from "@usrp/api-client";

/** Registration closing within this many hours is flagged. */
export const CLOSING_SOON_HOURS = 72;
/** A campaign at or above this share of its bounded capacity is flagged. */
export const NEAR_CAPACITY_SHARE = 0.9;
/** An assigned tablet not seen for this long is flagged. */
export const STALE_DEVICE_HOURS = 24;

const HOUR_MS = 3_600_000;

/** Application stages shown on the dashboard, each a set of canonical statuses. */
export const PIPELINE_STAGES = [
  { id: "vetting", statuses: ["SUBMITTED", "ACADEMIC_VETTING", "CRIMINAL_CLEARANCE"] },
  { id: "documents", statuses: ["DOCUMENT_REVIEW_GREEN", "DOCUMENT_REVIEW_AMBER", "ADJUDICATION_REVIEW"] },
  { id: "exam", statuses: ["SLOT_ASSIGNED", "PHYSICAL_TEST_SCHEDULED", "PHYSICAL_TEST_COMPLETE"] },
  { id: "medical", statuses: ["MEDICAL_REVIEW", "FINAL_SHORTLIST"] },
  { id: "accepted", statuses: ["ACCEPTED"] },
  { id: "closed", statuses: ["REJECTED", "WITHDRAWN"] },
] as const;
export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

/** What this officer may see, from the session's display permissions (never an authorization input). */
export interface DashboardAccess {
  readonly campaigns: boolean;
  readonly applications: boolean;
  readonly adjudication: boolean;
  readonly staff: boolean;
  readonly fleet: boolean;
}

export function accessFor(permissions: readonly string[]): DashboardAccess {
  const has = (p: string): boolean => permissions.includes(p);
  return {
    campaigns: has("campaign.read.admin"),
    applications: has("application.read"),
    adjudication: has("adjudication.read"),
    staff: has("officer.read"),
    fleet: has("field.device.manage"),
  };
}

/** The administration view is for posts that run the agency, not for case-working posts. */
export function isAdministrationView(access: DashboardAccess): boolean {
  return access.campaigns || access.staff || access.fleet;
}

export type AttentionItem =
  | { readonly kind: "amber"; readonly count: number; readonly href: string }
  | { readonly kind: "closing"; readonly campaign: string; readonly publicCode: string }
  | { readonly kind: "near_capacity"; readonly campaign: string; readonly publicCode: string }
  | { readonly kind: "pending_release"; readonly count: number; readonly href: string }
  | { readonly kind: "stale_devices"; readonly count: number };

export interface AttentionInputs {
  readonly amberCount: number | null;
  readonly campaigns: readonly CampaignAdminSummary[] | null;
  readonly officers: readonly OfficerRow[] | null;
  readonly devices: readonly FleetDevice[] | null;
  readonly now: Date;
}

/** Share of bounded capacity taken, or null when nothing is bounded. */
export function occupancyShare(c: CampaignAdminSummary): number | null {
  const cap = c.occupancy.capacityTotal;
  if (cap === null || cap <= 0) return null;
  return c.occupancy.registeredTotal / cap;
}

export function isClosingSoon(c: CampaignAdminSummary, now: Date): boolean {
  if (c.status !== "REGISTRATION_OPEN") return false;
  const left = Date.parse(c.registrationClosesAt) - now.getTime();
  return left > 0 && left <= CLOSING_SOON_HOURS * HOUR_MS;
}

export function isNearCapacity(c: CampaignAdminSummary): boolean {
  if (c.status !== "REGISTRATION_OPEN" && c.status !== "REGISTRATION_CLOSED") return false;
  const share = occupancyShare(c);
  return share !== null && share >= NEAR_CAPACITY_SHARE;
}

/** An active tablet assigned to a venue day today or later that has not been seen recently. */
export function isStaleAssignedDevice(d: FleetDevice, now: Date): boolean {
  if (d.revokedAt !== null || d.assignment === null) return false;
  if (d.assignment.examDate < now.toISOString().slice(0, 10)) return false;
  if (d.lastSeenAt === null) return true;
  return now.getTime() - Date.parse(d.lastSeenAt) > STALE_DEVICE_HOURS * HOUR_MS;
}

/** PURE. The attention list, in the order an administrator should act on it. */
export function attentionItems(input: AttentionInputs): readonly AttentionItem[] {
  const items: AttentionItem[] = [];
  if (input.amberCount !== null && input.amberCount > 0) items.push({ kind: "amber", count: input.amberCount, href: "/adjudication" });
  const releasable = (input.officers ?? []).filter((o) => o.activationState === "PENDING_RELEASE" && o.releasableByYou).length;
  if (releasable > 0) items.push({ kind: "pending_release", count: releasable, href: "/staff" });
  for (const c of input.campaigns ?? []) {
    if (isClosingSoon(c, input.now)) items.push({ kind: "closing", campaign: c.campaignLabel, publicCode: c.publicCode });
  }
  for (const c of input.campaigns ?? []) {
    if (isNearCapacity(c)) items.push({ kind: "near_capacity", campaign: c.campaignLabel, publicCode: c.publicCode });
  }
  const stale = (input.devices ?? []).filter((d) => isStaleAssignedDevice(d, input.now)).length;
  if (stale > 0) items.push({ kind: "stale_devices", count: stale });
  return items;
}

const STATUS_ORDER: Readonly<Record<CampaignAdminSummary["status"], number>> = {
  REGISTRATION_OPEN: 0,
  EXAMINATION_ACTIVE: 1,
  REGISTRATION_CLOSED: 2,
  DRAFT: 3,
  COMPLETED: 4,
  CANCELLED: 5,
};

/** PURE. Live campaigns first, then drafts, then finished ones; newest first within a state. */
export function sortCampaigns(campaigns: readonly CampaignAdminSummary[]): readonly CampaignAdminSummary[] {
  return [...campaigns].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt));
}

export function openCampaignCount(campaigns: readonly CampaignAdminSummary[]): number {
  return campaigns.filter((c) => c.status === "REGISTRATION_OPEN" || c.status === "EXAMINATION_ACTIVE").length;
}

export interface StaffSummary {
  readonly active: number;
  readonly pending: number;
  readonly disabled: number;
  /** Active officers per post, posts with nobody omitted, largest first. */
  readonly byPost: readonly { readonly post: string; readonly count: number }[];
}

export function staffSummary(officers: readonly OfficerRow[]): StaffSummary {
  const posts = new Map<string, number>();
  for (const o of officers) {
    if (o.status !== "active") continue;
    for (const p of o.posts) posts.set(p, (posts.get(p) ?? 0) + 1);
  }
  return {
    active: officers.filter((o) => o.status === "active").length,
    pending: officers.filter((o) => o.status === "pending").length,
    disabled: officers.filter((o) => o.status === "disabled").length,
    byPost: [...posts].map(([post, count]) => ({ post, count })).sort((a, b) => b.count - a.count || a.post.localeCompare(b.post)),
  };
}

export interface FleetSummary {
  readonly enrolled: number;
  readonly active: number;
  readonly revoked: number;
  readonly seenToday: number;
  readonly assigned: number;
}

export function fleetSummary(devices: readonly FleetDevice[], now: Date): FleetSummary {
  const active = devices.filter((d) => d.revokedAt === null);
  return {
    enrolled: devices.length,
    active: active.length,
    revoked: devices.length - active.length,
    seenToday: active.filter((d) => d.lastSeenAt !== null && now.getTime() - Date.parse(d.lastSeenAt) <= STALE_DEVICE_HOURS * HOUR_MS).length,
    assigned: active.filter((d) => d.assignment !== null && d.assignment.examDate >= now.toISOString().slice(0, 10)).length,
  };
}

/**
 * The calendar day as Y/M/D: an instant is read in Kigali time, a date-only
 * string is already a calendar day. Intl is used for the time zone only; the
 * words come from the translation bundles, because browsers ship trimmed
 * locale data and would print the US order for en-RW and rw-RW.
 */
export function calendarDay(value: string): { readonly year: string; readonly month: number; readonly day: string } | null {
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plain !== null) return { year: plain[1] ?? "", month: Number(plain[2]), day: String(Number(plain[3])) };
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Kigali", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(at);
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  return { year: part("year"), month: Number(part("month")), day: part("day") };
}
