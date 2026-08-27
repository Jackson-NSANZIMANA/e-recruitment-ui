import { HttpError, type HttpResult, type Route } from '@usrp/shared-http';
import { withAuth, type AuthVerifier } from '@usrp/shared-auth';

export const ALPHA_OFFICER_PATH = '/v1/alpha/officer';
export const ALPHA_DUAL_PATH = '/v1/alpha/dual';
export const ALPHA_PUBLIC_PATH = '/v1/alpha/public';

export function alphaRoutes(verify: AuthVerifier): Route[] {
  return [
    {
      method: 'POST',
      path: ALPHA_OFFICER_PATH,
      handler: withAuth(verify, { kind: 'officer' }, async (): Promise<HttpResult> => {
        return { status: 200, body: { status: 'OK' } };
      }),
    },
    {
      method: 'POST',
      path: ALPHA_DUAL_PATH,
      handler: withAuth(verify, { kind: ['system', 'officer'] }, async (): Promise<HttpResult> => {
        return { status: 200, body: { status: 'OK' } };
      }),
    },
    {
      method: 'POST',
      path: ALPHA_PUBLIC_PATH,
      handler: async (): Promise<HttpResult> => {
        throw new HttpError(400, 'INVALID_REQUEST', 'nope');
      },
    },
  ];
}
