import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users & roles" },
  { href: "/teams", label: "Teams & squads" },
  { href: "/admin/opponents", label: "Opponents" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/deliveries", label: "Notification deliveries" },
  { href: "/admin/audit", label: "Audit history" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Every admin page is server-guarded here; RLS guards the data again.
  await requireAdminSession();
  return (
    <div>
      <nav aria-label="Administration" className="mb-5 overflow-x-auto">
        <ul className="flex gap-2">
          {links.map((l) => (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                className="border-line hover:bg-brand-50 block rounded-full border bg-white px-3 py-1.5 text-sm font-medium"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
