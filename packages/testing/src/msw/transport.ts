import { MOCK_OUTCOMES } from "./generated/handler-table.ts";

export interface TestTransportOptions {
  readonly baseUrl?: string;
  readonly scenarios?: Readonly<Record<string, string>>;
}

export function createTestTransport(o: TestTransportOptions = {}) {
  return {
    async call<T>(
      operationId: string,
      init?: { body?: unknown; query?: Readonly<Record<string, string>> },
    ): Promise<T> {
      const name = o.scenarios?.[operationId] ?? "success";
      const outcome = MOCK_OUTCOMES.find(
        (x) => x.operationId === operationId && x.scenario === name,
      );
      if (!outcome) throw new Error(`Unknown operation ${operationId}/${name}`);

      const url = new URL(outcome.path, o.baseUrl ?? "http://localhost");
      for (const [k, v] of Object.entries(init?.query ?? {})) {
        url.searchParams.set(k, v);
      }

      // Conditionally spread body/headers ONLY if they are defined
      const r = await fetch(url, {
        method: outcome.method,
        ...(init?.body !== undefined
          ? {
              body: JSON.stringify(init.body),
              headers: { "Content-Type": "application/json" },
            }
          : {}),
      });

      return (r.status === 204 ? undefined : await r.json()) as T;
    },
  };
}
