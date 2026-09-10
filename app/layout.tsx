import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfaf8",
};

export async function generateMetadata(): Promise<Metadata> {
  const origin = "https://auxilo.app";

  return {
    metadataBase: new URL(origin),
    title: "Auxilo — Your day, in sync",
    description: "A calm command center for tasks, email, calendar, GitHub, reminders, and projects.",
    applicationName: "Auxilo",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Auxilo",
    },
    formatDetection: { telephone: false },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
      apple: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      title: "Auxilo — Your day, in sync",
      description: "A calm command center for everything that needs your attention.",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Auxilo — Your day, in sync" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Auxilo — Your day, in sync",
      description: "A calm command center for everything that needs your attention.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
