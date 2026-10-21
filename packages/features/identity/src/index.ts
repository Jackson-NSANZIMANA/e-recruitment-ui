export * from './model/credentials.ts';
export * from './model/no-enumeration.ts';
export * from './api/transport.ts';
export * from './api/identity.ts';
export { IDENTITY_NAMESPACE, registerIdentityLocales } from './locales.ts';
// ADR-FE-007 §5: the sign-in screens live here, one implementation for all
// three apps. Exported as components (not lazy route tables) because a host
// mounts its login EAGERLY: it is the recovery path when a chunk cannot load.
export { default as OfficerLoginPage } from './routes/officer-login.tsx';
export type { OfficerLoginPageProps } from './routes/officer-login.tsx';
export { default as CitizenLoginPage } from './routes/citizen-otp.tsx';
export type { CitizenLoginPageProps } from './routes/citizen-otp.tsx';
export { SessionExpiryNotice } from './ui/SessionExpiryNotice.tsx';
