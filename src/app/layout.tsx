import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stillroom | Your personal workspace",
  description: "A quieter place for tasks, notes, and projects.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/stillroom-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/stillroom.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/stillroom-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Stillroom",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0f0d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}