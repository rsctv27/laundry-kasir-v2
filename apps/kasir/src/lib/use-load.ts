import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { RequestError } from "./api";

/** Muat data setiap layar dibuka kembali (data kasir sering berubah). */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await fn();
      if (my === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (my === seq.current) setError(e instanceof RequestError ? e.message : "Gagal memuat data.");
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, deps);
  useFocusEffect(useCallback(() => { void run(); }, [run]));
  return { data, error, loading, reload: run, setData };
}
