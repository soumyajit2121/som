import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { TournamentForm } from "@/components/tournaments/tournament-form";
import { requireAdminSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit tournament" };

export default async function EditTournamentPage({ params }: PageProps<"/tournaments/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireAdminSession();
  const [{ data: t }, { data: venues }] = await Promise.all([
    supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
    supabase.from("venues").select("id, name").eq("is_active", true).order("name"),
  ]);
  if (!t) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit tournament" description={t.name} />
      <TournamentForm
        tournamentId={t.id}
        venues={venues ?? []}
        initial={{
          name: t.name,
          organizer: t.organizer ?? "",
          format: t.format,
          startDate: t.start_date,
          endDate: t.end_date,
          venueId: t.venue_id ?? "",
          location: t.location ?? "",
          websiteUrl: t.website_url ?? "",
          notes: t.notes ?? "",
          status: t.status,
        }}
      />
    </div>
  );
}
