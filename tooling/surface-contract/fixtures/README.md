# surface-contract selftest fixtures

Files the selftest (`src/selftest.ts`) points planted manifests at, so each
readiness rung's check is watched going red. Nothing here is mounted by an app.

- `untranslated-screen.tsx` — a non-placeholder screen that uses an i18n key no
  locale bundle defines (proves `locale-parity`).
