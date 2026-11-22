import Link from "next/link";
import { APP_NAME, AppMark } from "@/components/brand";

// Halaman daftar, masuk, dan siapkan usaha: pita biru tipis dengan tanda aplikasi di atas form.
export default function AkunLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="bg-accent px-4 text-on-accent">
        <div className="mx-auto flex h-16 max-w-kasir items-center">
          <Link href="/" className="flex items-center gap-3 rounded-md font-semibold focus-visible:outline-on-accent">
            <AppMark size="sm" inverse /> {APP_NAME}
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
