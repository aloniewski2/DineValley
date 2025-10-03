import { useCallback, useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return defaultValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch (error) {
      console.warn(`Failed reading localStorage key "${key}"`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed writing localStorage key "${key}"`, error);
    }
  }, [key, value]);

  const update = useCallback((updater: (prev: T) => T) => {
    setValue((prev) => updater(prev));
  }, []);

  return [value, update] as const;
}
