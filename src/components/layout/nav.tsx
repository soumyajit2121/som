"use client";

import { Bell, CalendarDays, LayoutDashboard, ListChecks, Settings2, Shield, Trophy, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/matches", label: "Matches", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ isAdmin, unread, variant }: { isAdmin: boolean; unread: number; variant: "sidebar" | "strip" }) {
  const pathname = usePathname();
  const all = isAdmin ? [...items, { href: "/admin", label: "Administration", icon: Settings2 }] : items;
  return (
    <nav aria-label="Primary">
      <ul className={variant === "sidebar" ? "flex flex-col gap-1" : "flex gap-1 overflow-x-auto px-3 pb-2"}>
        {all.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-brand-700 text-white" : "text-ink hover:bg-brand-50",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{label}</span>
                {href === "/notifications" && unread > 0 ? (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 text-xs font-bold",
                      active ? "text-brand-800 bg-white" : "bg-red-700 text-white",
                    )}
                    data-testid="unread-badge"
                  >
                    {unread > 99 ? "99+" : unread}
                    <span className="sr-only"> unread</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
