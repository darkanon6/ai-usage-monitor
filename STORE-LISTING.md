# Chrome Web Store listing — reference content

Not shipped with the extension; this is submission collateral to copy into
the Chrome Web Store developer dashboard when actually publishing. See
`CLAUDE.md`'s Progress section for what's done vs. still pending before
submission (e.g. the email to Anthropic, which is intentionally out of
scope here).

## Short description (≤132 chars)
> Check your Claude.ai usage percentage on demand, with optional Discord/Telegram/Slack alerts when you cross a threshold.

## Detailed description

Usage Monitor checks your Claude.ai session and weekly usage percentage —
on demand, from the toolbar popup, or via an optional background check you
can turn on yourself. No API key or separate login: it reuses your existing
claude.ai browser session, the same way the Claude.ai website itself shows
you this information.

**What it does:**
- Shows your current session and weekly usage as a color-coded bar in the popup
- Optional alerts to Discord, Telegram, and/or Slack when usage crosses a
  threshold you configure (supports multiple thresholds, e.g. 50%/80%/95%)
- Optional self-hosted dashboard (you run it, on your own hardware) for
  viewing usage history across devices

**What it doesn't do:**
- Doesn't read your conversations or prompts — only account-level usage percentages
- Doesn't poll in the background unless you explicitly turn that on in Advanced settings
- Doesn't send your data anywhere except the alert channels/backend *you* configure

*Not affiliated with or endorsed by Anthropic. Reads your own Claude.ai
usage data from your logged-in browser session.*

Privacy policy: `<privacy policy URL — the deployed backend's /privacy.html, or wherever it ends up hosted>`

## Single Purpose statement (required by Store review)
> Shows the user their own Claude.ai usage percentage and can optionally
> alert them via Discord/Telegram/Slack when a user-defined threshold is
> crossed.

## Category
Productivity (avoid anything implying official Anthropic affiliation in category or tags/keywords)

## Permission justifications (for the review form)
- **storage** — saves settings and the most recent usage snapshot locally.
- **alarms** — only used if the user opts into Advanced background
  checking; otherwise never scheduled.
- **cookies** — reads only the `lastActiveOrg` cookie on claude.ai, to
  determine which organization's usage endpoint to call.
- **host_permissions** (claude.ai, discord.com, api.telegram.org,
  hooks.slack.com) — claude.ai to read usage; the other three only used if
  the user configures that alert channel themselves.
- **optional_host_permissions** (`http(s)://*/*`) — the Chrome-recommended
  pattern for a user-supplied endpoint. Requests permission only for the
  specific backend address the user enters, only if they opt into the
  self-hosted dashboard feature. `chrome.permissions.request()` is called
  at save-time, scoped to that one origin.

## Screenshots checklist
- [ ] Popup with usage bars populated (light + dark if feasible)
- [ ] Options page — Alert Thresholds section
- [ ] Options page — Advanced section (background polling toggle)
- [ ] Optional self-hosted dashboard, showing "Last checked" timestamp
- Caption each screenshot in the listing rather than leaving them bare.
