# Response fixtures

Every file here is a list of cases. A case names a component schema, a value,
and whether the contract must ACCEPT or REJECT it.

**The negative cases are the ones that make this a proof.** A schema of
`z.unknown()` accepts every valid fixture ever written, so a suite of positive
examples proves almost nothing. Each `"expect": "reject"` case below encodes a
specific bug that shipped, or a specific invariant that must hold — the twelve
invented statuses, the `PaginatedResult` envelope that nothing in the platform
returns, `nationalIdHash` reaching a browser, the three incompatible 403 bodies
being used interchangeably.

`verify` runs every case through the zero-dependency structural validator AND
through the generated Zod schema, and asserts both reach the same verdict. A
disagreement fails the gate and names the case.

Provenance is per case in `why`. Values are transcribed from the controller
response mappings at backend SHA `47d9ad3`, cross-read against the selfcheck
suites named in each service document.
