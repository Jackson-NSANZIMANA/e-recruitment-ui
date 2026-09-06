export { token } from '@atlaskit/tokens';

export function createSemanticRoleMap<const T extends Record<string, Record<string, string>>>(map: T): Readonly<T> {
  for (const [key, roles] of Object.entries(map)) {
    for (const [role, value] of Object.entries(roles)) {
      if (/^\x23/.test(value) || value.startsWith('rgb') || value.startsWith('hsl')) {
        throw new Error('createSemanticRoleMap: "' + key + '.' + role + '" is a literal colour ("' + value + '"). Pass an ADS token name instead.');
      }
    }
  }
  return Object.freeze(map);
}

export type SemanticRoleMap = Readonly<Record<string, Readonly<Record<string, string>>>>;