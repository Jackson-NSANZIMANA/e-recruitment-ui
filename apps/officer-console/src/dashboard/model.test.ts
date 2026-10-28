import { describe, expect, it } from 'vitest';
import type { CampaignAdminSummary, FleetDevice, OfficerRow } from '@usrp/api-client';
import {
  accessFor, attentionItems, calendarDay, fleetSummary, isAdministrationView, isClosingSoon, isNearCapacity, isStaleAssignedDevice,
  openCampaignCount, sortCampaigns, staffSummary,
} from './model.js';

const NOW = new Date('2026-10-28T08:00:00.000Z');

function campaign(over: Partial<CampaignAdminSummary> & { registered?: number; capacity?: number | null } = {}): CampaignAdminSummary {
  const { registered = 10, capacity = 100, ...rest } = over;
  return {
    publicCode: 'REH-RDF-RDF26-20261028', campaignLabel: 'RDF 2026', status: 'REGISTRATION_OPEN',
    targetCategories: ['GENERAL_ENLISTMENT'], targetDistricts: ['NYAGATARE'],
    registrationOpensAt: '2026-10-20T00:00:00.000Z', registrationClosesAt: '2026-11-20T00:00:00.000Z',
    examinationStartDate: '2026-11-25', examinationEndDate: '2026-11-26', allowsWalkIn: true, targetIntakeCount: 400,
    publishedAt: '2026-10-20T00:00:00.000Z', createdAt: '2026-10-19T00:00:00.000Z',
    occupancy: { sessionCount: 1, capacityTotal: capacity, hasUnboundedSession: capacity === null, registeredTotal: registered },
    ...rest,
  };
}

function officer(over: Partial<OfficerRow> = {}): OfficerRow {
  return {
    officerId: 'o1', loginHandle: 'rdf.med.one', posts: ['medical_officer'], status: 'active', createdAt: '2026-10-01T00:00:00.000Z',
    activatedAt: '2026-10-02T00:00:00.000Z', lastLoginAt: null, activationExpiresAt: null, activationState: null, releasableByYou: false, ...over,
  };
}

function device(over: Partial<FleetDevice> = {}): FleetDevice {
  return {
    deviceId: 'd1', enrolledBy: 'rdf.supervisor', enrolledAt: '2026-10-01T00:00:00.000Z', lastSeenAt: '2026-10-28T07:00:00.000Z',
    lastSeenSource: 'FIELD_SYNC', lastSyncAt: null, revokedAt: null, revokeReason: null,
    assignment: { campaignPublicCode: 'REH-RDF-RDF26-20261028', district: 'NYAGATARE', examDate: '2026-10-28' }, ...over,
  };
}

describe('dashboard access', () => {
  it('an agency administrator gets the administration view; a medical officer does not', () => {
    const admin = accessFor(['campaign.read.admin', 'officer.read', 'field.device.manage', 'application.read', 'adjudication.read']);
    expect(admin).toEqual({ campaigns: true, applications: true, adjudication: true, staff: true, fleet: true });
    expect(isAdministrationView(admin)).toBe(true);
    expect(isAdministrationView(accessFor(['medical.review', 'application.read', 'adjudication.read']))).toBe(false);
  });
});

describe('attention rules', () => {
  it('registration closing within 72 hours is flagged only while open', () => {
    expect(isClosingSoon(campaign({ registrationClosesAt: '2026-10-30T08:00:00.000Z' }), NOW)).toBe(true);
    expect(isClosingSoon(campaign({ registrationClosesAt: '2026-11-01T08:00:01.000Z' }), NOW)).toBe(false);
    expect(isClosingSoon(campaign({ registrationClosesAt: '2026-10-27T08:00:00.000Z' }), NOW)).toBe(false);
    expect(isClosingSoon(campaign({ status: 'DRAFT', registrationClosesAt: '2026-10-29T08:00:00.000Z' }), NOW)).toBe(false);
  });
  it('90% of bounded capacity is near capacity; unbounded never is', () => {
    expect(isNearCapacity(campaign({ registered: 90, capacity: 100 }))).toBe(true);
    expect(isNearCapacity(campaign({ registered: 89, capacity: 100 }))).toBe(false);
    expect(isNearCapacity(campaign({ registered: 900, capacity: null }))).toBe(false);
    expect(isNearCapacity(campaign({ status: 'COMPLETED', registered: 100, capacity: 100 }))).toBe(false);
  });
  it('an assigned active tablet unseen for 24 hours is stale; revoked, unassigned and past days are not', () => {
    expect(isStaleAssignedDevice(device({ lastSeenAt: '2026-10-27T07:59:00.000Z' }), NOW)).toBe(true);
    expect(isStaleAssignedDevice(device({ lastSeenAt: null }), NOW)).toBe(true);
    expect(isStaleAssignedDevice(device(), NOW)).toBe(false);
    expect(isStaleAssignedDevice(device({ lastSeenAt: null, revokedAt: '2026-10-27T00:00:00.000Z', revokeReason: 'LOST' }), NOW)).toBe(false);
    expect(isStaleAssignedDevice(device({ lastSeenAt: null, assignment: null }), NOW)).toBe(false);
    expect(isStaleAssignedDevice(device({ lastSeenAt: null, assignment: { campaignPublicCode: 'X', district: 'NYAGATARE', examDate: '2026-10-27' } }), NOW)).toBe(false);
  });
  it('orders the list: adjudication, releases, closing, capacity, tablets; nothing when all is well', () => {
    const items = attentionItems({
      amberCount: 3,
      campaigns: [campaign({ registrationClosesAt: '2026-10-29T00:00:00.000Z', registered: 95 })],
      officers: [officer({ status: 'pending', activationState: 'PENDING_RELEASE', releasableByYou: true }), officer({ activationState: 'PENDING_RELEASE', releasableByYou: false })],
      devices: [device({ lastSeenAt: null })],
      now: NOW,
    });
    expect(items.map((i) => i.kind)).toEqual(['amber', 'pending_release', 'closing', 'near_capacity', 'stale_devices']);
    expect(items[1]).toEqual({ kind: 'pending_release', count: 1, href: '/staff' });
    expect(attentionItems({ amberCount: 0, campaigns: [campaign()], officers: [officer()], devices: [device()], now: NOW })).toEqual([]);
    expect(attentionItems({ amberCount: null, campaigns: null, officers: null, devices: null, now: NOW })).toEqual([]);
  });
});

describe('roll-ups', () => {
  it('sorts live campaigns first and counts the open ones', () => {
    const list = [campaign({ publicCode: 'A', status: 'COMPLETED' }), campaign({ publicCode: 'B', status: 'DRAFT' }), campaign({ publicCode: 'C' }), campaign({ publicCode: 'D', status: 'EXAMINATION_ACTIVE' })];
    expect(sortCampaigns(list).map((c) => c.publicCode)).toEqual(['C', 'D', 'B', 'A']);
    expect(openCampaignCount(list)).toBe(2);
  });
  it('summarises staff by status and active officers by post', () => {
    const s = staffSummary([
      officer({ posts: ['agency_admin'] }), officer({ posts: ['medical_officer'] }), officer({ posts: ['medical_officer', 'reviewer'] }),
      officer({ status: 'pending', posts: ['adjudicator'] }), officer({ status: 'disabled', posts: ['medical_officer'] }),
    ]);
    expect([s.active, s.pending, s.disabled]).toEqual([3, 1, 1]);
    expect(s.byPost).toEqual([{ post: 'medical_officer', count: 2 }, { post: 'agency_admin', count: 1 }, { post: 'reviewer', count: 1 }]);
  });
  it('summarises the fleet', () => {
    const f = fleetSummary([device(), device({ deviceId: 'd2', lastSeenAt: null, assignment: null }), device({ deviceId: 'd3', revokedAt: '2026-10-20T00:00:00.000Z', revokeReason: 'LOST' })], NOW);
    expect(f).toEqual({ enrolled: 3, active: 2, revoked: 1, seenToday: 1, assigned: 1 });
  });
});

describe('calendar days', () => {
  it('reads an instant in Kigali time and a date-only string as the day itself', () => {
    expect(calendarDay('2026-10-26T22:00:00.000Z')).toEqual({ year: '2026', month: 10, day: '27' });
    expect(calendarDay('2026-10-26T21:59:00.000Z')).toEqual({ year: '2026', month: 10, day: '26' });
    expect(calendarDay('2026-12-01')).toEqual({ year: '2026', month: 12, day: '1' });
    expect(calendarDay('not a date')).toBeNull();
  });
});
