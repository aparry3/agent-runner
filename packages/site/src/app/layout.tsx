import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "agntz.co",
    template: "%s | agntz.co",
  },
  description: "Open-source agent builder and runner with a hosted workspace when you want it.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
