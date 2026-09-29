import { AppShell } from "@/components/layout/app-shell";
import { requireActiveSession } from "@/lib/auth";
import { unreadCount } from "@/lib/data/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireActiveSession();
  const unread = await unreadCount(session.supabase, session.userId);
  return (
    <AppShell displayName={session.profile.displayName} isAdmin={session.isAdmin} unread={unread}>
      {children}
    </AppShell>
  );
}
