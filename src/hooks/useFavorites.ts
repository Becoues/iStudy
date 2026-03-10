"use client";

import { useState, useEffect, useCallback } from "react";

function getStorageKey(moduleId: string): string {
  return `knowledge-favorites:${moduleId}`;
}

export function useFavorites(moduleId: string) {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(moduleId));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavorites(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors (e.g. quota exceeded, private browsing)
    }
  }, [moduleId]);

  const toggleFavorite = useCallback(
    (itemId: string) => {
      setFavorites((prev) => {
        const next = prev.includes(itemId)
          ? prev.filter((id) => id !== itemId)
          : [...prev, itemId];

        try {
          localStorage.setItem(
            getStorageKey(moduleId),
            JSON.stringify(next)
          );
        } catch {
          // Ignore localStorage write errors
        }

        return next;
      });
    },
    [moduleId]
  );

  const isFavorite = useCallback(
    (itemId: string): boolean => {
      return favorites.includes(itemId);
    },
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}
