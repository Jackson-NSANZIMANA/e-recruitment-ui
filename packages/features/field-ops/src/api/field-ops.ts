import type { ApiClient } from './transport.ts';

/** Walk-in identity verification. Returns an opaque applicantId, never PII. */
export const verifyIdentityAtDesk = (
  client: ApiClient,
  nationalId: string,
  correlationId?: string,
): Promise<{ readonly status: 'CREATED' | 'ALREADY_EXISTS'; readonly applicantId: string }> =>
  client.call('verifyIdentity', {
    body: { nationalId, channel: 'WALK_IN' },
    ...(correlationId === undefined ? {} : { correlationId }),
  });

/** Walk-in registration. Agency is derived from the officer session. */
export const registerWalkIn = (
  client: ApiClient,
  body: { readonly applicantId: string; readonly category: string },
  correlationId?: string,
): Promise<{
  readonly status: 'REGISTERED';
  readonly applicationId: string;
  readonly processingCode: string;
  readonly qrInvitationCode: string;
}> => client.call('registerWalkIn', { body, ...(correlationId === undefined ? {} : { correlationId }) });

/** AGE_PENDING remains an officer action state, never a transport retry. */
export const vetWalkIn = (
  client: ApiClient,
  applicationId: string,
  correlationId?: string,
): Promise<unknown> =>
  client.call<unknown>('vetWalkIn', {
    body: { applicationId },
    ...(correlationId === undefined ? {} : { correlationId }),
  });
