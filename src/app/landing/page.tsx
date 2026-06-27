import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function LandingAltPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", user.id)
      .single();
    displayName = profile?.display_name ?? undefined;
  }

  return (
    <LandingPage
      isLoggedIn={!!user}
      userId={user?.id}
      displayName={displayName}
      hero="statement"
    />
  );
}
