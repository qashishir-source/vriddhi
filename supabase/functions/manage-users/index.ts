// Vriddhi: manage-users (Supabase Edge Function)
// Lets a signed-in ADVISER create, list, reset and remove CLIENT logins from the Users tab.
// The admin key (service role) stays on Supabase's servers. It is never sent to the browser.
// Deploy: Supabase dashboard > Edge Functions > Deploy a new function > name it: manage-users
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*"; // optional: set to your site, e.g. https://yourfirm.netlify.app
const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const MIN_PW = 8, MAX_PW = 10; // client passwords: 8 to 10 characters
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function send(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const fail = (status: number, error: string) => send(status, { error });

// deno-lint-ignore no-explicit-any
export async function handle(req: Request, admin: any): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail(405, "Method not allowed.");

  // 1. Who is calling? Verify the sign-in token with Supabase.
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") || "");
  if (!m) return fail(401, "Not signed in.");
  const { data: who, error: whoErr } = await admin.auth.getUser(m[1]);
  if (whoErr || !who || !who.user) return fail(401, "Not signed in.");
  const me = who.user.id as string;

  // 2. Is the caller an adviser? Clients are refused here, whatever they send.
  const { data: adv, error: advErr } = await admin.from("advisers").select("user_id").eq("user_id", me).maybeSingle();
  if (advErr) return fail(500, "Adviser check failed. Run the latest supabase/schema.sql.");
  if (!adv) return fail(403, "Only advisers can manage users.");

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return fail(400, "Bad request."); }
  const action = String(b.action || "");

  const adviserIds = async (): Promise<Set<string>> => {
    const { data } = await admin.from("advisers").select("user_id");
    return new Set((data || []).map((r: { user_id: string }) => r.user_id));
  };
  const checkPw = (pw: unknown): string | null => {
    if (typeof pw !== "string" || pw.length < MIN_PW || pw.length > MAX_PW) return `Password must be ${MIN_PW} to ${MAX_PW} characters.`;
    if (new TextEncoder().encode(pw).length > MAX_PW) return `Password must be at most ${MAX_PW} characters.`;
    return null;
  };

  if (action === "list") {
    const ids = await adviserIds();
    const out: unknown[] = [];
    for (let page = 1; page <= 25; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return fail(500, "Could not list users.");
      const us = (data && data.users) || [];
      for (const u of us) out.push({ id: u.id, email: u.email || "", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at || null, role: ids.has(u.id) ? "adviser" : "client" });
      if (us.length < 200) break;
    }
    return send(200, { users: out });
  }

  if (action === "create") {
    const email = String(b.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return fail(400, "Enter a valid email address.");
    const pe = checkPw(b.password);
    if (pe) return fail(400, pe);
    const { data, error } = await admin.auth.admin.createUser({ email, password: b.password as string, email_confirm: true });
    if (error) {
      const dup = /already|registered|exists/i.test(error.message || "");
      return fail(dup ? 409 : 400, dup ? "A login with this email already exists." : "Could not create the login.");
    }
    return send(200, { id: data.user.id, email: data.user.email });
  }

  if (action === "reset" || action === "delete") {
    const id = String(b.id || "");
    if (!UUID_RE.test(id)) return fail(400, "Bad request.");
    if (id === me) return fail(400, "You cannot change your own login here.");
    if ((await adviserIds()).has(id)) return fail(403, "Adviser logins are managed in the Supabase dashboard.");
    if (action === "reset") {
      const pe = checkPw(b.password);
      if (pe) return fail(400, pe);
      const { error } = await admin.auth.admin.updateUserById(id, { password: b.password as string });
      if (error) return fail(400, "Could not reset the password.");
      return send(200, { ok: true });
    }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return fail(400, "Could not remove the login.");
    return send(200, { ok: true });
  }

  return fail(400, "Unknown action.");
}

if (import.meta.main !== false && typeof Deno !== "undefined" && Deno.serve) {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  Deno.serve((req: Request) => handle(req, admin));
}
