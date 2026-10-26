// ══════════════════════════════════════════════════════════════════
// field-ops — what a station reads from a candidate's pass (S08). PURE.
//
// A station that needs the application (physical, medical, documents) reads it
// from the pass's claims. The claims are DECODED, not verified, here: the server
// re-verifies the ticket on every write and an application of another agency is
// refused there. The credential itself is never displayed or stored; only its
// ticket id (the field-sync `qrInvitationCode`) and the application id are kept.
// ══════════════════════════════════════════════════════════════════

import { readSlotClaims } from '@usrp/field-ledger';
import type { VenueDay } from './venue.ts';

export interface TicketRef {
  readonly applicationId: string;
  readonly ticketId: string;
  readonly venueName: string;
  readonly examDate: string;
  readonly agency: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_TICKET_LENGTH = 4096;

export function ticketFromToken(token: string): TicketRef | null {
  if (token.length === 0 || token.length > MAX_TICKET_LENGTH) return null;
  const claims = readSlotClaims(token);
  if (claims === null || !UUID_RE.test(claims.applicationId)) return null;
  return { applicationId: claims.applicationId, ticketId: claims.ticketId, venueName: claims.venueName, examDate: claims.examDate, agency: claims.agency };
}

export type TicketFit = 'MATCHES' | 'OTHER_VENUE' | 'OTHER_DAY' | 'OTHER_AGENCY' | 'NO_VENUE_DAY';

/** Whether the pass is for the venue day this tablet works. Advisory: the server decides. */
export function ticketFit(ticket: TicketRef, day: VenueDay | null, sessionAgency: string): TicketFit {
  if (ticket.agency !== sessionAgency) return 'OTHER_AGENCY';
  if (day === null) return 'NO_VENUE_DAY';
  if (ticket.examDate !== day.examDate) return 'OTHER_DAY';
  if (ticket.venueName !== day.venueName) return 'OTHER_VENUE';
  return 'MATCHES';
}
