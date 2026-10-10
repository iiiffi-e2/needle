import Link from "next/link";
import { Navbar } from "@/components/shared/Navbar";

export const LEGAL_ENTITY = "Needle LLC";
export const SUPPORT_EMAIL = "support@onneedle.com";

export function SupportEmail() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-glow-soft hover:underline">
      {SUPPORT_EMAIL}
    </a>
  );
}

export function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-14">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Needle</p>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mt-2">
          {title}
        </h1>
        <p className="text-sm text-muted mt-3">Last updated {updated}</p>
        <div className="mt-10 space-y-9 text-[15.5px] leading-relaxed">{children}</div>
        <nav className="mt-14 pt-6 border-t border-line flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
        </nav>
      </main>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
      <div className="space-y-3 text-muted">{children}</div>
    </section>
  );
}
