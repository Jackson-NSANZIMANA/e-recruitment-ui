export * from './model/status.ts';
export * from './model/draft.ts';
export * from './api/transport.ts';
export * from './api/applications.ts';
export * from './ui/StatusLozenge.tsx';
export { APPLICATIONS_NAMESPACE, registerApplicationsLocales } from './locales.ts';
// NOT MOUNTED BY EITHER HOST YET. `ApplicationsRoutes` declares `path:
// 'applications'`, which officer-console already serves with a real
// useApplicationList table. Exported so the parity work can be done against it;
// see ADR-FE-006 §5.
export { ApplicationsRoutes } from './routes/index.tsx';
