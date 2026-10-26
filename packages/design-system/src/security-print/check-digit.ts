/**
 * ICAO Doc 9303 (Part 3, §4.9) check digit - the 7-3-1 weighted modulus-10
 * scheme every passport machine-readable zone uses.
 *
 * Used for the verification line printed on an official document: an officer
 * who cannot scan the QR (dead camera, glare) types the line, and a single
 * mistyped or altered character fails its check digit before any network call.
 * Same arithmetic as a passport, so it is already familiar to anyone trained on
 * travel documents, and it is a standard, not an invention.
 *
 * What it catches: any single-character change whose value moves by 1-9 (all
 * three weights are coprime to 10). What it cannot catch: a change of exactly
 * 10 ('<' for 'A', '5' for 'F'), nor a deliberate forgery - the QR signature is
 * the integrity control; this is a typing-error guard.
 */

const WEIGHTS = [7, 3, 1] as const;

/** Value of one MRZ character: 0-9 as themselves, A-Z as 10-35, filler '<' as 0. */
export function mrzValue(ch: string): number {
  if (ch === '<') return 0;
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 65 && code <= 90) return code - 55;
  throw new RangeError(`"${ch}" is not a machine-readable-zone character (0-9, A-Z, <)`);
}

/** The single check digit for a field. Throws on characters outside the MRZ set. */
export function checkDigit(field: string): number {
  let sum = 0;
  for (let i = 0; i < field.length; i += 1) {
    sum += mrzValue(field[i]!) * WEIGHTS[i % 3]!;
  }
  return sum % 10;
}

/**
 * Normalise free text to the MRZ alphabet: upper-case, separators to '<',
 * anything else dropped. 'rdf-26 nyg' -> 'RDF<26<NYG'.
 */
export function toMrz(text: string): string {
  return text
    .toUpperCase()
    .replace(/[\s\-_/.]+/g, '<')
    .replace(/[^0-9A-Z<]/g, '');
}

/** A field followed by its own check digit. */
export function withCheckDigit(field: string): string {
  const mrz = toMrz(field);
  return mrz + String(checkDigit(mrz));
}

/**
 * A machine-readable line in the MRZ style: a fixed head, then each field with
 * its own check digit, groups separated by '<<', closed by a composite check
 * digit over everything before it (as on a passport data page's last line).
 */
export function composeMachineLine(head: string, fields: readonly string[]): string {
  const body = [toMrz(head), ...fields.map(withCheckDigit)].join('<<');
  return `${body}<<${String(checkDigit(body))}`;
}

/** True when the last character is the correct check digit for the rest. */
export function verifyCheckDigit(fieldWithDigit: string): boolean {
  const mrz = toMrz(fieldWithDigit);
  if (mrz.length < 2) return false;
  const digit = mrz[mrz.length - 1]!;
  if (digit < '0' || digit > '9') return false;
  try {
    return checkDigit(mrz.slice(0, -1)) === Number(digit);
  } catch {
    return false;
  }
}
