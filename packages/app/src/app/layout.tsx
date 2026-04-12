import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Runner",
  description: "Define, run, and manage AI agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">
        <div className="flex min-h-screen">
          <nav className="w-56 border-r border-zinc-800 p-4 flex flex-col gap-1">
            <Link href="/" className="text-lg font-semibold mb-4 px-2">
              Agent Runner
            </Link>
            <NavLink href="/agents">Agents</NavLink>
            <NavLink href="/sessions">Sessions</NavLink>
            <NavLink href="/logs">Logs</NavLink>
            <NavLink href="/tools">Tools</NavLink>
          </nav>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
    >
      {children}
    </Link>
  );
}
