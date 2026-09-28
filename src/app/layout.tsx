import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stillroom | Your personal workspace",
  description: "A quieter place for tasks, notes, and projects.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}