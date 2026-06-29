import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { InstallPromptGate } from "@/components/shared/InstallPromptGate";
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Needle — Live Social Music Rooms",
  description:
    "Join live listening rooms. Three DJs, one vibe, everyone hears the same song.",
  applicationName: "Needle",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Needle",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0704",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${hanken.variable} h-full`}>
      <body className="min-h-full antialiased">
        {children}
        <InstallPromptGate />
        <ServiceWorkerRegister />
        <div id="needle-overlay-root" />
        <Analytics />
      </body>
    </html>
  );
}
