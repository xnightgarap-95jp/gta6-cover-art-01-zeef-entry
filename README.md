# Vice Coast Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/xnightgarap-95jp/gta6-cover-art-01-zeef-entry/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/xnightgarap-95jp/gta6-cover-art-01-zeef-entry/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An offline web app that turns any photo and a caption into GTA 6-style cover
art: the multi-panel poster look, bold caption lettering and a Vice City
sunset or neon colour grade, exported as a PNG to share. No upload, no
account, no network — photos never leave your machine.

## What it does

- **Five layouts** — four-panel grid, hero-and-three, full-bleed, tilted
  snapshot collage, and a nine-panel grid. Each panel takes a photo of its
  own, or one photo can fill them all.
- **Six colour grades** — Vice Sunset, Neon Nights, Palm Noir, Ocean Drive,
  Heat Haze (with halftone) and Gold Hour. Gradient-map grades with grain
  and vignette, applied on canvas; each panel can wear its own grade.
- **Lettering in the genre's style** — Anton for the big title (gradient
  fill, heavy outline), Pacifico for the neon script subtitle, plus a badge
  ribbon and a five-star heat meter. Both fonts are vendored under the SIL
  Open Font License (see `app/vendor/`).
- **Crop and position per panel** — click a panel, drag to pan, scroll to
  zoom, or use the sliders. Undo and redo included.
- **Export in one click** — 1080×1080, 1080×1350 and 1920×1080, one at a
  time or all three at once.
- **Built to look the part** — palm silhouettes and a dusk skyline are drawn
  in code on every cover, so even a plain photo comes out framed like a
  poster, and the tilted collage lays the snaps on a painted sunset.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Pick a layout, a grade, a caption; load a sample photo or upload your own;
export. That is the whole flow.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `vendor/makefun-app.ts` library.

## Files

- `app/index.html`, `app/style.css` — the editor shell
- `app/src/layouts.js` — the five panel layouts
- `app/src/grades.js` — the six gradient-map grades, grain, halftone, vignette
- `app/src/cover.js` — the cover engine (panels, lettering, palms, skyline)
- `app/src/main.js` — editor state, undo/redo, export
- `app/src/shots.js` — fixed scenes for screenshots (`?shot=cover`, `?shot=editor`)
- `app/samples/` — two sample photos, made for make.fun with an image model
- `app/vendor/` — Anton and Pacifico under the SIL Open Font License
- `screenshots/` — the cover and the editor at work

## License

MIT — see `LICENSE`. No Rockstar Games logo, artwork or font is used
anywhere in this entry.
