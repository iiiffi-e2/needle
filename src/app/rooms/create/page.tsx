import { redirect } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";
import { CreateRoomForm } from "@/components/shared/CreateRoomForm";
import { createClient } from "@/lib/supabase/server";

export default async function CreateRoomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/rooms/create");
  }

  return (
    <div className="min-h-screen venue-bg">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="font-display text-2xl font-extrabold mb-2">Open a Room</h1>
        <p className="text-muted mb-8">
          Every room needs a name, a vibe, and someone willing to go first.
        </p>
        <CreateRoomForm />
      </main>
    </div>
  );
}
