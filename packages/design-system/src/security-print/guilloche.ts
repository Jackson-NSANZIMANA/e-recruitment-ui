/**
 * Guilloche geometry - the fine, interlaced line-work printed behind the data
 * page of a passport or a banknote.
 *
 * On paper its security value is that the pattern is GENERATED: reproducing it
 * needs the original parameters, not a scanner. The on-screen equivalent here
 * keeps that property in the one way a browser can: the curves are derived
 * deterministically from a seed (a document serial, a processing code), so
 * every issued document carries its own pattern and two documents never share
 * one. A pasted-in screenshot of somebody else's pass has visibly different
 * line-work from the pass the system renders for that serial.
 *
 * It is NOT a cryptographic control - the QR signature is. It is the visual
 * cue that tells a human at a gate, before any scan, that this document was
 * rendered by the system and not assembled in an image editor.
 *
 * Pure functions, no DOM, no colour: the component decides how it is drawn.
 */

/** FNV-1a over UTF-16 code units: stable across browsers and Node, no crypto needed. */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 - small, fast, well-distributed; reproducible for a given seed. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();

function toPath(points: readonly (readonly [number, number])[], close: boolean): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const head = `M${fmt(first![0])} ${fmt(first![1])}`;
  return head + rest.map(([x, y]) => `L${fmt(x)} ${fmt(y)}`).join('') + (close ? 'Z' : '');
}

export interface RosetteOptions {
  /** Pattern seed - use seedFrom(serial). */
  readonly seed: number;
  /** Centre and outer radius in the caller's coordinate space. */
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  /** Number of nested curves. Defaults to 6. */
  readonly rings?: number;
  /** Samples per curve; more is smoother and heavier. Defaults to 720. */
  readonly samples?: number;
}

/**
 * Nested hypotrochoid rosettes (the classic engine-turned medallion).
 *
 * Integer lobe counts guarantee each curve closes on itself, which is what
 * makes the result read as engraving rather than as noise.
 */
export function rosettePaths(options: RosetteOptions): readonly string[] {
  const { seed, cx, cy, radius } = options;
  const rings = options.rings ?? 6;
  const samples = options.samples ?? 720;
  const rand = prng(seed);
  const lobes = 9 + Math.floor(rand() * 15); // 9..23 lobes
  const paths: string[] = [];

  for (let ring = 0; ring < rings; ring += 1) {
    const scale = 1 - ring * (0.55 / rings);
    const R = radius * scale;
    const r = R / lobes;
    const d = r * (2.2 + rand() * 2.4);
    const phase = rand() * Math.PI * 2;
    const pts: [number, number][] = [];
    for (let i = 0; i <= samples; i += 1) {
      const t = (i / samples) * Math.PI * 2;
      const k = (R - r) / r;
      const x = (R - r) * Math.cos(t + phase) + d * Math.cos(k * t + phase);
      const y = (R - r) * Math.sin(t + phase) - d * Math.sin(k * t + phase);
      // Normalise so the outermost excursion stays inside `radius`.
      const norm = R / (R - r + d);
      pts.push([cx + x * norm, cy + y * norm]);
    }
    paths.push(toPath(pts, true));
  }
  return paths;
}

export interface BandOptions {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  /** Number of interlaced lines. Defaults to 14. */
  readonly lines?: number;
  /** Horizontal sample step in user units. Defaults to 4. */
  readonly step?: number;
}

/**
 * Interlaced sine bands across a rectangle - the background "wave" of a
 * security-printed page. Two mirrored families of lines, each the sum of two
 * seeded harmonics, cross and re-cross into the lattice of engine-turned print;
 * the crossing points move with the seed, so the lattice is unique to it.
 */
export function bandPaths(options: BandOptions): readonly string[] {
  const { seed, width, height } = options;
  const lines = options.lines ?? 36;
  const step = options.step ?? 3;
  const rand = prng(seed);
  const f1 = 2 + rand() * 3;
  const f2 = 7 + rand() * 8;
  const a1 = height * (0.08 + rand() * 0.06);
  const a2 = height * (0.012 + rand() * 0.018);
  const phase = rand() * Math.PI * 2;
  const paths: string[] = [];

  for (let l = 0; l < lines; l += 1) {
    // Even lines and odd lines are mirror images: their crossings make the mesh.
    const mirror = l % 2 === 0 ? 1 : -1;
    const base = (height / (lines + 1)) * (l + 1);
    const p1 = phase + (l / lines) * Math.PI;
    const p2 = rand() * Math.PI * 2;
    const pts: [number, number][] = [];
    for (let x = 0; x <= width; x += step) {
      const u = x / width;
      const y = base + mirror * a1 * Math.sin(u * Math.PI * 2 * f1 + p1) + a2 * Math.sin(u * Math.PI * 2 * f2 + p2);
      pts.push([x, y]);
    }
    paths.push(toPath(pts, false));
  }
  return paths;
}
