import { startHttpServer } from '@usrp/shared-http';
import { gammaMountedRoute } from './adapters/http/mounted.controller.js';
import { gammaHelperRoutes } from './adapters/http/helper.controller.js';
import { gammaFlatRoutes } from './adapters/flat.controller.js';

async function main(): Promise<void> {
  // NOTE: no readiness callback — reproduces biometric-service.
  await startHttpServer({
    serviceName: 'gamma-service',
    port: 4103,
    routes: [gammaMountedRoute(verify), ...gammaHelperRoutes(verify), ...gammaFlatRoutes(verify)],
  });
}
main();
