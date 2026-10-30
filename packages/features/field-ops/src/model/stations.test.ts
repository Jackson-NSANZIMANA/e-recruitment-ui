import { describe, expect, it } from 'vitest';
import { STATIONS, STATION_IDS, mayOpenStation, stationsFor } from './stations.ts';

describe('station model', () => {
  it('lists every station once, in picker order', () => {
    expect(STATIONS.map((s) => s.id)).toEqual([...STATION_IDS]);
  });

  it('derives stations from permissions, never from a free choice', () => {
    expect(stationsFor(null)).toEqual([]);
    expect(stationsFor({ agency: 'RDF', permissions: ['application.read'] })).toEqual([]);
    expect(stationsFor({ agency: 'RNP', permissions: ['admission.gate'] })).toEqual([{ id: 'gate', path: '/gate', built: true }]);
  });

  it('keeps the walk-in desk to RDF even when another agency holds the permission', () => {
    expect(stationsFor({ agency: 'RDF', permissions: ['walkin.register'] }).map((s) => s.id)).toEqual(['walk_in']);
    expect(stationsFor({ agency: 'RCS', permissions: ['walkin.register', 'walkin.vet'] })).toEqual([]);
  });

  it('shows an unbuilt station to the officer who holds it, without a route', () => {
    const stations = stationsFor({ agency: 'RDF', permissions: ['admission.gate', 'document.verify.venue', 'medical.review', 'field.conflict.resolve'] });
    expect(stations).toEqual([
      { id: 'gate', path: '/gate', built: true },
      { id: 'documents', path: null, built: false },
      { id: 'medical', path: '/medical', built: true },
      { id: 'supervisor', path: '/supervisor', built: true },
    ]);
  });

  it('opens physical for a score-sync holder and the supervisor for a fleet manager', () => {
    expect(stationsFor({ agency: 'RDF', permissions: ['field.score.sync'] })).toEqual([{ id: 'physical', path: '/physical', built: true }]);
    expect(stationsFor({ agency: 'RNP', permissions: ['field.device.manage'] })).toEqual([{ id: 'supervisor', path: '/supervisor', built: true }]);
  });

  it('guards the supervisor companion pages by the supervisor station', () => {
    expect(mayOpenStation({ agency: 'RDF', permissions: ['field.conflict.resolve'] }, '/conflicts')).toBe(true);
    expect(mayOpenStation({ agency: 'RDF', permissions: ['field.score.sync'] }, '/conflicts')).toBe(false);
    expect(mayOpenStation({ agency: 'RDF', permissions: ['admission.gate'] }, '/check-in')).toBe(true);
  });

  it('guards a station route by the same derivation', () => {
    const session = { agency: 'RDF', permissions: ['admission.gate'] };
    expect(mayOpenStation(session, '/gate')).toBe(true);
    expect(mayOpenStation(session, '/walk-in')).toBe(false);
    expect(mayOpenStation(null, '/gate')).toBe(false);
  });
});
