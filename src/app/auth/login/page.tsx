import { Suspense } from "react";
import { ContinueForm } from "@/components/auth/ContinueForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading...
        </div>
      }
    >
      <ContinueForm
        heading="Welcome back"
        lede="Sign in to join the listening party."
        alternate={{ prompt: "No account?", href: "/auth/signup", label: "Join Needle" }}
      />
    </Suspense>
  );
}
