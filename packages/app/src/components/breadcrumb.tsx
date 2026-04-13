import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-zinc-400 mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-zinc-600">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-zinc-200 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-zinc-200">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
