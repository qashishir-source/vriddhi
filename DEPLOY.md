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

## 3e. Policy Payouts (v2.6.0, extended in v2.6.1)
**Holdings, Policy Payouts** lets each login (adviser or client) record insurance policies that pay money back, for example
Tata AIG paying ₹94,000 a year for 10 years and then a lump sum. Click **Add policy**, enter the payout amount, frequency
(monthly, quarterly, half-yearly, yearly), first payout date, duration in years and an optional maturity lump sum. The schedule is
generated automatically (**Schedule** shows every date, financial year and Paid / Upcoming). Edit and Delete are on each row (Delete can be undone).

How it counts:
- Payouts are **income, not investment value**. They never enter a holding, the corpus, interest or any balance, so nothing is counted twice.
- They show as **Policy payouts** and **Total income** (= interest + payouts) in Yearly View, Monthly View and Interest & Income, including each report's **Copy as CSV**. Both columns can be switched on or off under **Settings, Report columns** (they only appear there once a plan has a policy).
- The Summary shows them next to **Income at Retirement** (the payouts of the first financial year after retirement).
- The **Retirement Planner** treats them as fixed-rupee income by calendar year (not inflated, like the policy itself). Untick
  "Include these payouts as income in the Retirement Planner" under the list to leave them out. The planner starts next calendar year, so payouts still to come this year are not included.
- **Column order (v2.6.1):** under **Settings > Columns** every report column can be moved with the ▲ ▼ buttons as well as switched on or off: Yearly View, Monthly View, Interest & Income (and the holding pop-up and phone cards that use them), the category columns of Yearly Savings, and the column groups of the Retirement Planner's Year-by-year plan. S.No, Year/Financial year and Ages stay at the left because they are the frozen columns (marked ⇤). The order is saved on this device, the Columns drop-down on the Reports tab lists columns in the same order, and each report has its own **Reset ... to default** button. "Copy as CSV" keeps its fixed column order.
- **Retirement row (v2.6.1):** the row for the year you retire is highlighted yellow across the whole row in every report: Yearly View, Monthly View, Interest & Income, Yearly Savings, the per-holding reports and the Retirement Planner's Year-by-year plan (and on the phone cards), in light and dark mode. A row you click to select shows the selection colour instead, until you click away.
- **Group switch (v2.6.1):** the Group switch above the holdings list also groups the **Policy Payouts** list, by payout frequency (Yearly, Quarterly and so on), with a header per group showing the count, share and totals. Click a header to collapse it. Switching it off shows the plain list again, on the table and on the phone cards.
- **Goal Planner > Summary dashboard (v2.6.1):** the corpus includes the policy payouts **received so far, added year by year** (2027: 94,000, 2028: 94,000 and so on; the maturity amount in the year it is paid). Payouts still to come are not counted until the year they are paid, so **Today** shows only what has already been received (nothing for a policy that starts next year) and **At retirement** shows the total received by then. **Current Corpus** and **Corpus at Retirement** show the policy part in their captions, the **Asset Allocation** card has a **Policy payouts** slice and a "Policy payouts by year" line for the selected view, and the goal timeline, gap and readiness use the larger corpus. The holdings, the Yearly/Monthly/Interest reports and the interest figures are unchanged.
- **Retirement Planner page: corpus and Fund Allocation (v2.6.1):** the payouts still to come are valued today at the plan's expected return and counted in the corpus (**Money Available Today**, **Current corpus**, the Money Buckets list as **Policy payouts, value today**). Fund Allocation (donut and bars, **Today** and **At age**) has its own **Policy payouts** bucket, which shrinks as payouts are received (each one moves into Household). It is the same money the planner already counted as income, so nothing is counted twice and the surplus is unchanged; "Money Needed Today" now shows the need before the policy income, matching the larger corpus. Unticking "Include these payouts as income in the Retirement Planner" removes the policy from the corpus and the allocation as well.
- **Retirement Planner reports (v2.6.1):** the Summary (and its Download Report) has a **Policy payouts** section listing each policy and what the payouts save in "money needed today"; **Other monthly money** shows the payouts and the Net spend includes them. The year-by-year plan table has an **of which policy payouts** column inside Other income received. **How it works** lists the payouts, so its arithmetic adds up to the money needed.
- The maturity lump sum is paid one period after the last regular payout (start date + duration). A payout dated before the plan's start year is history and is ignored.
- Every client plan keeps its own policies (up to 30 per plan). Policies are saved, backed up (Export backup) and synced with the plan.

**Database:** no change is needed. Policies are stored inside the plan document that is already saved in `app_docs` (jsonb), so the existing
Row Level Security (a login only reads and writes its own rows) already protects them. Re-running `supabase/schema.sql` is safe and only adds a note.
Plans saved by an older version simply have no policies and open normally.

**Tests:** `node tests/policy.test.js` (no install needed) checks the schedule maths, financial-year placement, no double counting,
retirement income, input cleaning and limits.

## Version
The version (v2.6.1) shows next to the Vriddhi name at the top left and under the sign-in box. After you deploy, if you still see an older number or none, the browser is showing a cached copy: hard-refresh (Ctrl+Shift+R) or confirm Netlify finished the new deploy.

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
