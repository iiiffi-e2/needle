import { Suspense } from "react";
import { ContinueForm } from "@/components/auth/ContinueForm";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading...
        </div>
      }
    >
      <ContinueForm
        heading="Join the party"
        lede="Create an account to enter live music rooms."
        alternate={{
          prompt: "Already have an account?",
          href: "/auth/login",
          label: "Sign In",
        }}
      />
    </Suspense>
  );
}
