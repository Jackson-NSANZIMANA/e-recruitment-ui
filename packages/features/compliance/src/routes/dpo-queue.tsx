import React from 'react';
import type { ApiClient } from '@usrp/api-client';
import { DpoQueuePage } from '../ui/DpoQueuePage.tsx';

export default function DpoQueueRoute({ client }: { readonly client: ApiClient }): React.ReactElement {
  return <DpoQueuePage client={client} />;
}
