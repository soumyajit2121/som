import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Server-only secrets. Importing this module from client code fails the build. */
export const serverEnv = {
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  cronSecret: () => required("CRON_SECRET"),
  vapidPrivateKey: () => process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: () => process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
};
