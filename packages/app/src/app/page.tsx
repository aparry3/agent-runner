import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Agent Runner</h1>
      <p className="text-zinc-400 mb-8">
        Define, run, and manage AI agents with YAML manifests.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <DashboardCard
          href="/agents"
          title="Agents"
          description="Create and manage agent definitions"
        />
        <DashboardCard
          href="/sessions"
          title="Sessions"
          description="Browse conversation history"
        />
        <DashboardCard
          href="/logs"
          title="Logs"
          description="View invocation logs"
        />
        <DashboardCard
          href="/tools"
          title="Tools"
          description="Inspect registered tools"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors"
    >
      <h2 className="font-semibold mb-1">{title}</h2>
      <p className="text-sm text-zinc-400">{description}</p>
    </Link>
  );
}
