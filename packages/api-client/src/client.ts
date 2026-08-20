import { assertOk, NetworkError } from "./errors.js";

export interface ApiClientOptions {
  /** e.g. "https://bff.rdf.usrp.gov.rw/api/v1" */
  readonly baseUrl: string;
}

/**
 * Thin wrapper around `fetch` that:
 *  - always sends `credentials: "include"` (httpOnly cookie auth)
 *  - sets Content-Type for JSON bodies
 *  - throws `ApiError` on 4xx/5xx or `NetworkError` on connection failure
 *  - returns parsed JSON of type T
 */
export async function apiFetch<T>(
  options: ApiClientOptions,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${options.baseUrl}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init?.body !== undefined && typeof init.body === "string"
      ? { "Content-Type": "application/json" }
      : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new NetworkError();
  }

  await assertOk(res);

  // 204 No Content — return empty object cast to T
  if (res.status === 204) return {} as T;

  return (await res.json()) as T;
}

/** Convenience helpers for the four verbs. */
export function createApiClient(options: ApiClientOptions) {
  const get = <T>(path: string) =>
    apiFetch<T>(options, path, { method: "GET" });

  const post = <T>(path: string, body?: unknown) =>
    apiFetch<T>(options, path, {
      method: "POST",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  const patch = <T>(path: string, body: unknown) =>
    apiFetch<T>(options, path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

  const del = <T>(path: string) =>
    apiFetch<T>(options, path, { method: "DELETE" });

  return { get, post, patch, del } as const;
}

export type ApiClient = ReturnType<typeof createApiClient>;
