import type {ApplicationStatus,Agency} from '@usrp/contracts';
import type {CallOptions,SliceTransport} from './transport.ts';
export interface ApplicationSummary{readonly applicationId:string;readonly processingCode:string;readonly category:string;readonly status:ApplicationStatus;readonly submittedAt:string|null}
export interface ListApplicationsOk{readonly agency:Agency;readonly applications:readonly ApplicationSummary[]}
export interface StatusHistoryEntry{readonly entryId:string;readonly fromStatus:ApplicationStatus|null;readonly toStatus:ApplicationStatus;readonly note:string|null;readonly actor:string;readonly actorKind:'SYSTEM'|'OFFICER';readonly at:string;readonly correlationId:string|null}
export interface StatusHistoryOk{readonly agency:Agency;readonly applicationId:string;readonly history:readonly StatusHistoryEntry[]}
export const listApplications=(transport:SliceTransport,options?:CallOptions):Promise<ListApplicationsOk>=>transport.call('listApplications',options);
export const findApplicationById=(transport:SliceTransport,applicationId:string):Promise<unknown>=>transport.call('findApplicationById',{query:{applicationId}});
export const getStatusHistory=(transport:SliceTransport,applicationId:string):Promise<StatusHistoryOk>=>transport.call('getApplicationStatusHistory',{query:{applicationId}});
export const listMyApplications=(transport:SliceTransport):Promise<unknown>=>transport.call('listMyApplications');
