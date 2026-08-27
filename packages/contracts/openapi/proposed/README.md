# Proposed operations — NOT IMPLEMENTED

Everything in this directory describes an endpoint **that does not exist**.

These documents are deliberately **outside the loader's glob**. `generate` reads
`openapi/*.yaml` only, so nothing here can produce a Zod schema, a type, or a
route-table entry — and `verify`'s proposed-isolation gate asserts that on every
run. A generated client for a nonexistent endpoint is worse than no client: it
type-checks, it looks finished, and it 404s in production.

Each operation is specced to the same standard as the real ones — exact path, no
path params, ids in the body or a query param, discriminated error bodies — so a
backend agent can implement it without a second design conversation. Every one
follows the `?applicantId=` precedent set by the routes that already landed.

Move a file up one directory **only** when the backend has shipped it and the
route manifest has been re-mined.
