import React from 'react';
import type { ApiClient } from '@usrp/api-client';
import { QueuesPage } from '../ui/QueuesPage.tsx';
import type { QueueId } from '../model/queues.ts';

export default function QueuesRoute({ client, initial }: { readonly client: ApiClient; readonly initial: QueueId }): React.ReactElement {
  return <QueuesPage client={client} initial={initial} />;
}
