// ══════════════════════════════════════════════════════════════════
// field-ops — React access to the on-device runtime (S08).
//
// The runtime is opened once per tab, on first use. If it cannot open (no
// IndexedDB, no Ed25519) the context carries the error and the stations show
// the paper fallback instead of capturing anything.
// ══════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useState } from 'react';
import { openDeviceRuntime, type DeviceRuntime } from './device.ts';

export type RuntimeState =
  | { readonly status: 'opening' }
  | { readonly status: 'ready'; readonly runtime: DeviceRuntime }
  | { readonly status: 'failed'; readonly message: string };

const Context = createContext<RuntimeState>({ status: 'opening' });

let shared: Promise<DeviceRuntime> | null = null;

export function DeviceRuntimeProvider({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  const [state, setState] = useState<RuntimeState>({ status: 'opening' });
  useEffect(() => {
    let live = true;
    shared ??= openDeviceRuntime();
    shared.then(
      (runtime) => { if (live) setState({ status: 'ready', runtime }); },
      (error: unknown) => { shared = null; if (live) setState({ status: 'failed', message: error instanceof Error ? error.message : 'unknown' }); },
    );
    return () => { live = false; };
  }, []);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export const useDeviceRuntime = (): RuntimeState => useContext(Context);

/** navigator.onLine, as an honest "the device has a link", never "the server has it". */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = (): void => { setOnline(true); };
    const down = (): void => { setOnline(false); };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}
