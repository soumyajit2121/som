import { expect, test, type Page } from "@playwright/test";
import { DateTime } from "luxon";
import { signIn, signOut, uniqueFutureDate } from "./helpers";

async function selectTournament(page: Page, name: string) {
  const value = await page.locator("#field-tournamentId option", { hasText: name }).getAttribute("value");
  await page.locator("#field-tournamentId").selectOption(value!);
}

const cronHeaders = { authorization: `Bearer ${process.env.CRON_SECRET}` };

test.describe("authentication", () => {
  test("protected pages redirect to sign-in and sign-in works @mobile", async ({ page }) => {
    await page.goto("/matches");
    await expect(page).toHaveURL(/\/login\?next=%2Fmatches/);
    await page.getByLabel("Email").fill("player01@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await signIn(page, "player01@example.com");
    await expect(page.getByText("All times are India Standard Time (IST)")).toBeVisible();
    await signOut(page);
  });

  test("a pending account sees the approval screen only", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("pending@example.com");
    await page.getByLabel("Password").fill("Password123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/pending/);
    await expect(page.getByRole("heading", { name: "Waiting for approval" })).toBeVisible();
    await page.goto("/matches");
    await expect(page).toHaveURL(/\/pending/);
  });

  test("teammates do not see or reach administration", async ({ page }) => {
    await signIn(page, "player02@example.com");
    await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(0);
    await page.goto("/admin/users");
    await expect(page.getByText("That page is only available to administrators.")).toBeVisible();
  });
});

test.describe("tournament and match workflow (administrator)", () => {
  test("create, edit and archive a tournament; create tournament and practice matches in IST", async ({ page }) => {
    await signIn(page, "admin@example.com");
    const name = `E2E Cup ${Date.now()}`;

    await page.goto("/tournaments/new");
    await page.getByLabel("Tournament name").fill(name);
    await page.getByLabel("Start date (IST)").fill("2030-06-01");
    await page.getByLabel("End date (IST)").fill("2031-06-30");
    await page.getByLabel("Status").selectOption("active");
    await page.getByLabel("Strikers XI").check();
    await page.getByRole("button", { name: "Create tournament" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("01 Jun 2030 – 30 Jun 2031 (IST)")).toBeVisible();

    await page.getByRole("link", { name: "Edit tournament" }).click();
    await page.getByLabel("Organiser").fill("E2E Association");
    await page.getByRole("button", { name: "Save tournament" }).click();
    await expect(page.getByText("E2E Association")).toBeVisible();
    const tournamentUrl = page.url();

    // Tournament match: tournament is mandatory.
    await page.goto("/matches/new");
    const date = uniqueFutureDate(1);
    await page.getByLabel("Match title").fill("E2E Tournament Fixture");
    await page.getByLabel("Tournament Match").check();
    await page.getByLabel("Our team (the team you represent)").selectOption({ label: "Strikers XI" });
    await page.getByLabel("Match date (IST)").fill(date);
    await page.getByLabel("Start time (IST)").fill("07:00");
    await page.getByLabel("Reporting time (IST)").fill("06:30");
    await page.locator("#field-opponentId").selectOption({ label: "Thunder Cricket Club" });
    await page.getByRole("button", { name: "Create match" }).click();
    await expect(page.getByText("Select an enrolled tournament for a Tournament Match")).toBeVisible();

    await selectTournament(page, name);
    await page.getByRole("button", { name: "Create match" }).click();
    await expect(page.getByText("Match created.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "E2E Tournament Fixture" })).toBeVisible();
    await expect(page.getByText("Tournament Match").first()).toBeVisible();
    // Browser runs in New York, but the page must show the IST values as entered.
    await expect(page.getByText(/, 07:00 AM IST/).first()).toBeVisible();
    await expect(page.getByText("06:30 AM IST")).toBeVisible();

    // Practice match: the tournament field is disabled and cleared.
    await page.goto("/matches/new");
    await page.getByLabel("Tournament Match").check();
    await page.getByLabel("Our team (the team you represent)").selectOption({ label: "Strikers XI" });
    await selectTournament(page, name);
    await page.getByLabel("Practice Match").check();
    await expect(page.locator("#field-tournamentId")).toBeDisabled();
    await expect(page.locator("#field-tournamentId")).toHaveValue("");
    await page.getByLabel("Match title").fill("E2E Practice With Dummy");
    await page.getByLabel("Match date (IST)").fill(uniqueFutureDate(2));
    await page.getByLabel("Start time (IST)").fill("23:45");
    await page.getByLabel("Reporting time (IST)").fill("23:15");
    await page.getByLabel("Use dummy opponent").check();
    await expect(page.getByText(/Dummy Team 001/)).toBeVisible();
    await page.getByRole("button", { name: "Create match" }).click();
    await expect(page.getByText("Match created.")).toBeVisible();
    await expect(page.getByText("Practice Match (no tournament)")).toBeVisible();
    await expect(page.getByText(/Placeholder opponent\./)).toBeVisible();
    await expect(page.getByText(/11:45 PM IST/)).toBeVisible();

    // Replace the dummy opponent with a real one.
    await page.getByLabel("Replace placeholder with a real opponent").selectOption({ label: "Lakeview Warriors" });
    await page.getByRole("button", { name: "Replace opponent" }).click();
    // The page refreshes: the placeholder warning disappears and the real opponent is shown.
    await expect(page.getByText(/Placeholder opponent\./)).toHaveCount(0);
    await expect(page.getByText("Lakeview Warriors").first()).toBeVisible();

    // Archive the tournament.
    await page.goto(tournamentUrl);
    await page.getByRole("button", { name: "Archive tournament" }).click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText(/This tournament was archived on/)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("participation (teammate)", () => {
  test("teammate updates own availability; direct API cannot change another player", async ({ page }) => {
    await signIn(page, "player11@example.com");
    await page.goto("/matches?view=upcoming&q=League+Match+3");
    await page.getByRole("link", { name: "League Match 3" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "League Match 3" })).toBeVisible();
    await page.getByRole("button", { name: "Confirmed", exact: true }).click();
    await expect(page.getByTestId("my-status")).toHaveText("Confirmed");
    await expect(page.getByRole("button", { name: /Update|Remove/ })).toHaveCount(0);

    const matchId = page.url().split("/matches/")[1].split("?")[0];
    const detail = await page.request.get(`/api/matches/${matchId}`);
    expect(detail.ok()).toBe(true);
    const body = await detail.json();
    expect(body.match.startsAt).toMatch(/T07:00:00\.000\+05:30$/);
    expect(body.match.timezone).toBe("Asia/Kolkata");
    const other = body.participants.find((p: { displayName: string }) => p.displayName === "Aarav Demo");
    expect(JSON.stringify(body)).not.toMatch(/@example\.com|\+91/);

    const attack = await page.request.put(`/api/matches/${matchId}/participation`, {
      data: { profileId: other.profileId, status: "unavailable" },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(attack.status()).toBe(403);
    const self = await page.request.put(`/api/matches/${matchId}/participation`, {
      data: { status: "maybe" },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(self.status()).toBe(200);
    const promote = await page.request.put(`/api/matches/${matchId}/participation`, {
      data: { status: "playing" },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(promote.status()).toBe(403);

    const players = await (await page.request.get("/api/players")).json();
    expect(JSON.stringify(players)).not.toMatch(/@example\.com|\+91|phone|email/);
  });

  test("teammate creates a match and is included automatically @mobile", async ({ page }) => {
    await signIn(page, "player05@example.com");
    await page.goto("/matches/new");
    await expect(page.getByText("You will be added to this match automatically")).toBeVisible();
    await page.getByLabel("Match title").fill(`Mate Practice ${Date.now()}`);
    await page.getByLabel("Match date (IST)").fill(uniqueFutureDate(3));
    await page.getByLabel("Use dummy opponent").check();
    await page.getByRole("button", { name: "Create match" }).click();
    await expect(page.getByText("Match created.")).toBeVisible();
    await expect(page.getByTestId("my-status")).toHaveText("Confirmed");
    await expect(page.getByText("(match creator)")).toBeVisible();
  });
});

test.describe("notifications", () => {
  test("scheduler creates the reminder; notification centre marks read and deep-links to the match", async ({
    page,
    request,
  }) => {
    expect((await request.get("/api/cron/reminders")).status()).toBe(401);

    // A match 3 hours from now (computed in IST) is inside the 25-hour window.
    const start = DateTime.now().setZone("Asia/Kolkata").plus({ hours: 3 });
    const title = `E2E Reminder ${Date.now()}`;
    await signIn(page, "coach@example.com");
    await page.goto("/matches/new");
    await page.getByLabel("Match title").fill(title);
    await page.getByLabel("Our team (the team you represent)").selectOption({ label: "Strikers XI" });
    await page.getByLabel("Match date (IST)").fill(start.toISODate()!);
    await page.getByLabel("Start time (IST)").fill(start.toFormat("HH:mm"));
    await page.getByLabel("Reporting time (IST)").fill(start.toFormat("HH:mm"));
    await page.getByLabel("Use dummy opponent").check();
    await page.getByRole("button", { name: "Create match" }).click();
    await expect(page.getByText("Match created.")).toBeVisible();

    const run = await request.get("/api/cron/reminders", { headers: cronHeaders });
    expect(run.ok()).toBe(true);
    const again = await request.get("/api/cron/reminders", { headers: cronHeaders });
    expect((await again.json()).reminders.notificationsCreated).toBe(0);

    await page.goto("/notifications?type=insufficient_players");
    const item = page.getByTestId("notification-item").filter({ hasText: title }).first();
    await expect(item).toContainText("Only 0 of 11 players are confirmed");
    await expect(item).toContainText("CricHeroes");
    await expect(item).toContainText("IST");
    await item.getByRole("button", { name: "Mark as read" }).click();
    await expect(item.getByRole("button", { name: "Mark as unread" })).toBeVisible();
    await item.getByRole("button", { name: "Mark as unread" }).click();
    await expect(item.getByRole("button", { name: "Mark as read" })).toBeVisible();
    await item.getByRole("link", { name: /Open match/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  });

  test("unauthenticated API requests are rejected", async ({ request }) => {
    expect((await request.get("/api/matches")).status()).toBe(401);
    expect((await request.get("/api/players")).status()).toBe(401);
    expect((await request.post("/api/push/subscriptions", { data: {} })).status()).toBe(401);
  });
});

test.describe("push devices", () => {
  test("a user registers and removes a device; permission is never requested on load", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __permissionRequests: number }).__permissionRequests = 0;
      if ("Notification" in window) {
        Notification.requestPermission = async () => {
          (window as unknown as { __permissionRequests: number }).__permissionRequests++;
          return "default";
        };
      }
    });
    await signIn(page, "player07@example.com");
    await page.goto("/profile");
    await expect(page.getByText("Mobile notifications tell you")).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __permissionRequests: number }).__permissionRequests),
    ).toBe(0);

    const origin = new URL(page.url()).origin;
    const endpoint = `https://push.example.com/e2e-${Date.now()}`;
    const res = await page.request.post("/api/push/subscriptions", {
      data: { endpoint, keys: { p256dh: "p".repeat(40), auth: "a".repeat(16) }, deviceLabel: "E2E Phone" },
      headers: { origin },
    });
    expect(res.status()).toBe(201);
    const crossSite = await page.request.post("/api/push/subscriptions", {
      data: { endpoint, keys: { p256dh: "p".repeat(40), auth: "a".repeat(16) } },
      headers: { origin: "https://evil.example" },
    });
    expect(crossSite.status()).toBe(403);

    await page.reload();
    await expect(page.getByText("E2E Phone")).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("button", { name: "Remove", exact: true }).last().click();
    await expect(page.getByText("E2E Phone")).toHaveCount(0);
  });
});

test.describe("PWA", () => {
  test("manifest, icons, service worker and offline page are served", async ({ request, page }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
    expect((await request.get("/icons/icon-512.png")).ok()).toBe(true);
    const sw = await request.get("/sw.js");
    expect(await sw.text()).toContain("notificationclick");
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  });
});
