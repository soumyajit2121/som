import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { TournamentForm } from "@/components/tournaments/tournament-form";
import { requireAdminSession } from "@/lib/auth";
import { addIstDays, todayIst } from "@/lib/ist";

export const metadata: Metadata = { title: "New tournament" };

export default async function NewTournamentPage() {
  const { supabase } = await requireAdminSession();
  const [{ data: venues }, { data: teams }] = await Promise.all([
    supabase.from("venues").select("id, name").eq("is_active", true).order("name"),
    supabase.from("teams").select("id, name").eq("is_active", true).order("name"),
  ]);
  const today = todayIst();
  return (
    <div className="max-w-3xl">
      <PageHeader title="New tournament" />
      <TournamentForm
        venues={venues ?? []}
        teams={teams ?? []}
        initial={{
          name: "",
          organizer: "",
          format: "T20",
          startDate: today,
          endDate: addIstDays(today, 14),
          venueId: "",
          location: "",
          websiteUrl: "",
          notes: "",
          status: "upcoming",
        }}
      />
    </div>
  );
}
