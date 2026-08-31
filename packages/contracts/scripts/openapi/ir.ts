// ════════════════════════════════════════════════════════════════
// The intermediate representation every tool in this package reads.
//
// ONE loader, ONE set of facts. The Zod emitter, the fixture validator, the
// route table and the drift checker all consume this. That is deliberate: the
// failure this package exists to prevent is two hand-maintained copies of one
// truth, and rebuilding it once per tool would reintroduce exactly that.
// ════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseYaml, type YamlValue } from "./yaml.ts";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
export type AuthKind = "officer" | "system" | "applicant-session" | "none";
export type Reach = "browser" | "service-internal";

export interface SchemaNode {
  readonly [key: string]: YamlValue;
}

export interface ResponseFact {
  readonly status: string;
  readonly description: string;
  /** Component schema name, or null for a body-less response (204, probes). */
  readonly schema: string | null;
  readonly mediaType: string | null;
}

export interface OperationFact {
  readonly operationId: string;
  readonly path: string;
  readonly method: HttpMethod;
  readonly summary: string;
  readonly auth: readonly AuthKind[];
  readonly reach: Reach;
  readonly source: string;
  readonly verified: string;
  readonly requestSchema: string | null;
  readonly requestMediaType: string | null;
  readonly queryParams: readonly string[];
  readonly responses: readonly ResponseFact[];
}

export interface ServiceContract {
  readonly service: string;
  readonly file: string;
  readonly title: string;
  readonly backendSha: string;
  readonly operations: readonly OperationFact[];
  readonly schemas: ReadonlyMap<string, SchemaNode>;
}

const METHODS: readonly HttpMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
];
const AUTH_KINDS: readonly AuthKind[] = [
  "officer",
  "system",
  "applicant-session",
  "none",
];

export class ContractError extends Error {
  readonly file: string;

  constructor(message: string, file: string) {
    super(`${file}: ${message}`);
    this.name = "ContractError";
    this.file = file;
  }
}

function asRecord(
  value: YamlValue,
  what: string,
  file: string,
): Record<string, YamlValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ContractError(`${what} must be a mapping`, file);
  }
  return value as Record<string, YamlValue>;
}

function requireString(value: YamlValue, what: string, file: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ContractError(`${what} must be a non-empty string`, file);
  }
  return value;
}

/** `#/components/schemas/Foo` -> `Foo`. Anything else is rejected. */
export function refName(ref: string, file: string): string {
  const prefix = "#/components/schemas/";
  if (!ref.startsWith(prefix)) {
    throw new ContractError(
      `only local component refs are supported, got "${ref}"`,
      file,
    );
  }
  const name = ref.slice(prefix.length);
  if (name.length === 0 || name.includes("/")) {
    throw new ContractError(`malformed ref "${ref}"`, file);
  }
  return name;
}

function readSchemaRef(
  container: Record<string, YamlValue> | undefined,
  file: string,
): { schema: string | null; mediaType: string | null } {
  if (container === undefined) return { schema: null, mediaType: null };
  const content = container["content"];
  if (content === undefined) return { schema: null, mediaType: null };
  const media = asRecord(content, "content", file);
  const mediaType = Object.keys(media)[0];
  if (mediaType === undefined) return { schema: null, mediaType: null };
  const entry = asRecord(media[mediaType]!, `content.${mediaType}`, file);
  const schema = entry["schema"];
  if (schema === undefined) return { schema: null, mediaType };
  const ref = asRecord(schema, "schema", file)["$ref"];
  if (typeof ref !== "string") {
    throw new ContractError(
      `every request/response schema must be a $ref to a named component (media type ${mediaType})`,
      file,
    );
  }
  return { schema: refName(ref, file), mediaType };
}

function readAuth(
  raw: YamlValue,
  operationId: string,
  file: string,
): readonly AuthKind[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ContractError(
      `${operationId}: x-usrp-auth must be a non-empty array`,
      file,
    );
  }
  return raw.map((kind) => {
    if (typeof kind !== "string" || !AUTH_KINDS.includes(kind as AuthKind)) {
      throw new ContractError(
        `${operationId}: unknown auth kind "${String(kind)}" (expected one of ${AUTH_KINDS.join(", ")})`,
        file,
      );
    }
    return kind as AuthKind;
  });
}

export function loadContract(dir: string, file: string): ServiceContract {
  const doc = asRecord(
    parseYaml(readFileSync(join(dir, file), "utf8"), file),
    "document",
    file,
  );
  if (doc["openapi"] !== "3.1.0") {
    throw new ContractError(
      'every document must declare openapi: "3.1.0"',
      file,
    );
  }
  const info = asRecord(doc["info"] ?? null, "info", file);
  const title = requireString(info["title"] ?? null, "info.title", file);
  const backendSha = requireString(
    info["x-usrp-backend-sha"] ?? null,
    "info.x-usrp-backend-sha",
    file,
  );

  const schemas = new Map<string, SchemaNode>();
  const components = doc["components"];
  if (components !== undefined) {
    const raw = asRecord(components, "components", file)["schemas"];
    if (raw !== undefined) {
      for (const [name, node] of Object.entries(
        asRecord(raw, "components.schemas", file),
      )) {
        schemas.set(
          name,
          asRecord(node, `components.schemas.${name}`, file) as SchemaNode,
        );
      }
    }
  }

  const operations: OperationFact[] = [];
  const paths = asRecord(doc["paths"] ?? null, "paths", file);
  for (const [path, pathItemRaw] of Object.entries(paths)) {
    if (path.includes("{") || path.includes("$")) {
      throw new ContractError(
        `INVARIANT 1: "${path}" looks templated. shared-http routes by EXACT path only; ids travel in the body or a query param.`,
        file,
      );
    }
    const pathItem = asRecord(pathItemRaw, `paths.${path}`, file);
    for (const method of METHODS) {
      const opRaw = pathItem[method];
      if (opRaw === undefined) continue;
      const op = asRecord(opRaw, `paths.${path}.${method}`, file);
      const operationId = requireString(
        op["operationId"] ?? null,
        `${path} ${method} operationId`,
        file,
      );
      const reach = requireString(
        op["x-usrp-reach"] ?? null,
        `${operationId} x-usrp-reach`,
        file,
      );
      if (reach !== "browser" && reach !== "service-internal") {
        throw new ContractError(
          `${operationId}: x-usrp-reach must be browser|service-internal`,
          file,
        );
      }

      const requestBody = op["requestBody"];
      const request = readSchemaRef(
        requestBody === undefined
          ? undefined
          : asRecord(requestBody, "requestBody", file),
        file,
      );

      const queryParams: string[] = [];
      const parameters = op["parameters"];
      if (parameters !== undefined) {
        if (!Array.isArray(parameters)) {
          throw new ContractError(
            `${operationId}: parameters must be an array`,
            file,
          );
        }
        for (const p of parameters) {
          const param = asRecord(p, "parameter", file);
          if (param["in"] !== "query") {
            throw new ContractError(
              `${operationId}: only query parameters exist in this platform (got in: ${String(param["in"])})`,
              file,
            );
          }
          queryParams.push(
            requireString(param["name"] ?? null, "parameter.name", file),
          );
        }
      }

      const responses: ResponseFact[] = [];
      for (const [status, resRaw] of Object.entries(
        asRecord(op["responses"] ?? null, `${operationId}.responses`, file),
      )) {
        if (!/^[1-5]\d\d$/.test(status)) {
          throw new ContractError(
            `${operationId}: "${status}" is not an HTTP status code`,
            file,
          );
        }
        const res = asRecord(
          resRaw,
          `${operationId}.responses.${status}`,
          file,
        );
        const { schema, mediaType } = readSchemaRef(res, file);
        responses.push({
          status,
          description:
            typeof res["description"] === "string" ? res["description"] : "",
          schema,
          mediaType,
        });
      }
      if (responses.length === 0) {
        throw new ContractError(`${operationId}: declares no responses`, file);
      }

      operations.push({
        operationId,
        path,
        method,
        summary: typeof op["summary"] === "string" ? op["summary"] : "",
        auth: readAuth(op["x-usrp-auth"] ?? null, operationId, file),
        reach,
        source: requireString(
          op["x-usrp-source"] ?? null,
          `${operationId} x-usrp-source`,
          file,
        ),
        verified: requireString(
          op["x-usrp-verified"] ?? null,
          `${operationId} x-usrp-verified`,
          file,
        ),
        requestSchema: request.schema,
        requestMediaType: request.mediaType,
        queryParams,
        responses,
      });
    }
  }

  // Every referenced component must exist, and every component must be reachable.
  const referenced = new Set<string>();
  const walk = (node: YamlValue): void => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string")
        referenced.add(refName(value, file));
      else walk(value);
    }
  };
  walk(doc["paths"] ?? null);
  for (const node of schemas.values()) walk(node as unknown as YamlValue);
  for (const name of referenced) {
    if (!schemas.has(name)) {
      throw new ContractError(
        `$ref to undefined component schema "${name}"`,
        file,
      );
    }
  }
  for (const name of schemas.keys()) {
    if (!referenced.has(name)) {
      throw new ContractError(
        `component schema "${name}" is defined and never referenced. An unreachable schema is a contract nobody is held to — delete it or wire it up.`,
        file,
      );
    }
  }

  return {
    service: file.replace(/\.yaml$/, ""),
    file,
    title,
    backendSha,
    operations,
    schemas,
  };
}

export function loadAllContracts(dir: string): readonly ServiceContract[] {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort();
  if (files.length === 0)
    throw new ContractError("no OpenAPI documents found", dir);
  const contracts = files.map((file) => loadContract(dir, file));
  const shas = new Set(contracts.map((c) => c.backendSha));
  if (shas.size !== 1) {
    throw new ContractError(
      `documents disagree about the verified backend SHA: ${[...shas].join(", ")}. A contract pinned to two commits is pinned to neither.`,
      dir,
    );
  }
  const seen = new Map<string, string>();
  for (const contract of contracts) {
    for (const op of contract.operations) {
      const previous = seen.get(op.operationId);
      if (previous !== undefined) {
        throw new ContractError(
          `duplicate operationId "${op.operationId}" (also in ${previous})`,
          contract.file,
        );
      }
      seen.set(op.operationId, contract.file);
    }
  }
  return contracts;
}

/** Dependency-first ordering so emitted `const` declarations never forward-reference. */
export function topoSortSchemas(contract: ServiceContract): readonly string[] {
  const deps = new Map<string, Set<string>>();
  for (const [name, node] of contract.schemas) {
    const set = new Set<string>();
    const walk = (value: YamlValue): void => {
      if (value === null || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (key === "$ref" && typeof child === "string")
          set.add(refName(child, contract.file));
        else walk(child);
      }
    };
    walk(node as unknown as YamlValue);
    deps.set(name, set);
  }
  const ordered: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (name: string, trail: readonly string[]): void => {
    const current = state.get(name);
    if (current === "done") return;
    if (current === "visiting") {
      throw new ContractError(
        `schema reference cycle: ${[...trail, name].join(" -> ")}. Zod would need a lazy() thunk; break the cycle instead.`,
        contract.file,
      );
    }
    state.set(name, "visiting");
    for (const dep of [...(deps.get(name) ?? [])].sort())
      visit(dep, [...trail, name]);
    state.set(name, "done");
    ordered.push(name);
  };
  for (const name of [...contract.schemas.keys()].sort()) visit(name, []);
  return ordered;
}
