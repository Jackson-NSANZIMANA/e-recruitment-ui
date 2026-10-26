import { describe, expect, it } from 'vitest';
import { canonicalJson, toBase64Url } from '@usrp/field-ledger';
import { ticketFit, ticketFromToken } from './ticket.ts';

const claims = { v: 1, keyId: 'k', ticketId: 'TKT-1', applicationId: 'a3f1c2d4-5b6e-4f70-8192-0a1b2c3d4e5f', applicantId: 'x', agency: 'RDF', campaignId: 'c', slotId: 's', venueName: 'Nyagatare Stadium', examDate: '2027-06-06', reportingTimeHour: 7, issuedAt: 'i', expiresAt: 'e' };
const token = `USRP-SLOT.v1.${toBase64Url(new TextEncoder().encode(canonicalJson(claims)))}.sig`;
const day = { campaign: 'c', district: 'Nyagatare', examDate: '2027-06-06', venueName: 'Nyagatare Stadium' };

describe('ticket from a pass', () => {
  it('reads application and ticket ids', () => {
    expect(ticketFromToken(token)).toMatchObject({ applicationId: claims.applicationId, ticketId: 'TKT-1' });
    expect(ticketFromToken('nope')).toBeNull();
    expect(ticketFromToken('x'.repeat(5000))).toBeNull();
  });
  it('compares to the venue day, advisory only', () => {
    const t = ticketFromToken(token)!;
    expect(ticketFit(t, day, 'RDF')).toBe('MATCHES');
    expect(ticketFit(t, { ...day, examDate: '2027-06-07' }, 'RDF')).toBe('OTHER_DAY');
    expect(ticketFit(t, { ...day, venueName: 'Elsewhere' }, 'RDF')).toBe('OTHER_VENUE');
    expect(ticketFit(t, day, 'RNP')).toBe('OTHER_AGENCY');
    expect(ticketFit(t, null, 'RDF')).toBe('NO_VENUE_DAY');
  });
});
