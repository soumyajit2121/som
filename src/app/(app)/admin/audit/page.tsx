import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminSession } from "@/lib/auth";
import { formatIst } from "@/lib/ist";

export const metadata: Metadata = { title: "Audit history" };

const ENTITIES = [
  "match",
  "participant",
  "tournament",
  "tournament_enrollment",
  "profile",
  "team",
  "team_membership",
  "opponent",
  "venue",
];
const PAGE = 50;

function summarize(values: unknown): string {
  if (!values || typeof values !== "object") return "—";
  return Object.entries(values as Record<string, unknown>)
    .filter(([k]) => k !== "id")
    .slice(0, 8)
    .map(([k, v]) => `${k}: ${v === null ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const sp = await searchParams;
  const { supabase } = await requireAdminSession();
  const entity = ENTITIES.includes(sp.entity as string) ? (sp.entity as string) : undefined;
  const page = Math.max(0, Number(sp.page) || 0);
  let q = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, before_values, after_values, created_at, profiles(display_name)")
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (entity) q = q.eq("entity_type", entity);
  const { data: logs } = await q;

  return (
    <div>
      <PageHeader
        title="Audit history"
        description="Important changes, newest first. Times in IST. Only administrators can see this."
      />
      <form className="border-line mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3">
        <div>
          <Label htmlFor="entity">Record type</Label>
          <Select id="entity" name="entity" defaultValue={entity ?? ""}>
            <option value="">All</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      {logs?.length ? (
        <div className="border-line overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="p-2">
                  When (IST)
                </th>
                <th scope="col" className="p-2">
                  Actor
                </th>
                <th scope="col" className="p-2">
                  Action
                </th>
                <th scope="col" className="p-2">
                  Before
                </th>
                <th scope="col" className="p-2">
                  After
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-line border-t align-top">
                  <td className="p-2 whitespace-nowrap">{formatIst(l.created_at)}</td>
                  <td className="p-2">{l.profiles?.display_name ?? "System"}</td>
                  <td className="p-2 font-mono text-xs">
                    {l.action}
                    {l.entity_type === "match" && l.entity_id ? (
                      <Link href={`/matches/${l.entity_id}`} className="text-brand-700 ml-1 underline">
                        view
                      </Link>
                    ) : null}
                  </td>
                  <td className="max-w-xs p-2 text-xs break-words">{summarize(l.before_values)}</td>
                  <td className="max-w-xs p-2 text-xs break-words">{summarize(l.after_values)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No audit entries" />
      )}
      <div className="mt-3 flex gap-2">
        {page > 0 ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/audit?page=${page - 1}${entity ? `&entity=${entity}` : ""}`}>Newer</Link>
          </Button>
        ) : null}
        {logs?.length === PAGE ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/audit?page=${page + 1}${entity ? `&entity=${entity}` : ""}`}>Older</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
