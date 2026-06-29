import { createClient } from "@/lib/supabase/server";
import { InstallPrompt } from "@/components/shared/InstallPrompt";

export async function InstallPromptGate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return <InstallPrompt />;
}
