import React from 'react';
import type { ApiClient } from '@usrp/api-client';
import { ActivatePage } from '../ui/ActivatePage.tsx';

export default function ActivateRoute({ client }: { readonly client: ApiClient }): React.ReactElement {
  return <ActivatePage client={client} />;
}
