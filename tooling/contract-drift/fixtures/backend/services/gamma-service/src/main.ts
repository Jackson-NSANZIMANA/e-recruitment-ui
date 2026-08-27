import { startHttpServer } from '@usrp/shared-http';
import { gammaMountedRoute } from './adapters/http/mounted.controller.js';

async function main(): Promise<void> {
  // NOTE: no readiness callback — reproduces biometric-service.
  await startHttpServer({
    serviceName: 'gamma-service',
    port: 4103,
    routes: [gammaMountedRoute(verify)],
  });
}
main();
