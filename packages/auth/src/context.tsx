import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { AuthState, AuthUser } from "./token.js";

// ─── Context ─────────────────────────────────────────────────────────────────

interface AuthContextValue {
  readonly state: AuthState;
  /** Exchange credentials for a session cookie via the BFF /auth/login. */
  readonly login: (email: string, password: string) => Promise<void>;
  /** Invalidate the session cookie. */
  readonly logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  /** Base URL of the agency BFF (e.g. "https://bff.rdf.usrp.gov.rw"). */
  readonly bffBaseUrl: string;
  readonly children: React.ReactNode;
}

export function AuthProvider({
  bffBaseUrl,
  children,
}: AuthProviderProps): React.ReactElement {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  // On mount, ask the BFF if we already have a valid session cookie.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${bffBaseUrl}/auth/me`, {
          credentials: "include", // send httpOnly cookie
        });
        if (!res.ok) {
          setState({ status: "unauthenticated" });
          return;
        }
        const user = (await res.json()) as AuthUser;
        setState({ status: "authenticated", user });
      } catch {
        setState({ status: "unauthenticated" });
      }
    })();
  }, [bffBaseUrl]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const res = await fetch(`${bffBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Login failed");
      }
      const user = (await res.json()) as AuthUser;
      setState({ status: "authenticated", user });
    },
    [bffBaseUrl],
  );

  const logout = useCallback(async (): Promise<void> => {
    await fetch(`${bffBaseUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setState({ status: "unauthenticated" });
  }, [bffBaseUrl]);

  return (
    <AuthContext.Provider value={{ state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used inside <AuthProvider />");
  }
  return ctx;
}

/** Convenience — returns the authenticated user or null. */
export function useAuthUser(): AuthUser | null {
  const { state } = useAuth();
  return state.status === "authenticated" ? state.user : null;
}
