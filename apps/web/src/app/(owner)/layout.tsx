"use client";
// Kerangka web pemilik: menu samping di layar lebar, bilah atas + laci di HP.
import type { MeDto } from "@lk/shared";
import { BarChart3, FileText, LogOut, Menu, Settings, Shirt, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui";
import { MeContext } from "@/components/owner";
import { api, authClient, ClientError } from "@/lib/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/laporan", label: "Laporan", icon: FileText },
  { href: "/layanan", label: "Layanan & harga", icon: Shirt },
  { href: "/karyawan", label: "Karyawan", icon: Users },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<MeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api<MeDto>("me")
      .then((m) => {
        if (m.staff.role !== "owner" && m.staff.role !== "supervisor") return setError("Web ini untuk pemilik dan supervisor. Kasir memakai aplikasi kasir.");
        setMe(m);
      })
      .catch((e) => {
        if (e instanceof ClientError && e.status === 401) return router.replace("/masuk");
        if (e instanceof ClientError && e.code === "no_business") return router.replace("/setup");
        setError(e instanceof Error ? e.message : "Gagal memuat akun.");
      });
  }, [router]);
  useEffect(() => setOpen(false), [path]);

  const signOut = async () => { await authClient.signOut(); router.push("/masuk"); };

  if (error) return <main className="mx-auto max-w-kasir p-6"><Alert>{error}</Alert></main>;
  if (!me) return <main className="p-6 text-muted">Memuat…</main>;

  const nav = (
    <nav aria-label="Menu pemilik" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-12 items-center gap-3 rounded-md px-3 font-medium ${active ? "bg-accent-soft font-semibold text-fg" : "text-muted hover:bg-surface"}`}
          >
            <Icon aria-hidden className="size-5" /> {label}
          </Link>
        );
      })}
    </nav>
  );
  const brand = (
    <div className="min-w-0">
      <p className="truncate text-base font-semibold">{me.business.name}</p>
      <p className="truncate text-xs text-muted">kode usaha <span className="font-mono">{me.business.code}</span></p>
    </div>
  );

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-dvh lg:flex">
        {/* Layar lebar: menu samping */}
        <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface-raised p-4 lg:flex print:hidden">
          {brand}
          {nav}
          <button onClick={signOut} className="mt-auto flex h-12 items-center gap-3 rounded-md px-3 font-medium text-muted hover:bg-surface">
            <LogOut aria-hidden className="size-5" /> Keluar
          </button>
        </aside>
        {/* HP: bilah atas + laci */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface-raised px-2 lg:hidden print:hidden">
          <button aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)} className="flex size-12 items-center justify-center rounded-md">
            <Menu aria-hidden className="size-6" />
          </button>
          {brand}
        </header>
        {open && (
          <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button aria-label="Tutup menu" className="absolute inset-0 bg-fg/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-surface-raised p-4 shadow-pop">
              <div className="flex items-start justify-between gap-2">
                {brand}
                <button aria-label="Tutup menu" onClick={() => setOpen(false)} className="flex size-12 items-center justify-center rounded-md"><X aria-hidden className="size-6" /></button>
              </div>
              {nav}
              <button onClick={signOut} className="mt-auto flex h-12 items-center gap-3 rounded-md px-3 font-medium text-muted"><LogOut aria-hidden className="size-5" /> Keluar</button>
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1">
          <div className="mx-auto flex max-w-owner flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </MeContext.Provider>
  );
}
