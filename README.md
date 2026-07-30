# ALPreps Bracketology

Brackets and region standings for the AHSAA high school football playoffs, with a
browser-based admin suite and one-click publishing. Hosted on Vercel.

Live site: **https://jlflux-github-io.vercel.app/**
Admin: **/admin.html** (intentionally not linked from the public site)

## Features

- **Brackets** for every classification with the correct format:
  | Class | Group | Regions | Qualify / region | Teams | Notes |
  |-------|-------|---------|------------------|-------|-------|
  | 6A | Public | 4 | 6 | 24 | Top 2 seeds per region bye straight into round 2 |
  | 5A–1A | Public | 8 | 4 | 32 each | Adjacent regions paired into pods |
  | AA | Private | 2 | 4 | 8 | Two regions cross-seeded |
  | A | Private | 4 | 4 | 16 | Two pods of two regions |
- **Seed labels** (e.g. `R4-2` = 2nd place in Region 4) travel with each team as
  it advances, so every slot shows who's there and where they came from.
- Each slot shows the **team name (left)** and **score (right)**, with an **(H)**
  tag on the home team. Click a game for a pop-up with date, time, location, home
  team, and both teams' overall & region records.
- **Byes keep the full bracket shape** (e.g. 6A is a 32-slot bracket): a bye team
  sits in the first round with a blank slot beside it and advances automatically.
- Faint **connector lines** show advancement; round titles sit across the top and
  the whole bracket **scales to fit the screen** (no horizontal scrollbar).
- **Projected results** toggle on every bracket — shows the projected bracket you
  set by hand in the admin (see below).
- **Region standings** tab: teams in seeded order with overall record, region
  record, and a colored **Status** pill (Clinched / High / Medium / Low / Out).
  Per-region notes appear under each table.
- **Top notes / tiebreakers** box near the top of the public site.
- **Dark / light mode**, brand red `#e01b1b`, fully responsive.

## Admin suite (`admin.html`)

Login: `jl@fluxmedia.org` / `alpreps2026`.

- **Standings & Seeding** — drag the `⠿` handle to reorder teams (order = seed;
  top N qualify and feed the bracket). Edit name, overall/region records, and
  status inline. Add/remove teams. Write per-region notes.
- **Bracket & Results** — a visual bracket you arrange yourself. **Drag a seed**
  (e.g. `R4-2`) onto any slot to place it; the team follows the region standings,
  so re-seeding a region updates the bracket. **Click a match-up** to open a popup
  and enter score, **home/away** (check the home team → shows as "H"), winner
  override, date, time, location and a note.
- **Projected Bracket** — click a team to project them as a game's winner; they
  advance to the next round. This is what the public "Show projected results"
  toggle displays. Games with an actual result are locked to that result.
- **Site Settings** — season label and the top notes/tiebreakers box.

### Publishing changes

Edits auto-save in your browser as you type. Click **🚀 Save & Publish** to push
them live for everyone — that's the whole workflow.

Under the hood the button posts to `/api/publish` (a Vercel serverless function),
which commits `data/data.json` to this repo; Vercel then redeploys automatically,
so the change is live in about a minute. The public site always reads the
published `data/data.json`, never your local draft.

The first time you publish you'll be asked for your **publish key**; it's
remembered in that browser afterwards (**Forget publish key** clears it).

#### One-time Vercel setup

In the Vercel project → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `PUBLISH_KEY` | Any strong secret you choose — this is what the admin asks for |
| `GITHUB_TOKEN` | A GitHub fine-grained token with **Contents: Read and write** on this repo |

Optional overrides: `GITHUB_REPO` (default `jlflux/jlflux.github.io`) and
`GITHUB_BRANCH` (default `main`). Redeploy once after adding them.

The `GITHUB_TOKEN` stays on Vercel's server and is never sent to the browser.

#### Backup / manual tools

**Export JSON** downloads a backup, **Import JSON** loads one back in, and
**Reset to published** discards local edits and reloads what's live. To preview an
unpublished draft on the public page, append `?preview=1` to the URL.

> The admin login is a convenience gate, not server-enforced security. Publishing
> *is* protected server-side by `PUBLISH_KEY`. Anything published in
> `data/data.json` is public.

## Project structure

```
index.html            Public site (Brackets + Region Standings tabs)
admin.html            Admin suite (not linked from the public site)
api/publish.js        Serverless function: commits data.json to publish
assets/css/style.css  Styles, theming, responsive layout
assets/js/data.js     Data model, bracket templates, tree builder, resolution
assets/js/public.js   Public rendering
assets/js/admin.js    Admin editor
data/data.json        Published data (edit via admin -> Export -> commit here)
```

## Local development

```
python3 -m http.server 8099
# then open http://localhost:8099/
```
