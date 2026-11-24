"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "./api";

/**
 * A tiny keyed data cache for GET endpoints: shared across components,
 * stale-while-revalidate, with prefix invalidation after mutations.
 */

type Entry<T> = { data?: T; error?: Error; loading: boolean; promise?: Promise<void>; stamp: number };

const store = new Map<string, Entry<unknown>>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function get<T>(key: string): Entry<T> {
  let e = store.get(key) as Entry<T> | undefined;
  if (!e) {
    e = { loading: false, stamp: 0 };
    store.set(key, e as Entry<unknown>);
  }
  return e;
}

export function fetchResource<T>(key: string): Promise<void> {
  const e = get<T>(key);
  if (e.promise) return e.promise;
  store.set(key, { ...e, loading: true });
  emit();
  const promise = api<T>(key)
    .then((data) => {
      store.set(key, { data, loading: false, stamp: Date.now() });
    })
    .catch((error: Error) => {
      store.set(key, { ...get<T>(key), error, loading: false, promise: undefined, stamp: Date.now() });
    })
    .finally(() => {
      const cur = get<T>(key);
      store.set(key, { ...cur, promise: undefined });
      emit();
    });
  store.set(key, { ...get<T>(key), promise });
  return promise;
}

/** Re-fetch every cached key that starts with one of the prefixes. */
export function invalidate(...prefixes: string[]) {
  for (const key of store.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) void fetchResource(key);
  }
}

/** Optimistically replace cached data for a key. */
export function mutateResource<T>(key: string, updater: (cur: T | undefined) => T | undefined) {
  const e = get<T>(key);
  store.set(key, { ...e, data: updater(e.data) });
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useResource<T>(key: string | null) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (key ? (store.get(key) as Entry<T> | undefined) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (!key) return;
    const e = get<T>(key);
    if (!e.data && !e.promise && !e.error) void fetchResource<T>(key);
  }, [key]);
  const reload = useCallback(() => (key ? fetchResource<T>(key) : Promise.resolve()), [key]);
  return {
    data: snapshot?.data as T | undefined,
    error: snapshot?.error,
    loading: !!key && (!snapshot || (snapshot.loading && !snapshot.data)),
    refreshing: !!snapshot?.loading,
    reload,
  };
}
