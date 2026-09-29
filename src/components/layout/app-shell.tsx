import { Bell, LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth";
import { Nav } from "./nav";

export function AppShell({
  children,
  displayName,
  isAdmin,
  unread,
}: {
  children: React.ReactNode;
  displayName: string;
  isAdmin: boolean;
  unread: number;
}) {
  return (
    <div className="min-h-dvh">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="border-line sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-brand-800 flex items-center gap-2 font-bold">
            <span aria-hidden="true" className="bg-brand-700 grid h-8 w-8 place-items-center rounded-full text-white">
              🏏
            </span>
            <span>Team Manager</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/notifications"
              className="relative rounded-lg p-2 hover:bg-gray-100 lg:hidden"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unread > 0 ? (
                <span
                  className="absolute -top-0.5 -right-0.5 rounded-full bg-red-700 px-1.5 text-[10px] font-bold text-white"
                  aria-hidden="true"
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <span className="text-muted hidden text-sm sm:inline">
              {displayName}
              {isAdmin ? " · Administrator" : ""}
            </span>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
        <div className="lg:hidden">
          <Nav isAdmin={isAdmin} unread={unread} variant="strip" />
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20">
            <Nav isAdmin={isAdmin} unread={unread} variant="sidebar" />
          </div>
        </aside>
        <main id="main" className="min-w-0 flex-1" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
