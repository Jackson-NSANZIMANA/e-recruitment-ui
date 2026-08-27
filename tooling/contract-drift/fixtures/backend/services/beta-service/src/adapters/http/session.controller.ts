import { HttpError, type HttpResult, type Route } from '@usrp/shared-http';

export const BETA_ME_PATH = '/v1/beta/me';
export const BETA_THING_PATH = '/v1/beta/thing';

async function authenticate(header: string | null): Promise<string> {
  if (header === null) throw new HttpError(401, 'INVALID_SESSION', 'required');
  return 'applicant';
}

export function betaRoutes(): Route[] {
  return [
    {
      method: 'GET',
      path: BETA_ME_PATH,
      handler: async (ctx): Promise<HttpResult> => {
        await authenticate(ctx.headers['authorization'] ?? null);
        return { status: 200, body: { applications: [] } };
      },
    },
    {
      method: 'POST',
      path: BETA_THING_PATH,
      handler: async (ctx): Promise<HttpResult> => {
        await authenticate(ctx.headers['authorization'] ?? null);
        return { status: 202, body: { status: 'PENDING' } };
      },
    },
    {
      method: 'GET',
      path: BETA_THING_PATH,
      handler: async (ctx): Promise<HttpResult> => {
        await authenticate(ctx.headers['authorization'] ?? null);
        return { status: 200, body: { status: 'PENDING' } };
      },
    },
  ];
}
