// Routes built through a local helper with the shorthand `path,` property —
// the shape of application-service's campaign-control controller.
import type { HttpResult, Route } from '@usrp/shared-http';
import { withAuth, type AuthVerifier } from '@usrp/shared-auth';

export const GAMMA_HELPER_A_PATH = '/v1/gamma/helper-a';
export const GAMMA_HELPER_B_PATH = '/v1/gamma/helper-b';

function writeRoute(path: string, verify: AuthVerifier): Route {
  return {
    method: 'POST',
    path,
    handler: withAuth(verify, { kind: 'officer' }, async (): Promise<HttpResult> => {
      return { status: 200, body: { status: 'OK' } };
    }),
  };
}

export function gammaHelperRoutes(verify: AuthVerifier): Route[] {
  return [
    writeRoute(GAMMA_HELPER_A_PATH, verify),
    writeRoute(GAMMA_HELPER_B_PATH, verify),
  ];
}
