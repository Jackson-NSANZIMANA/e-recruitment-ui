// UUIDv7 (RFC 9562): 48-bit Unix milliseconds, version 7, variant 10, 74
// random bits. Time-ordered, so a record log sorts by creation without a
// separate index. PURE given its clock and random source.

export function uuidv7(nowMs: number, random: (bytes: Uint8Array) => Uint8Array): string {
  if (!Number.isInteger(nowMs) || nowMs < 0 || nowMs > 0xffffffffffff) throw new RangeError('uuidv7: timestamp out of range');
  const bytes = random(new Uint8Array(16));
  let t = nowMs;
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = t % 256;
    t = Math.floor(t / 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The millisecond timestamp a UUIDv7 carries. */
export function uuidv7Time(id: string): number {
  return parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}
