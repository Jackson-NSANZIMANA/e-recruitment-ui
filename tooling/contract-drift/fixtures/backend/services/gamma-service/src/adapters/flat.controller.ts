// A controller directly under src/adapters/ rather than src/adapters/http/ —
// the shape of scheduling-service's campaign-session.controller.ts.
import type { HttpResult, Route } from '@usrp/shared-http';
import { withAuth, type AuthVerifier } from '@usrp/shared-auth';

export const GAMMA_FLAT_PATH = '/v1/gamma/flat';

export function gammaFlatRoutes(verify: AuthVerifier): Route[] {
  return [{
    method: 'POST',
    path: GAMMA_FLAT_PATH,
    handler: withAuth(verify, { kind: 'officer' }, async (): Promise<HttpResult> => {
      return { status: 200, body: { status: 'OK' } };
    }),
  }];
}
