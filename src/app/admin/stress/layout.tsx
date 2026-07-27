import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Stress harness",
};

export default function StressAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
