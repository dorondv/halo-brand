'use client';

import React, { createContext, use, useCallback, useEffect, useSyncExternalStore } from 'react';

type BrandContextType = {
  selectedBrandId: string | null;
  setSelectedBrandId: (brandId: string | null) => void;
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

const STORAGE_KEY = 'halo-brand-selected-brand-id';

// Storage subscription for useSyncExternalStore (Next.js 16+ best practice)
function getSnapshot(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && stored !== 'all' && stored !== '' ? stored : null;
}

function getServerSnapshot(): string | null {
  return null; // Always return null on server
}

// Store callbacks for same-window updates
const storageCallbacks = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  storageCallbacks.add(callback);

  // Listen for storage events (cross-tab synchronization)
  window.addEventListener('storage', callback);

  return () => {
    storageCallbacks.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

// Notify all subscribers of localStorage changes
function notifySubscribers() {
  storageCallbacks.forEach(callback => callback());
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  // Use useSyncExternalStore for localStorage (Next.js 16+ best practice)
  // This prevents hydration mismatches and provides better SSR support
  const selectedBrandId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Sync to cookie when brand changes (for server-side reading)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (selectedBrandId === null) {
      document.cookie = 'selected-brand-id=; path=/; max-age=0';
    } else {
      document.cookie = `selected-brand-id=${selectedBrandId}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [selectedBrandId]);

  // Persist to localStorage whenever selectedBrandId changes
  // Cookie is set in useEffect above to keep them in sync
  const setSelectedBrandId = useCallback((brandId: string | null) => {
    if (typeof window === 'undefined') {
      return;
    }

    const normalizedBrandId = brandId === null || brandId === 'all' ? null : brandId;

    if (normalizedBrandId === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, normalizedBrandId);
    }

    // Notify subscribers in the same window (storage events only fire cross-tab)
    notifySubscribers();
  }, []);

  return (
    <BrandContext value={{ selectedBrandId, setSelectedBrandId }}>
      {children}
    </BrandContext>
  );
}

export function useBrand() {
  const context = use(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}
