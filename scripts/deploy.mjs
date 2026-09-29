#!/usr/bin/env node
/**
 * One-command production deployment: Supabase (database, auth, scheduler) + Vercel (app).
 *
 *   node scripts/deploy.mjs                 # create/update everything and deploy
 *   node scripts/deploy.mjs make-admin <email>   # after that person has signed up
 *   node scripts/deploy.mjs status
 *
 * Needs two environment variables (never commit them, never paste them in chat):
 *   SUPABASE_ACCESS_TOKEN  Supabase → Account → Access Tokens
 *   VERCEL_TOKEN           Vercel → Account Settings → Tokens
 * Optional: SUPABASE_ORG_ID, VERCEL_SCOPE (team slug), APP_NAME (default cricket-team-manager).
 *
 * Everything goes over HTTPS (Supabase Management API + Vercel CLI), so it also works
 * where direct Postgres ports are blocked. Re-running is safe: existing resources are reused
 * and generated secrets are kept in .deploy/state.json (git-ignored) or recovered from Vercel.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import webpush from "web-push";

const ROOT = new URL("..", import.meta.url).pathname;
const STATE_DIR = join(ROOT, ".deploy");
const STATE_FILE = join(STATE_DIR, "state.json");
const APP_NAME = process.env.APP_NAME ?? "cricket-team-manager";
const REGION = "ap-south-1"; // Mumbai
const SUPABASE_API = "https://api.supabase.com/v1";

const log = (msg) => console.log(`\n▶ ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);
const die = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireEnv(name) {
  const v = process.env[name];
  if (!v) die(`${name} is not set. Add it to the environment settings (not the chat) and start a new session.`);
  return v;
}

function loadState() {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
}
function saveState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

// ---------------------------------------------------------------------------
// Supabase Management API
// ---------------------------------------------------------------------------
async function sb(method, path, body) {
  const res = await fetch(`${SUPABASE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${requireEnv("SUPABASE_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(
      `Supabase API ${method} ${path} → ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
    );
    err.status = res.status;
    throw err;
  }
  return data;
}

const sql = (ref, query) => sb("POST", `/projects/${ref}/database/query`, { query });

async function ensureProject(state) {
  log("Supabase project");
  const projects = await sb("GET", "/projects");
  let project = projects.find((p) => p.id === state.projectRef) ?? projects.find((p) => p.name === APP_NAME);
  if (project) {
    ok(`reusing project ${project.name} (${project.id}, ${project.region})`);
    if (!state.dbPassword) console.log("  (database password not in local state; not needed for HTTPS deploys)");
  } else {
    let orgId = process.env.SUPABASE_ORG_ID;
    if (!orgId) {
      const orgs = await sb("GET", "/organizations");
      if (!orgs.length) die("No Supabase organization found. Create one in the Supabase dashboard first.");
      orgId = orgs[0].id;
      ok(`using organization ${orgs[0].name}`);
    }
    state.dbPassword = randomBytes(24).toString("base64url");
    project = await sb("POST", "/projects", {
      name: APP_NAME,
      organization_id: orgId,
      region: REGION,
      db_pass: state.dbPassword,
    });
    ok(`created project ${project.id} in ${REGION}`);
  }
  state.projectRef = project.id;
  saveState(state);

  process.stdout.write("  waiting for the project to become healthy");
  for (let i = 0; i < 90; i++) {
    try {
      const health = await sb("GET", `/projects/${project.id}/health?services=db&services=auth&services=rest`);
      if (Array.isArray(health) && health.every((s) => s.status === "ACTIVE_HEALTHY")) {
        console.log(" ✓");
        return project.id;
      }
    } catch {
      // not ready yet
    }
    process.stdout.write(".");
    await sleep(10_000);
  }
  die("The Supabase project did not become healthy within 15 minutes. Re-run the script later.");
}

async function applyMigrations(ref) {
  log("Database migrations");
  await sql(
    ref,
    `create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`,
  );
  const applied = new Set(
    (await sql(ref, "select version from supabase_migrations.schema_migrations")).map((r) => r.version),
  );
  const dir = join(ROOT, "supabase", "migrations");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (applied.has(version)) {
      ok(`${file} (already applied)`);
      continue;
    }
    const body = readFileSync(join(dir, file), "utf8");
    // Run the migration and record it in one transaction.
    await sql(
      ref,
      `begin;\n${body}\n;insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${rest.join("_")}');\ncommit;`,
    );
    ok(`${file} applied`);
  }
}

async function apiKeys(ref) {
  const keys = await sb("GET", `/projects/${ref}/api-keys?reveal=true`);
  const anon = keys.find((k) => k.name === "anon")?.api_key;
  const service = keys.find((k) => k.name === "service_role")?.api_key;
  if (!anon || !service) die("Could not read the project's anon/service_role keys.");
  return { anon, service };
}

async function configureAuth(ref, siteUrl) {
  log("Supabase Auth settings");
  await sb("PATCH", `/projects/${ref}/config/auth`, {
    site_url: siteUrl,
    uri_allow_list: `${siteUrl}/**`,
    password_min_length: 8,
    // New accounts still need administrator approval inside the app; skipping the email
    // confirmation step avoids the built-in email sender's low hourly limit while testing.
    mailer_autoconfirm: true,
  });
  ok(`site URL ${siteUrl}, redirect ${siteUrl}/**, email auto-confirm on (admin approval still required)`);
}

async function configureScheduler(ref, siteUrl, cronSecret) {
  log("Reminder scheduler (pg_cron every 10 minutes)");
  const quoted = (s) => `'${String(s).replace(/'/g, "''")}'`;
  await sql(ref, "create extension if not exists pg_cron; create extension if not exists pg_net;");
  await sql(
    ref,
    `do $$
     declare v_id uuid;
     begin
       select id into v_id from vault.secrets where name = 'cron_secret';
       if v_id is null then
         perform vault.create_secret(${quoted(cronSecret)}, 'cron_secret');
       else
         perform vault.update_secret(v_id, ${quoted(cronSecret)});
       end if;
     end $$;`,
  );
  await sql(
    ref,
    `select cron.unschedule(jobid) from cron.job where jobname = 'cricket-reminders';
     select cron.schedule('cricket-reminders', '*/10 * * * *', $job$
       select net.http_get(
         url := ${quoted(`${siteUrl}/api/cron/reminders`)},
         headers := jsonb_build_object('Authorization', 'Bearer ' ||
           (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
         timeout_milliseconds := 55000
       );
     $job$);`,
  );
  ok("scheduled /api/cron/reminders every 10 minutes (secret stored in Supabase Vault)");
}

// ---------------------------------------------------------------------------
// Vercel (CLI)
// ---------------------------------------------------------------------------
function vercel(args, opts = {}) {
  const full = [
    "--yes",
    "vercel@latest",
    ...args,
    "--token",
    requireEnv("VERCEL_TOKEN"),
    ...(process.env.VERCEL_SCOPE ? ["--scope", process.env.VERCEL_SCOPE] : []),
  ];
  return execFileSync("npx", full, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", opts.quiet ? "pipe" : "inherit"],
    input: opts.input,
    env: { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" },
  }).trim();
}

function vercelEnvNames() {
  try {
    const out = vercel(["env", "ls", "production"], { quiet: true });
    return new Set([...out.matchAll(/^\s*([A-Z0-9_]+)\s/gm)].map((m) => m[1]));
  } catch {
    return new Set();
  }
}

function recoverFromVercel(state) {
  if (state.cronSecret && state.vapidPrivateKey) return;
  const file = join(STATE_DIR, "vercel-production.env");
  try {
    vercel(["env", "pull", file, "--environment", "production"], { quiet: true });
    const vars = Object.fromEntries(
      readFileSync(file, "utf8")
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
        }),
    );
    state.cronSecret ??= vars.CRON_SECRET || undefined;
    state.vapidPublicKey ??= vars.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined;
    state.vapidPrivateKey ??= vars.VAPID_PRIVATE_KEY || undefined;
    writeFileSync(file, ""); // do not keep decrypted values around
  } catch {
    // New project: nothing to recover.
  }
}

function setVercelEnv(name, value, existing) {
  if (existing.has(name)) {
    try {
      vercel(["env", "rm", name, "production", "--yes"], { quiet: true });
    } catch {
      // ignore
    }
  }
  vercel(["env", "add", name, "production"], { input: value, quiet: true });
}

function productionUrl() {
  const project = JSON.parse(readFileSync(join(ROOT, ".vercel", "project.json"), "utf8"));
  const out = execFileSync(
    "curl",
    [
      "-sS",
      "-H",
      `Authorization: Bearer ${requireEnv("VERCEL_TOKEN")}`,
      `https://api.vercel.com/v9/projects/${project.projectId}${project.orgId ? `?teamId=${project.orgId}` : ""}`,
    ],
    { encoding: "utf8" },
  );
  const data = JSON.parse(out);
  const alias = data?.targets?.production?.alias?.find((a) => a.endsWith(".vercel.app")) ?? data?.alias?.[0]?.domain;
  return alias ? `https://${alias}` : `https://${APP_NAME}.vercel.app`;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function deploy() {
  requireEnv("SUPABASE_ACCESS_TOKEN");
  requireEnv("VERCEL_TOKEN");
  const state = loadState();

  const ref = await ensureProject(state);
  await applyMigrations(ref);
  const keys = await apiKeys(ref);
  const supabaseUrl = `https://${ref}.supabase.co`;

  log("Vercel project");
  vercel(["link", "--project", APP_NAME], { quiet: true });
  ok(`linked ${APP_NAME}`);
  recoverFromVercel(state);
  if (!state.cronSecret) state.cronSecret = randomBytes(32).toString("hex");
  if (!state.vapidPrivateKey) {
    const v = webpush.generateVAPIDKeys();
    state.vapidPublicKey = v.publicKey;
    state.vapidPrivateKey = v.privateKey;
  }
  saveState(state);

  // First deployment determines the stable production URL.
  const siteUrl = state.siteUrl ?? productionUrl();
  state.siteUrl = siteUrl;
  saveState(state);

  log("Vercel environment variables (production)");
  const existing = vercelEnvNames();
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon,
    SUPABASE_SERVICE_ROLE_KEY: keys.service,
    NEXT_PUBLIC_SITE_URL: siteUrl,
    CRON_SECRET: state.cronSecret,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: state.vapidPublicKey,
    VAPID_PRIVATE_KEY: state.vapidPrivateKey,
    VAPID_SUBJECT: "mailto:admin@example.com",
  };
  for (const [name, value] of Object.entries(env)) {
    setVercelEnv(name, value, existing);
    ok(name);
  }

  log("Deploying to Vercel (remote build, a few minutes)");
  const deploymentUrl = vercel(["deploy", "--prod"], { quiet: true }).split("\n").pop();
  ok(`deployment ${deploymentUrl}`);
  const finalUrl = productionUrl();
  if (finalUrl !== siteUrl) {
    state.siteUrl = finalUrl;
    saveState(state);
    console.log(`  production URL is ${finalUrl}; updating NEXT_PUBLIC_SITE_URL and redeploying`);
    setVercelEnv("NEXT_PUBLIC_SITE_URL", finalUrl, new Set(["NEXT_PUBLIC_SITE_URL"]));
    vercel(["deploy", "--prod"], { quiet: true });
  }

  await configureAuth(ref, state.siteUrl);
  await configureScheduler(ref, state.siteUrl, state.cronSecret);
  await smoke(state);

  console.log(`\n✅ Deployed: ${state.siteUrl}`);
  console.log("Next: sign up in the app, then run `node scripts/deploy.mjs make-admin <your email>`.");
}

async function smoke(state) {
  log("Production smoke test");
  const url = state.siteUrl;
  const check = async (path, expect, init) => {
    const res = await fetch(`${url}${path}`, { redirect: "manual", ...init });
    const pass = expect(res);
    console.log(`  ${pass ? "✓" : "✗"} ${path} → ${res.status}`);
    return pass;
  };
  const results = [
    await check("/login", (r) => r.status === 200),
    await check("/", (r) => r.status === 307 || r.status === 308),
    await check("/manifest.webmanifest", (r) => r.status === 200),
    await check("/sw.js", (r) => r.status === 200),
    await check("/api/matches", (r) => r.status === 401),
    await check("/api/cron/reminders", (r) => r.status === 401),
    await check("/api/cron/reminders", (r) => r.status === 200, {
      headers: { Authorization: `Bearer ${state.cronSecret}` },
    }),
  ];
  const headers = (await fetch(`${url}/login`)).headers;
  console.log(`  ${headers.get("content-security-policy") ? "✓" : "✗"} security headers present`);
  if (results.includes(false)) console.log("  Some smoke checks failed — see above.");
}

async function makeAdmin(email) {
  if (!email) die("Usage: node scripts/deploy.mjs make-admin <email>");
  const state = loadState();
  const ref = state.projectRef ?? (await sb("GET", "/projects")).find((p) => p.name === APP_NAME)?.id;
  if (!ref) die("No deployed project found. Run the deploy first.");
  const safe = email.toLowerCase().replace(/'/g, "''");
  const rows = await sql(
    ref,
    `update public.profiles set status = 'active', role = 'admin'
     where id = (select id from auth.users where lower(email) = '${safe}')
     returning id;`,
  );
  if (!rows.length) die(`No account for ${email}. Sign up in the app first, then re-run.`);
  ok(`${email} is now an active administrator`);
}

async function status() {
  const state = loadState();
  console.log(JSON.stringify({ projectRef: state.projectRef, siteUrl: state.siteUrl }, null, 2));
}

const [command = "deploy", arg] = process.argv.slice(2);
const commands = { deploy, "make-admin": () => makeAdmin(arg), status };
if (!commands[command]) die(`Unknown command ${command}. Use deploy | make-admin <email> | status.`);
commands[command]().catch((e) => die(e.message));
