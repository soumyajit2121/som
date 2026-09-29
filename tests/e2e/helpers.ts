import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Password123!";

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Hello,/ })).toBeVisible();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Tomorrow-ish unique date string (YYYY-MM-DD) far enough ahead to avoid seed collisions. */
export function uniqueFutureDate(offsetDays: number) {
  const d = new Date(Date.UTC(2030, 5, 1) + offsetDays * 86_400_000 + (Date.now() % 200) * 86_400_000);
  return d.toISOString().slice(0, 10);
}
