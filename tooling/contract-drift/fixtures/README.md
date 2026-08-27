# Extractor fixtures

A synthetic three-service backend that reproduces **every syntactic shape the
real `e-recruitment` controllers actually use**, and nothing else:

| shape | where it is real | fixture |
|---|---|---|
| `withAuth(verify, { kind: 'officer' }, …)` | 11 controllers | alpha |
| `withAuth(verify, { kind: ['system','officer'] }, …)` | `verify-identity.controller.ts` | alpha |
| a route with **no** `withAuth` at all | `officer-login`, `service-token`, `otp/*` | alpha |
| an opaque-session route guarded by a local `authenticate(...)` | `applicant-auth`, `erasure-request` | beta |
| two methods on one exported constant | `ME_ERASURE_REQUEST_PATH` | beta |
| a route declared **inline in `main.ts`** | `scheduling-service` | beta |
| a controller built and **never imported by `main.ts`** | the by-id / status-history regression | gamma |
| a **commented-out** route that must not be extracted | defensive | gamma |
| `readiness:` present vs absent | every service vs `biometric-service` | beta vs gamma |

`selftest.ts` asserts the extractor reads all of it correctly, **and then plants
drift and asserts each gate goes red.** A drift checker that has never been seen
to fail is not a checker.
