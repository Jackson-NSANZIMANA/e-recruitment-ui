import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@usrp/api-client';

export type Load<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'failed'; readonly httpStatus: number; readonly offline: boolean };

/** One edge READ with a manual reload. Reads only; a write is never run from here. */
export function useEdgeRead<T>(read: (() => Promise<T>) | null, key: string): { readonly load: Load<T>; readonly reload: () => void } {
  const [load, setLoad] = useState<Load<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (read === null) return;
    let live = true;
    setLoad({ status: 'loading' });
    read().then(
      (data) => { if (live) setLoad({ status: 'ready', data }); },
      (error: unknown) => {
        if (!live) return;
        const n = error instanceof ApiError ? error.normalised : null;
        setLoad({ status: 'failed', httpStatus: n !== null && 'status' in n ? n.status : 0, offline: n?.kind === 'network' });
      },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the read's inputs
  }, [key, tick]);
  const reload = useCallback(() => { setTick((n) => n + 1); }, []);
  return { load, reload };
}
