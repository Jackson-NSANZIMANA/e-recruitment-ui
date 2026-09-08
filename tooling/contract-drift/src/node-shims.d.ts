declare const process: {
  readonly argv: string[];
  readonly env: Record<string, string | undefined>;
  exit(code?: number): never;
};

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean };
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
}

declare module 'node:child_process' {
  export function execFileSync(
    file: string,
    args: readonly string[],
    options: { cwd: string; encoding: 'utf8'; stdio: readonly string[] },
  ): string;
}
