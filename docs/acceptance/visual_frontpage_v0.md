# FrontPage v0 — Visual Acceptance Card (48-hour demo)

Goal you'll click
- FrontPage shows Top-10 for Qualcomm/Google/Samsung/Whirlpool/Best Buy with provider badges + relative time.
- Top-3 render **Snacks**; others show raw snippets. “Ingest now” (admin) updates the list.

Flows
1) Load FrontPage → Top-10 visible with provider badge & timeago
2) Click a headline → opens source in new tab
3) Toggle Raw ↔ Snacks on Top-3 cards
4) Trigger “Ingest now” (admin) → list updates; dedupe OK

States
- Loading skeletons, witty empty, “cached from last run” on provider error

Snacks gates (Top-3)
- Exactly 3 bullets; each ≤200 chars; opener has contrast; bullet #3 = why-it-matters
- No corporate buzzwords; contractions present; zero fabricated facts

Telemetry (must appear)
- frontpage_viewed, headline_clicked, ingest_run, summary_generated, snacks_lint_failed

Demo gate / DoD
- Vercel preview URL + 5-step demo script passes + telemetry visible + 90-sec screencast + rollback note