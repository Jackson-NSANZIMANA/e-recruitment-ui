import { describe, expect, it } from 'vitest';
import { navItemsFor } from './nav.js';

const ids = (p: readonly string[]): string[] => navItemsFor(p).map((i) => i.id);

describe('permission-built navigation', () => {
  it('an agency administrator sees applications, queues and staff but not the erasure queue', () => {
    expect(ids(['application.read', 'adjudication.read', 'officer.read', 'officer.create'])).toEqual(['dashboard', 'applications', 'queues', 'staff']);
  });
  it('campaigns appear only with the campaign read permission', () => {
    expect(ids(['campaign.read.admin'])).toEqual(['dashboard', 'campaigns']);
    expect(ids(['application.read', 'officer.read'])).not.toContain('campaigns');
  });
  it('a data protection officer sees only the erasure queue', () => {
    expect(ids(['erasure.queue.read', 'erasure.decide'])).toEqual(['dashboard', 'erasure']);
  });
  it('a medical officer sees applications and queues, never staff or erasure', () => {
    expect(ids(['medical.review', 'application.read', 'adjudication.read'])).toEqual(['dashboard', 'applications', 'queues']);
  });
  it('no permissions shows the dashboard only', () => {
    expect(ids([])).toEqual(['dashboard']);
  });
});
