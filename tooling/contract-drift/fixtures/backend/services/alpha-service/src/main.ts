import { startHttpServer } from '@usrp/shared-http';
import { alphaRoutes } from './adapters/http/one.controller.js';

async function main(): Promise<void> {
  await startHttpServer({
    serviceName: 'alpha-service',
    port: 4101,
    routes: [...alphaRoutes(verify)],
    readiness: async (): Promise<boolean> => true,
  });
}
main();
