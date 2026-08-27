// This controller is finished and main.ts never imports it. That is the
// by-id / status-history regression, reproduced on purpose.
import type { HttpResult, Route } from '@usrp/shared-http';
import { withAuth, type AuthVerifier } from '@usrp/shared-auth';

export const GAMMA_ORPHAN_PATH = '/v1/gamma/orphan';

export function gammaOrphanRoute(verify: AuthVerifier): Route {
  return {
    method: 'GET',
    path: GAMMA_ORPHAN_PATH,
    handler: withAuth(verify, { kind: 'officer' }, async (): Promise<HttpResult> => {
      return { status: 200, body: { status: 'OK' } };
    }),
  };
}

// A commented-out registration the extractor must NOT see:
//     {
//       method: 'DELETE',
//       path: GAMMA_ORPHAN_PATH,
//     }
