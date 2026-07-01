// AGAM Cloud Sync Configuration
// ─────────────────────────────────────────────────────────────────────────────
// To enable cloud sync across devices:
//  1. Go to https://supabase.com → create a free project
//  2. Run the SQL in CLOUD_SETUP.md in the Supabase SQL editor
//  3. Copy your Project URL and anon/public key from Project Settings → API
//  4. Paste them below, then push to GitHub — the app will sync automatically
//
// ⚠️  NOTE: Once this file is committed to GitHub, the anon key is PUBLIC.
//     Your data will be protected only by Supabase's Row Level Security (RLS).
//     The setup SQL in CLOUD_SETUP.md enables RLS with an allow-all policy,
//     which means anyone with the key can read the data. This is acceptable
//     for a self-hosted personal app. If you need stronger security, enable
//     Supabase Auth and contact the developer.
// ─────────────────────────────────────────────────────────────────────────────

window.SUPABASE_URL = ""; // e.g. "https://abcdefgh.supabase.co"
window.SUPABASE_KEY = ""; // e.g. "eyJhbGciOiJIUzI1NiIs..."
