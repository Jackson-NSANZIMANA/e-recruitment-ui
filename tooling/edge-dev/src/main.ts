// ══════════════════════════════════════════════════════════════════
// edge-dev — the runnable dev edge
//
//   node --experimental-strip-types tooling/edge-dev/src/main.ts --deployment=agency --agency=RDF
//   node --experimental-strip-types tooling/edge-dev/src/main.ts --deployment=citizen
//
// Zero dependencies on purpose: `tooling/` is outside the pnpm workspace, so
// this must run from a bare checkout with no install step. It is also why it
// mirrors `@usrp/shared-http` rather than importing it.
//
// `--mocks` boots contract mocks and points the edge at them, so the UI is
// testable with no Postgres, no Kafka and no G2G stack. Without it the edge
// talks to the real services on their real ports.
//
// This process is a STAND-IN, and it says so on every boot. It implements the
// same wire contract as the BFF specified in docs/architecture/edge-contract.md
// and is swappable by pointing `VITE_EDGE_URL` elsewhere. What it does NOT have:
// a durable session store (restart logs everyone out), rate limiting, or a
// second instance to share sessions with.
// ══════════════════════════════════════════════════════════════════

import { loadEdgeConfig, type EdgeDeployment } from './config.ts';
import { createEdgeContext, edgeRoutes } from './routes.ts';
import { startEdgeServer, type RunningServer } from './http.ts';
import { cookieNames } from './csrf.ts';
import { ALL_PORTS, assertNoPortCollisions } from './ports.ts';
import {
  freshIdentityState,
  startApplicationMock,
  startIamMock,
  startIdentityMock,
  CorrelationLog,
} from '../mocks/contract-mocks.ts';

interface Args {
  readonly deployment: EdgeDeployment;
  readonly withMocks: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const get = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const found = argv.find((arg) => arg.startsWith(prefix));
    return found?.slice(prefix.length);
  };
  const kind = get('deployment') ?? 'agency';
  const withMocks = argv.includes('--mocks');

  if (kind === 'citizen') return { deployment: { kind: 'citizen' }, withMocks };
  if (kind !== 'agency') {
    throw new Error(`--deployment must be "agency" or "citizen" — got ${JSON.stringify(kind)}.`);
  }
  const agency = get('agency') ?? process.env['AGENCY'] ?? 'RDF';
  if (agency !== 'RDF' && agency !== 'RNP' && agency !== 'RCS') {
    throw new Error(`--agency must be RDF, RNP or RCS — got ${JSON.stringify(agency)}.`);
  }
  return { deployment: { kind: 'agency', agency }, withMocks };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  assertNoPortCollisions();
  const args = parseArgs(argv);

  const env: NodeJS.ProcessEnv = { ...process.env };
  // A dev default so a fresh clone boots. Any real deployment gets this from
  // the environment, and the backend's production guard refuses this value.
  env['EDGE_SESSION_HMAC_KEY'] ??= 'dev_edge_session_hmac_key_min_32_chars!!';

  const servers: RunningServer[] = [];
  if (args.withMocks) {
    const log = new CorrelationLog();
    const portOf = (name: string): number => {
      const entry = ALL_PORTS.find((candidate) => candidate.name === name);
      if (entry === undefined) throw new Error(`No port-map entry named "${name}".`);
      return entry.port;
    };
    const iamPort = portOf('edge-dev mock iam-service');
    const identityPort = portOf('edge-dev mock identity-service');
    const applicationPort = portOf('edge-dev mock application-service');
    servers.push(await startIamMock(iamPort, log));
    servers.push(await startIdentityMock(identityPort, log, freshIdentityState()));
    servers.push(await startApplicationMock(applicationPort, log));
    env['IAM_BASE_URL'] = `http://127.0.0.1:${iamPort}`;
    env['IDENTITY_SERVICE_BASE_URL'] = `http://127.0.0.1:${identityPort}`;
    env['APPLICATION_SERVICE_BASE_URL'] = `http://127.0.0.1:${applicationPort}`;
  }

  const config = loadEdgeConfig(args.deployment, env);
  const edge = createEdgeContext(config);
  const routes = edgeRoutes(edge);
  const server = await startEdgeServer({
    serviceName: 'edge-dev',
    port: config.port,
    routes,
    cors: { origins: config.corsOrigins, credentials: true },
  });
  servers.push(server);

  const names = cookieNames(config.cookieSecure);
  const label = config.deployment.kind === 'citizen' ? 'citizen-bff' : `agency-bff (${config.deployment.agency})`;

  process.stdout.write(
    [
      '',
      '  USRP edge-dev — a DEV STAND-IN for the BFF specified in',
      '  docs/architecture/edge-contract.md. Not the BFF. Swappable by config.',
      '',
      `  standing in for : ${label}`,
      `  listening on    : ${server.url}`,
      `  routes          : ${routes.length}`,
      `  cors origins    : ${config.corsOrigins.join(', ')}`,
      `  cookies         : ${names.session} (httpOnly) + ${names.csrf} (readable echo)`,
      `  session ttl     : idle ${config.session.idleTtlSeconds}s sliding, absolute ${config.session.absoluteTtlSeconds}s ceiling`,
      `  upstreams       : iam=${config.upstream.iam} identity=${config.upstream.identity} application=${config.upstream.application}`,
      args.withMocks ? '  mode            : CONTRACT MOCKS (no Postgres/Kafka/G2G required)' : '  mode            : REAL SERVICES',
      '',
      '  Point the SPA at this process:',
      config.deployment.kind === 'citizen'
        ? `    apps/applicant-portal/.env.local  VITE_EDGE_URL=${server.url}`
        : `    apps/officer-console/.env.local   VITE_EDGE_URL=${server.url}`,
      '',
    ].join('\n'),
  );

  if (!config.cookieSecure) {
    process.stdout.write(
      [
        '  ⚠ EDGE_COOKIE_SECURE=false. Browsers SILENTLY DROP a __Host- cookie that is',
        '    not Secure, so this dev edge emits unprefixed cookie names. PRODUCTION MUST',
        '    SET IT TRUE: the __Host- prefix is what stops a sibling *.gov.rw host from',
        '    writing the session cookie, and the backend production guard already',
        '    refuses to boot without it.',
        '',
      ].join('\n'),
    );
  }
  if (!config.cookieSecure && config.deployment.kind === 'agency') {
    process.stdout.write(
      [
        '  ⚠ Reminder: this edge ASSERTS the officer agency and does not ENFORCE it.',
        '    Agency isolation is Postgres RLS, FORCE\'d, with NOLOGIN group roles.',
        '    Nothing in this process, or in any UI guard, is a security boundary.',
        '',
      ].join('\n'),
    );
  }

  const shutdown = async (): Promise<void> => {
    process.stdout.write('\n  edge-dev shutting down…\n');
    await Promise.all(servers.reverse().map((instance) => instance.stop()));
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

const invokedDirectly = process.argv[1] !== undefined && process.argv[1].endsWith('main.ts');
if (invokedDirectly) {
  main().catch((err: unknown) => {
    process.stderr.write(`edge-dev failed to start: ${String(err)}\n`);
    process.exit(1);
  });
}
