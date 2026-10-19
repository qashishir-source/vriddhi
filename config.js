/* Your Supabase settings. Both values are in Supabase: Project Settings > API.
   The anon key is meant to be public; the database rules (supabase/schema.sql) protect your data.
   NEVER paste the "service_role" key here. */
window.VR_CFG = {
  supabaseUrl: "https://muslpzbwmcjfhtctveeu.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11c2xwemJ3bWNqZmh0Y3R2ZWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDY3MDYsImV4cCI6MjEwNzg4MjcwNn0.3h1WrPAOAxgvivgygdQnrgjgBfHzzM4qNXDfGeyGZ5g",
  idleMinutes: 30,      // automatic sign-out after this many idle minutes (0 = off)
  pollSeconds: 20,      // how often another device's changes are picked up
  usersFunction: "manage-users"  // name of the Edge Function that creates client logins (see DEPLOY.md, step 3b)
};
