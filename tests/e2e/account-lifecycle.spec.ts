import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

test("sign-up requires administrator approval before team data is visible", async ({ browser }) => {
  const email = `newbie-${Date.now()}@example.com`;
  const newbie = await (await browser.newContext()).newPage();
  await newbie.goto("/signup");
  await newbie.getByLabel("Display name").fill("Newbie Demo");
  await newbie.getByLabel("Email").fill(email);
  await newbie.getByLabel("Password").fill("Password123!");
  await newbie.getByRole("button", { name: "Create account" }).click();
  await expect(newbie.getByRole("heading", { name: "Waiting for approval" })).toBeVisible();
  expect((await newbie.request.get("/api/matches")).status()).toBe(401);

  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, "admin@example.com");
  await admin.goto("/admin/users?status=pending&q=Newbie");
  await admin
    .getByTestId("user-row")
    .filter({ hasText: "Newbie Demo" })
    .getByRole("button", { name: "Approve" })
    .click();
  // The approved account leaves the "pending" list.
  await expect(admin.getByTestId("user-row").filter({ hasText: "Newbie Demo" })).toHaveCount(0);

  await newbie.goto("/");
  await expect(newbie.getByRole("heading", { level: 1, name: "Hello, Newbie Demo" })).toBeVisible();
});

test("password reset by email", async ({ page, request }) => {
  const reachable = await request
    .get(`${MAILPIT}/api/v1/messages`)
    .then((r) => r.ok())
    .catch(() => false);
  test.skip(!reachable, "Mailpit (local Supabase inbox) is not reachable");

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("player14@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists for that email")).toBeVisible();

  let link: string | undefined;
  for (let i = 0; i < 20 && !link; i++) {
    const list = await (await request.get(`${MAILPIT}/api/v1/search?query=to:player14@example.com`)).json();
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json();
      link = /href="([^"]+)"/.exec(msg.HTML ?? "")?.[1]?.replace(/&amp;/g, "&");
    }
    if (!link) await page.waitForTimeout(500);
  }
  expect(link).toBeTruthy();
  await page.goto(link!);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await page.locator("#field-password").fill("NewPassword456!");
  await page.getByLabel("Confirm new password").fill("NewPassword456!");
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByText("Your password has been updated.")).toBeVisible();
});
