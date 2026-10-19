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
    const stations = stationsFor({ agency: 'RDF', permissions: ['admission.gate', 'medical.review', 'field.conflict.resolve'] });
    expect(stations).toEqual([
      { id: 'gate', path: '/gate', built: true },
      { id: 'medical', path: null, built: false },
      { id: 'supervisor', path: null, built: false },
    ]);
  });

  it('guards a station route by the same derivation', () => {
    const session = { agency: 'RDF', permissions: ['admission.gate'] };
    expect(mayOpenStation(session, '/gate')).toBe(true);
    expect(mayOpenStation(session, '/walk-in')).toBe(false);
    expect(mayOpenStation(null, '/gate')).toBe(false);
  });
});
