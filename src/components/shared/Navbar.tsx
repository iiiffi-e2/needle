import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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
    <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
      <Link href="/" className="flex items-center gap-2 group">
        <span className="text-2xl">🪡</span>
        <span className="text-xl font-semibold tracking-tight group-hover:text-accent transition-colors">
          Needle
        </span>
      </Link>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <Link
              href="/rooms/create"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Create Room
            </Link>
            <Link
              href={`/profile/${user.id}`}
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              {profile?.display_name || "Profile"}
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/auth/login"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm bg-accent text-background px-4 py-1.5 rounded-full font-medium hover:bg-accent/90 transition-colors"
            >
              Join
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
