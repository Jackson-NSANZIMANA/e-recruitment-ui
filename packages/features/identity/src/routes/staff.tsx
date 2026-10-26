import React from 'react';
import type { ApiClient } from '@usrp/api-client';
import { StaffPage } from '../ui/StaffPage.tsx';

export default function StaffRoute({ client }: { readonly client: ApiClient }): React.ReactElement {
  return <StaffPage client={client} />;
}
