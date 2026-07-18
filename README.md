# AHSAA Football Playoff Brackets

A static site (GitHub Pages) that houses brackets and region standings for the
AHSAA high school football playoffs, with a full browser-based admin suite.

Live site: **https://jlflux.github.io/** · Admin: **https://jlflux.github.io/admin.html**

## Features

- **Brackets** for every classification with the correct format:
  | Class | Group | Regions | Qualify / region | Teams | Notes |
  |-------|-------|---------|------------------|-------|-------|
  | 6A | Public | 4 | 6 | 24 | Top 2 seeds per region bye straight into round 2 |
  | 5A–1A | Public | 8 | 4 | 32 each | Adjacent regions paired into pods |
  | AA | Private | 2 | 4 | 8 | Two regions cross-seeded |
  | A | Private | 4 | 4 | 16 | Two pods of two regions |
- **Seed labels** on the left of every first-round slot (e.g. `R4-2` = 2nd
  place in Region 4), auto-derived from the standings order.
- Each slot shows the **team name (left)** and **score (right)**. Click a game
  for a pop-up with date, time, location, and both teams' overall & region records.
- **Bye teams advance directly** into the second round — no "vs BYE" games.
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
- **Bracket & Results** — drag to set **region alignment** (which region sits
  where / how regions are paired). Enter scores to advance winners automatically,
  or pick a winner manually for ties. Add date, time, location and a note per game.
- **Projected Bracket** — click a team to project them as a game's winner; they
  advance to the next round. This is what the public "Show projected results"
  toggle displays. Games with an actual result are locked to that result.
- **Site Settings** — season label and the top notes/tiebreakers box.

### Publishing changes

GitHub Pages is a **static host** — there is no server or database, so the admin
saves your working edits in the browser (`localStorage`). To publish to the live
site:

1. Make your edits in the admin (they auto-save locally as you type).
2. Click **Export JSON** (downloads `data.json`).
3. Commit that file to **`data/data.json`** in this repo.

The public site loads `data/data.json`. **Reset to published** discards local
edits and reloads the committed file. **Import JSON** loads a `data.json` back
into the editor (e.g. on another computer).

> The login is a convenience gate only. Because the site is fully static, it is
> not server-enforced security — anything published in `data/data.json` is public.

## Project structure

```
index.html            Public site (Brackets + Region Standings tabs)
admin.html            Admin suite
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
