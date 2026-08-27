import { startHttpServer } from '@usrp/shared-http';
import { betaRoutes } from './adapters/http/session.controller.js';

async function main(): Promise<void> {
  await startHttpServer({
    serviceName: 'beta-service',
    port: 4102,
    routes: [
      ...betaRoutes(),
      {
        method: 'GET',
        path: '/v1/beta/inline-key',
        handler: () => ({ status: 200, body: { algorithm: 'Ed25519' } }),
      },
    ],
    readiness: async (): Promise<boolean> => true,
  });
}
main();
