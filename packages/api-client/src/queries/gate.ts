// @usrp/api-client — gate admission hook (BUILD-003, ADR-034)
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { admitAtGate } from '../operations/gate.js';
import type { AdmitAtGateInput, GateAdmissionResult } from '../wire.js';

/** Never retried: a replayed admission would answer ALREADY_ADMITTED. */
export function useAdmitAtGate(client: ApiClient): UseMutationResult<GateAdmissionResult, Error, AdmitAtGateInput> {
  return useMutation({
    mutationFn: (input: AdmitAtGateInput) => admitAtGate(client, input),
    retry: false,
  });
}
