import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NeedleLogo } from "@/components/shared/NeedleLogo";
import { UserMenu } from "@/components/shared/UserMenu";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <nav className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--ndl-line)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--ndl-bg0)_92%,transparent),transparent)]">
      <Link href="/" className="flex items-center gap-2.5 group">
        <NeedleLogo size={32} />
        <span className="font-display text-xl font-extrabold tracking-tight group-hover:text-glow-soft transition-colors">
          Needle
        </span>
      </Link>

      <div className="flex items-center gap-3 sm:gap-4">
        {user ? (
          <>
            <Link
              href="/friends"
              className="text-sm text-muted hover:text-glow-soft transition-colors font-medium"
            >
              Friends
            </Link>
            <Link
              href="/rooms/create"
              className="text-sm text-muted hover:text-glow-soft transition-colors font-medium"
            >
              Create Room
            </Link>
            <UserMenu
              userId={user.id}
              displayName={profile?.display_name || "Profile"}
            />
          </>
        ) : (
          <>
            <Link
              href="/auth/login"
              className="text-sm text-muted hover:text-foreground transition-colors font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm btn-primary px-4 py-1.5 rounded-full font-bold"
            >
              Join
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
