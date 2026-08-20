/**
 * Typed errors returned by USRP BFF endpoints.
 * The BFF always responds with `{ code, message, details? }` on 4xx/5xx.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

export class NetworkError extends Error {
  constructor() {
    super("Network request failed — offline or server unreachable");
    this.name = "NetworkError";
  }
}

interface BffErrorBody {
  code: string;
  message: string;
}

/** Throws ApiError or NetworkError; never returns on failure. */
export async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;

  let body: BffErrorBody = { code: "UNKNOWN", message: res.statusText };
  try {
    body = (await res.json()) as BffErrorBody;
  } catch {
    // body not JSON — use defaults above
  }
  throw new ApiError(res.status, body.code, body.message);
}
