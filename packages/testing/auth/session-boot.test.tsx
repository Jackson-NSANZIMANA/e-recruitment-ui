import React, { StrictMode, useEffect } from 'react';
import { render, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, type EdgeAuthClient } from '@usrp/auth';

/**
 * The AuthProvider asks the edge for the session once per client. StrictMode
 * re-runs mount effects in development; that used to send two identical
 * GET /edge/v1/session requests (two red 401s for every signed-out visitor).
 */
function fakeClient(): { client: EdgeAuthClient; calls: () => number } {
  let calls = 0;
  const unused = (): never => {
    throw new Error('not used in this test');
  };
  const client: EdgeAuthClient = {
    loadSession: () => {
      calls += 1;
      return Promise.resolve(null);
    },
    refreshSession: unused,
    officerLogin: unused,
    officerLogout: unused,
    confirmIdentity: unused,
    requestOtp: unused,
    verifyOtp: unused,
    applicantLogout: unused,
  };
  return { client, calls: () => calls };
}

/** Reports the auth status out of the tree; renders nothing. */
function Status({ seen }: { readonly seen: string[] }): null {
  const status = useAuth().state.status;
  useEffect(() => {
    seen.push(status);
  }, [seen, status]);
  return null;
}

describe('AuthProvider session boot', () => {
  it('asks the edge once under StrictMode and settles to anonymous', async () => {
    const fake = fakeClient();
    const seen: string[] = [];
    render(
      <StrictMode>
        <AuthProvider edgeBaseUrl="" client={fake.client}>
          <Status seen={seen} />
        </AuthProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(seen).toContain('anonymous'));
    expect(fake.calls()).toBe(1);
  });

  it('asks again when the client itself changes', async () => {
    const first = fakeClient();
    const second = fakeClient();
    const seen: string[] = [];
    const { rerender } = render(
      <AuthProvider edgeBaseUrl="" client={first.client}>
        <Status seen={seen} />
      </AuthProvider>,
    );
    await waitFor(() => expect(seen).toContain('anonymous'));
    rerender(
      <AuthProvider edgeBaseUrl="" client={second.client}>
        <Status seen={seen} />
      </AuthProvider>,
    );
    await waitFor(() => expect(second.calls()).toBe(1));
    expect(first.calls()).toBe(1);
  });
});
