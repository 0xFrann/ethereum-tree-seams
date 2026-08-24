'use client';

import { useSyncExternalStore } from 'react';

const storageKey = 'ethereum-annual-rings:introduction-seen';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const storageListener = (event: StorageEvent) => {
    if (event.key === storageKey) listener();
  };
  window.addEventListener('storage', storageListener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', storageListener);
  };
}

function clientSnapshot(): boolean {
  return sessionStorage.getItem(storageKey) !== 'true';
}

export function useSessionIntroduction() {
  const open = useSyncExternalStore(subscribe, clientSnapshot, () => true);
  return {
    open,
    show: () => {
      sessionStorage.removeItem(storageKey);
      listeners.forEach((listener) => listener());
    },
    dismiss: () => {
      sessionStorage.setItem(storageKey, 'true');
      listeners.forEach((listener) => listener());
    },
  };
}
