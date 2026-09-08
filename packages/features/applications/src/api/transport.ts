export interface CallOptions{readonly body?:unknown;readonly query?:Readonly<Record<string,string>>;readonly signal?:AbortSignal}
export interface SliceTransport{call<T>(operationId:string,options?:CallOptions):Promise<T>}
export const APPLICATIONS_OPERATIONS=['listApplications','findApplicationById','getApplicationStatusHistory','listMyApplications','withdrawMyApplication'] as const;
export type ApplicationsOperation=(typeof APPLICATIONS_OPERATIONS)[number];
