import type { AmberRow } from '../model/amber.ts';
import { TRANSITION_OPERATION, type Transition } from '../model/transitions.ts';
import type { ApiClient, CallOptions } from './transport.ts';

export interface AmberQueueOk {
  readonly agency: string;
  readonly queue: readonly AmberRow[];
}

/**
 * ADR-011's review queue.
 *
 * A MIXED queue: DOCUMENT_REVIEW_AMBER is routine document review, while
 * ADJUDICATION_REVIEW is a late-disqualification hold that arrived AFTER the
 * eligibility terminal. Rendering them as one undifferentiated list is why the
 * UI carries an explanatory message rather than just a table.
 */
export const listAmberQueue = (client: ApiClient, options?: CallOptions): Promise<AmberQueueOk> =>
  client.call<AmberQueueOk>('listAmberQueue', options);

/**
 * Apply one of the four officer transitions.
 *
 * `TRANSITION_OPERATION` maps the domain verb to the edge operation id, so the
 * caller names a decision and never an endpoint.
 *
 * BOTH `APPLIED` and `NO_CHANGE` come back 200. A caller that treats any 200 as
 * "changed" reports a no-op as a successful transition, so the discriminant has
 * to be read — which is why this returns `unknown` rather than a shape that
 * invites `if (response.ok)`.
 */
export const applyTransition = (
  client: ApiClient,
  transition: Transition,
  body: Readonly<Record<string, unknown>>,
): Promise<unknown> => client.call<unknown>(TRANSITION_OPERATION[transition], { body });
