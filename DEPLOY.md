# Vriddhi: production setup (adviser edition)

One adviser signs in and manages all client plans. Plans are stored in a Supabase database
(real sign-in, one private set of rows per login) and the page is hosted as a static site.
Allow about 30 minutes the first time. No coding needed.

## 1. Create the database (Supabase)
1. Create a free account at https://supabase.com and make a **New project**. Pick the region nearest you
   (for India, Mumbai). Save the database password somewhere safe.
2. Open **SQL Editor, New query**, paste the whole of `supabase/schema.sql`, press **Run**.
   It creates the `app_docs` table with Row Level Security, so a login can only ever read or write its own rows.
3. Open **Authentication** and find the Email sign-in settings. **Turn OFF "Allow new users to sign up"**.
   This is the most important step: otherwise anyone could create an account on your project.
4. **Authentication, Users, Add user**. Enter your email and a long, unique password (14+ characters).
   Choose to auto-confirm the email. This is your adviser login.
5. **Project Settings, API**. Copy the **Project URL** and the **anon public** key.
   Never use the `service_role` key anywhere in this app.

## 2. Add your settings
Open `config.js` and replace the two placeholders:

    supabaseUrl: "https://abcdxyz.supabase.co",
    anonKey: "eyJ...your anon public key...",

`idleMinutes` (default 30) signs you out automatically after that many idle minutes. Set 0 to turn it off.

## 3. Put the folder online
Any static host works. Easiest: **Netlify**. Go to https://app.netlify.com/drop and drag this whole
folder in. You get a https link at once. Add your own domain under Domain settings. HTTPS is automatic.
The included `_headers` file adds basic browser protections on Netlify; other hosts have their own header settings.

## 3b. Add client logins from the Users tab (do this once)
Clients each get their own private, empty workspace. They cannot see yours or each other's. You create and manage
their logins from **Settings, Users** inside the app. This needs a small server function so the admin key never
reaches the browser.

1. **Mark your login as adviser.** In Supabase, SQL Editor, New query, run the latest `supabase/schema.sql`
   again (it is safe to re-run). Then run this once, with your own adviser email:

       insert into public.advisers (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;

2. **Deploy the function.** Supabase dashboard, **Edge Functions, Deploy a new function, Via Editor**.
   Name it exactly `manage-users`. Delete the sample code, paste the whole of
   `supabase/functions/manage-users/index.ts`, and press **Deploy**. Leave "Verify JWT" switched on.
   Supabase supplies the admin key to the function by itself. You paste nothing secret anywhere.
3. Reload the app and sign in as adviser. **Settings, Users** now shows "Client logins".
   Use **+ Add client**, enter the client's email, press **Generate** for a password, **Copy** it, and **Create client**.
   Send the client the site link, their email and the password through a secure channel.
4. Optional: in the function's settings add a secret `ALLOWED_ORIGIN` with your site address
   (for example `https://yourfirm.netlify.app`) so only your site can call it.

What you can do there: add a client, reset a client's password, remove a client (this deletes their saved data).
Adviser logins are still created in the Supabase dashboard. Public sign-ups stay OFF.
Clients do not see the Users tab, and the function refuses any login that is not an adviser.

**Check it before inviting anyone:**
- Add a test client. Sign in as that client in a private window: the workspace is empty and there is no Users tab.
- Add something as the client, sign out, sign in as adviser: that data is not in your workspace.
- Remove the test client. Its rows disappear from Table Editor, app_docs.
- In the Supabase dashboard open Edge Functions, manage-users, Logs if a button shows an error.

Client passwords are 8 to 10 characters (adviser logins: 14 to 72). Clients can change their own password with the Password button (see 3c). If a client forgets it, reset it from the Users tab.
Clients can be seen by you in the Supabase dashboard (Table Editor, app_docs), so tell them how their data is handled.

## 3c. Change password (every login, built in)
Each signed-in person (adviser or client) has a **Password** button at the top right, next to Sign out.
They enter the current password, then the new one twice (clients: 8 to 10 characters; advisers: 14 to 72). The current password is checked first.
After a change, this device stays signed in and every other device is signed out. No setup is needed.

Recommended once: in Supabase, **Authentication, Sign In / Providers, Email**, set **Minimum password length** to **8** (not higher, or Supabase will refuse the 8 to 10 character client passwords).
The app enforces 8 to 10 for clients and 14+ for advisers; **redeploy the `manage-users` function** (step 3b) so the server enforces 8 to 10 for client logins too.
If someone forgets their password, the adviser resets a client's password from **Settings, Users**,
and resets their own in **Authentication, Users** in the Supabase dashboard (open the user, Send password recovery or set a new one).

## 3d. Holding snapshots (save, search by date, restore)
**Settings, Backup tab** has a **Holding snapshots** card for every login (adviser or client). Each login sees only its own snapshots.

- **Save snapshot now** stores a dated copy of the holdings of the plan you are in (holdings, gratuity inputs and custom categories). Give it a name if you like.
- **Find a snapshot**: choose a **From date** and **To date** and/or type part of the name, then **Search**. Dates use your device's local time.
- **View holdings** shows what a copy contains. **Restore** puts it back (after a confirmation) and replaces the current holdings of the plan you are in. Before restoring, the app saves your current holdings as an "Auto: before restoring ..." snapshot, and an Undo button also appears for a few seconds.
- **Delete** removes one snapshot. Removing a client login deletes that client's snapshots too.

Setup: run the latest `supabase/schema.sql` in the Supabase SQL Editor (safe to re-run). It adds the `vr_holding_snapshots` table with Row Level Security. No new function is needed.

Notes: a snapshot is a copy of the holdings only, not of family members, goals or other settings. Snapshots are saved when you press the button (nothing is saved automatically). The list shows the latest 200 matches.

## Version
The version (v2.1.2) shows next to the Vriddhi name at the top left and under the sign-in box. After you deploy, if you still see an older number or none, the browser is showing a cached copy: hard-refresh (Ctrl+Shift+R) or confirm Netlify finished the new deploy.

## 4. Check it works (do all of these before real client data)
- Open the site, sign in with your adviser email and password.
- Add a test client, then open the site on your phone, sign in, and confirm the test client is there.
- In Supabase **Table Editor, app_docs** you should see one row. Check the table shows RLS enabled.
- Sign out. The page locks and this device's local copy of client data is cleared.
- Try a wrong password and confirm it is refused.

## 5. Running it
- **Backups:** Supabase free projects have limited backups and can pause when unused. For real client data
  use a paid plan with daily backups (check Supabase's current terms), and use Settings, Export backup now and then.
- **Another adviser:** add them under Authentication, Users, then run the `insert into public.advisers` line from step 3b with their email. Each login gets its own private data;
  advisers do not see each other's clients.
- **Lost password:** reset it in the Supabase dashboard.
- **Shared computers:** the app keeps a copy of the plans in the browser until you sign out. Since v2.0.3 that copy belongs to one login only: a different login on the same browser clears it and starts empty, and it is never uploaded under the other login. Still, use trusted devices only, and sign out when you finish.

## Known limits (read before launch)
- This build was tested end to end against a **mock** Supabase server, not against a live Supabase project.
  The SQL rules in `schema.sql` have not been run on a real database by me. Do step 4 carefully.
- No two-factor sign-in yet (Supabase supports it; it needs an extra screen).
- If you edit the same client on two devices at the same moment, the later save wins for the whole file.
  Changes from another device appear within about 20 seconds.
- Clients sign in to their own separate workspace (step 3b). They do not see your plans, and you do not see theirs in the app.
- The user-management function was tested here with stand-in data, not on a live Supabase project. Run the checks in step 3b.
- Legal, privacy-policy and advisory-registration requirements for handling client financial data are
  your responsibility. Please check them with a qualified professional.
- The old in-page login (including the built-in admin account) is switched off in this build.
