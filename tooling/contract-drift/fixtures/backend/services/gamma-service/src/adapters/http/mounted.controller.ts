import type { HttpResult, Route } from '@usrp/shared-http';
import { withAuth, type AuthVerifier } from '@usrp/shared-auth';

export const GAMMA_MOUNTED_PATH = '/v1/gamma/mounted';

export function gammaMountedRoute(verify: AuthVerifier): Route {
  return {
    method: 'POST',
    path: GAMMA_MOUNTED_PATH,
    handler: withAuth(verify, { kind: 'system' }, async (): Promise<HttpResult> => {
      return { status: 200, body: { status: 'OK' } };
    }),
  };
}
