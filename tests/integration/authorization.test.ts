/**
 * Authorization tests. Teammates call the database API directly (PostgREST
 * with the public anon key and their own JWT), bypassing the UI entirely,
 * to prove that the rules hold at the database level.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createWorld, futureDate, insertMatch, serviceClient, type World } from "../support/fixtures";

let w: World;
beforeAll(async () => {
  w = await createWorld();
});
afterAll(async () => {
  await w?.cleanup();
});

async function adminMatch(extra: Record<string, unknown> = {}) {
  const { data, error } = await insertMatch(w.admin.db, {
    our_team_id: w.teamId,
    opponent_id: w.opponentId,
    created_by: w.admin.id,
    ...extra,
  });
  if (error) throw error;
  return data;
}

describe("tournaments", () => {
  it("administrator can create, edit and archive a tournament", async () => {
    const created = await w.admin.db
      .from("tournaments")
      .insert({
        name: `Admin Cup ${Date.now()}`,
        format: "T10",
        start_date: "2031-02-01",
        end_date: "2031-02-05",
        created_by: w.admin.id,
      })
      .select("id")
      .single();
    expect(created.error).toBeNull();
    const id = created.data!.id;

    const edited = await w.admin.db
      .from("tournaments")
      .update({ organizer: "Demo Association" }, { count: "exact" })
      .eq("id", id);
    expect(edited.error).toBeNull();
    expect(edited.count).toBe(1);

    const archived = await w.admin.db
      .from("tournaments")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .select("archived_at")
      .single();
    expect(archived.data?.archived_at).not.toBeNull();

    const audit = await w.admin.db.from("audit_logs").select("action").eq("entity_id", id);
    expect(audit.data?.map((a) => a.action)).toEqual(
      expect.arrayContaining(["tournament.created", "tournament.updated", "tournament.archived"]),
    );
    await serviceClient().from("tournaments").delete().eq("id", id);
  });

  it("a tournament with matches cannot be deleted (it must be archived)", async () => {
    await adminMatch({ category: "tournament", tournament_id: w.tournamentId });
    const del = await w.admin.db.from("tournaments").delete().eq("id", w.tournamentId);
    expect(del.error?.code).toBe("23503");
  });

  it("teammate cannot create, edit or delete tournaments", async () => {
    const insert = await w.mate1.db
      .from("tournaments")
      .insert({ name: "Sneaky Cup", format: "T20", start_date: "2031-01-01", end_date: "2031-01-02" });
    expect(insert.error?.code).toBe("42501");
    const update = await w.mate1.db
      .from("tournaments")
      .update({ name: "Hacked" }, { count: "exact" })
      .eq("id", w.tournamentId);
    expect(update.count).toBe(0);
    const enroll = await w.mate1.db
      .from("tournament_enrollments")
      .insert({ tournament_id: w.tournamentId, team_id: w.otherTeamId, status: "enrolled" });
    expect(enroll.error?.code).toBe("42501");
  });
});

describe("match categories", () => {
  it("administrator can create a Tournament match for an enrolled team", async () => {
    const m = await adminMatch({ category: "tournament", tournament_id: w.tournamentId });
    expect(m.category).toBe("tournament");
    expect(m.tournament_id).toBe(w.tournamentId);
  });

  it("administrator can create a Practice match", async () => {
    const m = await adminMatch({ category: "practice" });
    expect(m.category).toBe("practice");
    expect(m.tournament_id).toBeNull();
  });

  it("tournament selection is mandatory for a Tournament match", async () => {
    const { error } = await insertMatch(w.admin.db, {
      category: "tournament",
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.admin.id,
    });
    expect(error?.message).toBe("TOURNAMENT_REQUIRED");
  });

  it("tournament is cleared (not stored) for a Practice match", async () => {
    const m = await adminMatch({ category: "practice", tournament_id: w.tournamentId });
    expect(m.tournament_id).toBeNull();
  });

  it("a Tournament match requires our team to be enrolled", async () => {
    const { error } = await insertMatch(w.admin.db, {
      category: "tournament",
      tournament_id: w.tournamentId,
      our_team_id: w.otherTeamId,
      opponent_id: w.opponentId,
      created_by: w.admin.id,
    });
    expect(error?.message).toBe("TEAM_NOT_ENROLLED");
  });
});

describe("IST storage in the database", () => {
  it("stores the exact IST date/time and derives the correct instant", async () => {
    const date = futureDate();
    const m = await adminMatch({ match_date: date, start_time: "07:00", reporting_time: "06:15" });
    expect(m.match_date).toBe(date);
    expect(m.start_time).toBe("07:00:00");
    expect(m.timezone).toBe("Asia/Kolkata");
    expect(new Date(m.starts_at).toISOString()).toBe(`${date}T01:30:00.000Z`);
    expect(new Date(m.reporting_at!).toISOString()).toBe(`${date}T00:45:00.000Z`);
  });

  it("does not shift a match just after midnight IST to another day", async () => {
    const date = futureDate();
    const m = await adminMatch({ match_date: date, start_time: "00:30", reporting_time: "00:00" });
    expect(m.match_date).toBe(date);
    const prev = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    expect(new Date(m.starts_at).toISOString()).toBe(`${prev}T19:00:00.000Z`);
  });

  it("rejects any timezone other than Asia/Kolkata", async () => {
    const { error } = await insertMatch(w.admin.db, {
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.admin.id,
      timezone: "UTC",
    });
    expect(error?.code).toBe("23514");
  });
});

describe("participation", () => {
  it("teammate can update their own availability", async () => {
    const m = await adminMatch();
    const ins = await w.mate1.db
      .from("match_participants")
      .insert({ match_id: m.id, profile_id: w.mate1.id, status: "available" });
    expect(ins.error).toBeNull();
    const upd = await w.mate1.db
      .from("match_participants")
      .update({ status: "confirmed" })
      .eq("match_id", m.id)
      .eq("profile_id", w.mate1.id)
      .select("status, status_updated_by")
      .single();
    expect(upd.data).toEqual({ status: "confirmed", status_updated_by: w.mate1.id });
  });

  it("teammate cannot update another player's availability", async () => {
    const m = await adminMatch();
    await w.admin.db.from("match_participants").insert({ match_id: m.id, profile_id: w.mate2.id, status: "available" });
    const upd = await w.mate1.db
      .from("match_participants")
      .update({ status: "unavailable" }, { count: "exact" })
      .eq("match_id", m.id)
      .eq("profile_id", w.mate2.id);
    expect(upd.count).toBe(0);
    const check = await serviceClient()
      .from("match_participants")
      .select("status")
      .eq("match_id", m.id)
      .eq("profile_id", w.mate2.id)
      .single();
    expect(check.data?.status).toBe("available");
  });

  it("teammate cannot add another player to a match", async () => {
    const m = await adminMatch();
    const ins = await w.mate1.db
      .from("match_participants")
      .insert({ match_id: m.id, profile_id: w.mate2.id, status: "confirmed" });
    expect(ins.error?.code).toBe("42501");
  });

  it("teammate cannot remove another player from a match", async () => {
    const m = await adminMatch();
    await w.admin.db.from("match_participants").insert({ match_id: m.id, profile_id: w.mate2.id });
    const del = await w.mate1.db
      .from("match_participants")
      .delete({ count: "exact" })
      .eq("match_id", m.id)
      .eq("profile_id", w.mate2.id);
    expect(del.count).toBe(0);
    const still = await serviceClient()
      .from("match_participants")
      .select("id")
      .eq("match_id", m.id)
      .eq("profile_id", w.mate2.id);
    expect(still.data).toHaveLength(1);
  });

  it("teammate cannot select themselves into the playing XI", async () => {
    const m = await adminMatch();
    const ins = await w.mate1.db
      .from("match_participants")
      .insert({ match_id: m.id, profile_id: w.mate1.id, status: "playing" });
    expect(ins.error?.message).toBe("FORBIDDEN_FIELD");
  });

  it("teammate from another team cannot respond to this team's match", async () => {
    const m = await adminMatch();
    const ins = await w.outsider.db
      .from("match_participants")
      .insert({ match_id: m.id, profile_id: w.outsider.id, status: "available" });
    expect(ins.error?.code).toBe("42501");
  });

  it("administrator can add players, change any status and finalise the playing list", async () => {
    const m = await adminMatch();
    const add = await w.admin.db.from("match_participants").insert([
      { match_id: m.id, profile_id: w.mate1.id },
      { match_id: m.id, profile_id: w.mate2.id },
    ]);
    expect(add.error).toBeNull();
    const play = await w.admin.db
      .from("match_participants")
      .update({ status: "playing" })
      .eq("match_id", m.id)
      .select("status");
    expect(play.data?.every((p) => p.status === "playing")).toBe(true);
    const remove = await w.admin.db
      .from("match_participants")
      .delete({ count: "exact" })
      .eq("match_id", m.id)
      .eq("profile_id", w.mate2.id);
    expect(remove.count).toBe(1);
    const audit = await w.admin.db
      .from("audit_logs")
      .select("action")
      .eq("entity_type", "participant")
      .in("action", ["participant.added", "participant.removed", "participant.status_changed"]);
    expect(new Set(audit.data?.map((a) => a.action))).toEqual(
      new Set(["participant.added", "participant.removed", "participant.status_changed"]),
    );
  });

  it("more than 11 confirmed players is allowed", async () => {
    const m = await adminMatch();
    const extra = await Promise.all(
      Array.from({ length: 12 }, () =>
        serviceClient().auth.admin.createUser({
          email: `x${Math.random().toString(36).slice(2)}@example.com`,
          password: "Password-123456",
          email_confirm: true,
        }),
      ),
    );
    const ids = extra.map((e) => e.data.user!.id);
    await serviceClient().from("profiles").update({ status: "active" }).in("id", ids);
    const ins = await w.admin.db
      .from("match_participants")
      .insert(ids.map((id) => ({ match_id: m.id, profile_id: id, status: "confirmed" as const })));
    expect(ins.error).toBeNull();
    const overview = await w.admin.db
      .from("match_overview")
      .select("confirmed_count, players_needed")
      .eq("id", m.id)
      .single();
    expect(overview.data).toEqual({ confirmed_count: 12, players_needed: 0 });
    for (const id of ids) await serviceClient().auth.admin.deleteUser(id);
  });
});

describe("teammate-created matches", () => {
  it("a teammate-created match automatically includes its creator", async () => {
    const { data, error } = await insertMatch(w.mate1.db, {
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.mate1.id,
    });
    expect(error).toBeNull();
    const parts = await w.mate1.db.from("match_participants").select("profile_id, status").eq("match_id", data!.id);
    expect(parts.data).toEqual([{ profile_id: w.mate1.id, status: "confirmed" }]);
  });

  it("a teammate cannot create a match on behalf of someone else", async () => {
    const { error } = await insertMatch(w.mate1.db, {
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.mate2.id,
    });
    expect(error?.code).toBe("42501");
  });

  it("a teammate cannot create a match for a team they are not in", async () => {
    const { error } = await insertMatch(w.mate1.db, {
      our_team_id: w.otherTeamId,
      opponent_id: w.opponentId,
      created_by: w.mate1.id,
    });
    expect(error?.code).toBe("42501");
  });

  it("a teammate cannot set admin-only fields when creating a match", async () => {
    const { error } = await insertMatch(w.mate1.db, {
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.mate1.id,
      status: "confirmed",
    });
    expect(error?.message).toBe("FORBIDDEN_FIELD");
  });

  it("the creator cannot remove themselves from their match", async () => {
    const { data } = await insertMatch(w.mate1.db, {
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.mate1.id,
    });
    const del = await w.mate1.db
      .from("match_participants")
      .delete()
      .eq("match_id", data!.id)
      .eq("profile_id", w.mate1.id);
    expect(del.error?.message).toBe("CREATOR_MUST_PARTICIPATE");
  });

  it("the creator can edit basic details but not the opponent, status or category", async () => {
    const { data } = await insertMatch(w.mate1.db, {
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.mate1.id,
    });
    const ok = await w.mate1.db
      .from("matches")
      .update({ title: "Renamed by creator", notes: "Nets first" })
      .eq("id", data!.id)
      .select("title")
      .single();
    expect(ok.data?.title).toBe("Renamed by creator");
    const status = await w.mate1.db.from("matches").update({ status: "confirmed" }).eq("id", data!.id);
    expect(status.error?.message).toBe("FORBIDDEN_FIELD");
    const other = await w.mate2.db.from("matches").update({ title: "Not mine" }, { count: "exact" }).eq("id", data!.id);
    expect(other.count).toBe(0);
  });

  it("the creator can delete their match only until another player is attached", async () => {
    const first = await insertMatch(w.mate1.db, {
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.mate1.id,
    });
    const del1 = await w.mate1.db.from("matches").delete({ count: "exact" }).eq("id", first.data!.id);
    expect(del1.error).toBeNull();
    expect(del1.count).toBe(1);

    const second = await insertMatch(w.mate1.db, {
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.mate1.id,
    });
    await w.mate2.db
      .from("match_participants")
      .insert({ match_id: second.data!.id, profile_id: w.mate2.id, status: "available" });
    const del2 = await w.mate1.db.from("matches").delete({ count: "exact" }).eq("id", second.data!.id);
    expect(del2.count).toBe(0);
  });
});

describe("opponents and duplicates", () => {
  it("dummy opponents get unique generated names and an explicit flag", async () => {
    const a = await w.mate1.db.rpc("create_dummy_opponent");
    const b = await w.mate1.db.rpc("create_dummy_opponent");
    expect(a.error).toBeNull();
    expect(a.data?.is_dummy).toBe(true);
    expect(a.data?.name).toMatch(/^Dummy Team \d{3,}$/);
    expect(a.data?.name).not.toBe(b.data?.name);
  });

  it("a real opponent named like a dummy is still not a dummy", async () => {
    const r = await w.admin.db
      .from("opponents")
      .insert({ name: `Dummy Team Real ${Date.now()}` })
      .select("is_dummy")
      .single();
    expect(r.data?.is_dummy).toBe(false);
  });

  it("teammates cannot create real opponents or fake the dummy flag", async () => {
    const real = await w.mate1.db.from("opponents").insert({ name: "Mate Opp" });
    expect(real.error?.code).toBe("42501");
  });

  it("replacing a dummy opponent is recorded in the audit history", async () => {
    const dummy = await w.admin.db.rpc("create_dummy_opponent");
    const m = await adminMatch({ opponent_id: dummy.data!.id });
    await w.admin.db.from("matches").update({ opponent_id: w.opponentId }).eq("id", m.id);
    const audit = await w.admin.db
      .from("audit_logs")
      .select("action, before_values, after_values")
      .eq("entity_id", m.id)
      .eq("action", "match.opponent_replaced")
      .single();
    expect(audit.data?.before_values).toMatchObject({ opponent_name: dummy.data!.name });
  });

  it("warns about duplicate matches and lets an administrator override", async () => {
    const date = futureDate();
    await adminMatch({ match_date: date, start_time: "09:00" });
    const dup = await insertMatch(w.admin.db, {
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.admin.id,
      match_date: date,
      start_time: "09:00",
    });
    expect(dup.error?.message).toBe("DUPLICATE_MATCH");
    const override = await insertMatch(w.admin.db, {
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.admin.id,
      match_date: date,
      start_time: "09:00",
      allow_duplicate: true,
    });
    expect(override.error).toBeNull();
    const mateOverride = await insertMatch(w.mate1.db, {
      our_team_id: w.teamId,
      opponent_id: w.opponentId,
      created_by: w.mate1.id,
      match_date: date,
      start_time: "09:00",
      allow_duplicate: true,
    });
    expect(mateOverride.error?.message).toBe("FORBIDDEN_FIELD");
  });

  it("cancelling records the cancellation timestamp and notifies participants", async () => {
    const m = await adminMatch();
    await w.admin.db.from("match_participants").insert({ match_id: m.id, profile_id: w.mate1.id, status: "confirmed" });
    const c = await w.admin.db
      .from("matches")
      .update({ status: "cancelled" })
      .eq("id", m.id)
      .select("cancelled_at")
      .single();
    expect(c.data?.cancelled_at).not.toBeNull();
    const n = await w.mate1.db.from("notifications").select("type, link_path").eq("match_id", m.id);
    expect(n.data).toEqual([{ type: "match_cancelled", link_path: `/matches/${m.id}` }]);
  });
});

describe("profiles and roles", () => {
  it("teammate can update only their own profile", async () => {
    const own = await w.mate1.db
      .from("profiles")
      .update({ display_name: "Renamed Mate" })
      .eq("id", w.mate1.id)
      .select("display_name")
      .single();
    expect(own.data?.display_name).toBe("Renamed Mate");
    const other = await w.mate1.db
      .from("profiles")
      .update({ display_name: "Hacked" }, { count: "exact" })
      .eq("id", w.mate2.id);
    expect(other.count).toBe(0);
    const otherPhone = await w.mate1.db
      .from("profile_private")
      .update({ phone: "+91 90000 99999" }, { count: "exact" })
      .eq("profile_id", w.mate2.id);
    expect(otherPhone.count).toBe(0);
  });

  it("teammate cannot change roles or account status (including their own)", async () => {
    const selfPromote = await w.mate1.db.from("profiles").update({ role: "admin" }).eq("id", w.mate1.id);
    expect(selfPromote.error?.message).toBe("FORBIDDEN_FIELD");
    const approve = await w.mate1.db
      .from("profiles")
      .update({ status: "active" }, { count: "exact" })
      .eq("id", w.pending.id);
    expect(approve.count ?? 0).toBe(0);
  });

  it("teammate cannot manage team membership", async () => {
    const r = await w.mate1.db.from("team_memberships").insert({ team_id: w.otherTeamId, profile_id: w.mate1.id });
    expect(r.error?.code).toBe("42501");
  });

  it("administrator can promote an approved user, and role changes are audited", async () => {
    const r = await w.admin.db.from("profiles").update({ role: "admin" }).eq("id", w.mate2.id).select("role").single();
    expect(r.data?.role).toBe("admin");
    const audit = await w.admin.db
      .from("audit_logs")
      .select("action")
      .eq("entity_id", w.mate2.id)
      .eq("action", "profile.role_changed");
    expect(audit.data?.length).toBeGreaterThan(0);
    await w.admin.db.from("profiles").update({ role: "teammate" }).eq("id", w.mate2.id);
  });

  it("a pending user cannot be made administrator", async () => {
    const r = await w.admin.db.from("profiles").update({ role: "admin" }).eq("id", w.pending.id);
    expect(r.error?.message).toBe("ADMIN_MUST_BE_ACTIVE");
  });
});

describe("unauthenticated, pending and private data", () => {
  it("anonymous requests are rejected", async () => {
    const anon = anonClient();
    const matches = await anon.from("matches").select("id").limit(1);
    expect(matches.error?.code).toBe("42501");
    const rpc = await anon.rpc("create_dummy_opponent");
    expect(rpc.error).not.toBeNull();
  });

  it("an unapproved (pending) user can read no team information", async () => {
    const [matches, teams, tournaments, profiles] = await Promise.all([
      w.pending.db.from("matches").select("id").limit(5),
      w.pending.db.from("teams").select("id").limit(5),
      w.pending.db.from("tournaments").select("id").limit(5),
      w.pending.db.from("profiles").select("id"),
    ]);
    expect(matches.data).toEqual([]);
    expect(teams.data).toEqual([]);
    expect(tournaments.data).toEqual([]);
    expect(profiles.data?.map((p) => p.id)).toEqual([w.pending.id]);
    const insert = await w.pending.db.rpc("create_dummy_opponent");
    expect(insert.error).not.toBeNull();
  });

  it("teammates cannot read other players' phone numbers, emails or push subscriptions", async () => {
    await serviceClient().from("profile_private").update({ phone: "+91 90000 12345" }).eq("profile_id", w.mate2.id);
    await serviceClient()
      .from("push_subscriptions")
      .insert({
        profile_id: w.mate2.id,
        endpoint: `https://push.example.com/${Date.now()}`,
        p256dh: "p".repeat(40),
        auth: "a".repeat(16),
      });
    const priv = await w.mate1.db.from("profile_private").select("profile_id, phone, email");
    expect(priv.data?.map((p) => p.profile_id)).toEqual([w.mate1.id]);
    const subs = await w.mate1.db.from("push_subscriptions").select("id");
    expect(subs.data).toEqual([]);
    const adminSubs = await w.admin.db.from("push_subscriptions").select("id").eq("profile_id", w.mate2.id);
    expect(adminSubs.data).toEqual([]); // even administrators cannot read device endpoints
    const adminPriv = await w.admin.db.from("profile_private").select("phone").eq("profile_id", w.mate2.id).single();
    expect(adminPriv.data?.phone).toBe("+91 90000 12345");
  });

  it("teammates cannot read audit logs, delivery records or other people's notifications", async () => {
    const [audit, deliveries, reminders, notes] = await Promise.all([
      w.mate1.db.from("audit_logs").select("id").limit(1),
      w.mate1.db.from("notification_deliveries").select("id").limit(1),
      w.mate1.db.from("reminder_deliveries").select("id").limit(1),
      w.mate1.db.from("notifications").select("recipient_id"),
    ]);
    expect(audit.data).toEqual([]);
    expect(deliveries.data).toEqual([]);
    expect(reminders.data).toEqual([]);
    expect(notes.data?.every((n) => n.recipient_id === w.mate1.id)).toBe(true);
  });

  it("teammates cannot call scheduler functions or post announcements", async () => {
    const claim = await w.mate1.db.rpc("claim_push_deliveries", { p_limit: 10 });
    expect(claim.error).not.toBeNull();
    const ann = await w.mate1.db.rpc("post_announcement", { p_title: "Hi", p_body: "Spam" });
    expect(ann.error?.message).toBe("FORBIDDEN");
  });

  it("teammates cannot forge notifications and may only change the read marker", async () => {
    const forge = await w.mate1.db
      .from("notifications")
      .insert({ recipient_id: w.mate2.id, type: "general_announcement", title: "x", body: "y" });
    expect(forge.error).not.toBeNull();
    const n = await serviceClient()
      .from("notifications")
      .insert({ recipient_id: w.mate1.id, type: "general_announcement", title: "Hello", body: "World" })
      .select("id")
      .single();
    const read = await w.mate1.db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", n.data!.id)
      .select("read_at")
      .single();
    expect(read.data?.read_at).not.toBeNull();
    const tamper = await w.mate1.db.from("notifications").update({ title: "Changed" }).eq("id", n.data!.id);
    expect(tamper.error).not.toBeNull();
  });

  it("a deactivated user loses access immediately", async () => {
    await serviceClient().from("profiles").update({ status: "inactive" }).eq("id", w.outsider.id);
    const r = await w.outsider.db.from("matches").select("id").limit(1);
    expect(r.data).toEqual([]);
  });
});
