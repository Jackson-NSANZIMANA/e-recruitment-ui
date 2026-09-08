# `@usrp/edge-dev`

**A dev-only stand-in for the BFF specified in `docs/architecture/edge-contract.md`.**

Not the BFF. Same wire contract, swappable by pointing `VITE_EDGE_URL` somewhere
else. It exists so the UI is testable **today**, against a real socket, with the
real session/CSRF/correlation semantics — instead of waiting for a backend
deployment that does not exist yet.

```bash
# The officer edge, against contract mocks. No Postgres, no Kafka, no G2G stack.
node --experimental-strip-types tooling/edge-dev/src/main.ts --deployment=agency --agency=RDF --mocks

# The citizen edge, against the real services on their real ports.
set -a; source ../e-recruitment/.env; set +a
node --experimental-strip-types tooling/edge-dev/src/main.ts --deployment=citizen

# The proof: 143 assertions over real sockets.
node --experimental-strip-types tooling/edge-dev/selfcheck/verify-edge.ts

# The authoritative port map.
pnpm --filter @usrp/edge-dev ports
```

## Zero dependencies, and why that is a design decision

`tooling/` is outside `pnpm-workspace.yaml` (`apps/*` and `packages/*` only), and
this package does not change that — the workspace file is not this agent's to
edit, and a dev tool that needs an install step before it can prove anything is a
dev tool that gets skipped.

So edge-dev depends on nothing, runs under a bare `node --experimental-strip-types`,
and mirrors `@usrp/shared-http` rather than importing it. That mirroring is
deliberate and shallow: the shapes (`Route`, `HttpResult`, `RequestContext`,
`SetCookie`) are identical, so the real BFF deletes `src/http.ts`, depends on the
real substrate, and changes not one route handler.

The one thing that cannot be zero-dependency is checking this tool against
`@usrp/contracts`. That lives in `scripts/check-against-contracts.ts`, run with
`tsx`, and is the drift gate for `src/upstream-routes.ts`.

## What it implements

| Property | Where |
|---|---|
| Opaque session handle in an httpOnly cookie; upstream credential never leaves the server | `src/session-store.ts` |
| Two TTLs — 30-min sliding idle, 12-hour absolute ceiling | `src/session-store.ts` |
| Session handles stored keyed-hashed (HMAC-SHA-256), never verbatim | `src/session-store.ts` |
| CSRF: origin pinning **and** double-submit, both server-side | `src/csrf.ts` |
| `nationalIdHash` / token scrubbing at the browser boundary, with a counted proof | `src/redact.ts` |
| `x-correlation-id` inherited and forwarded, never re-minted | `src/upstream.ts` |
| Retry/backoff on named G2G 503s **only**; never on a write | `src/upstream.ts` |
| System-token brokering (ADR-016 client credentials, 15-min TTL) | `src/upstream.ts` |
| Fan-out with per-panel degradation instead of all-or-nothing | `src/upstream.ts` |
| One authoritative port map, asserted at boot | `src/ports.ts` |

## What it deliberately does NOT implement

Named so nobody mistakes this for a production edge:

- **No durable session store.** Restarting logs everyone out. The real BFF needs
  Postgres or Redis; sessions must also be shared across instances, which an
  in-process `Map` cannot do.
- **No rate limiting.** ADR-018 follow-on #1 and the officer-login follow-on both
  flag per-NID and per-IP throttling as missing platform-wide. An edge is the
  right place for it and this is not that edge.
- **No `__Host-` prefix over plain http.** Browsers silently drop such a cookie,
  so dev uses unprefixed names and prints why on every boot. Production must set
  `EDGE_COOKIE_SECURE=true`; the backend's production guard already refuses to
  boot otherwise.
- **No TLS, no audit emission, no metrics.**

## Contract mocks

`mocks/contract-mocks.ts` stands in for iam-service, identity-service and
application-service. Every status code and body shape is transcribed from the
real controllers at backend `47d9ad3`, including the awkward parts that are the
whole point:

- officer login collapses unknown handle, wrong password **and disabled account**
  into one 401;
- `otp/request` answers a byte-identical 202 to all four input classes;
- `otp/verify` answers one 401 for wrong, expired, replayed **and locked out**,
  and after five failures the correct code fails too;
- responses deliberately **carry** `nationalIdHash`, because a mock that never
  emits it cannot prove the edge strips it.

A mock that smooths those over would make the proof lie, which is worse than no
proof.
