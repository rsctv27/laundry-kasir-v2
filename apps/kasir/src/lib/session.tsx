import type { MeDto } from "@lk/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, loadToken, RequestError, setUnauthorizedHandler, signIn as apiSignIn, signOut as apiSignOut } from "./api";

type Status = "loading" | "signedOut" | "signedIn";
interface SessionValue {
  status: Status;
  me: MeDto | null;
  signIn: (code: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<MeDto | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => { setMe(null); setStatus("signedOut"); });
    (async () => {
      if (!(await loadToken())) return setStatus("signedOut");
      try {
        setMe(await api<MeDto>("me"));
        setStatus("signedIn");
      } catch (e) {
        // Offline saat membuka aplikasi: tetap dianggap keluar, kasir bisa login lagi saat sinyal kembali.
        setStatus(e instanceof RequestError && e.status === 0 ? "signedOut" : "signedOut");
      }
    })();
  }, []);

  const signIn = useCallback(async (code: string, username: string, password: string) => {
    const m = await apiSignIn(code, username, password);
    setMe(m);
    setStatus("signedIn");
  }, []);
  const signOut = useCallback(async () => {
    await apiSignOut();
    setMe(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo(() => ({ status, me, signIn, signOut }), [status, me, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession di luar SessionProvider");
  return v;
}
