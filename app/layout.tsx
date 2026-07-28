import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "./SessionProvider";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "CatDex",
  description: "🐱 Atrapa gatos como en una Pokédex real.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CatDex",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF8A26",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="es" className="h-full antialiased">
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-dvh flex flex-col bg-catdex-cream text-catdex-text bottom-nav-spacer">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
