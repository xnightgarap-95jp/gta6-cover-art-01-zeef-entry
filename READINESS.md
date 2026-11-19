# Vice Coast Cover Studio — readiness

## What it is
An offline cover-art maker: five multi-panel layouts, six gradient-map
grades, Anton + Pacifico lettering (OFL), badge ribbon and star heat meter,
per-panel crop/position/grade, undo/redo, PNG export in 1080×1080,
1080×1350 and 1920×1080 (one at a time or all three at once).

## Checks run
- [x] `node main.ts` twice — byte-identical dossier output (sha256 5e5e0ca8…e8f9e5, both runs)
- [x] kit check `node cli/makefun.mjs check --kit . --repo <folder>` — 4 passed, 0 failed, 17 skipped (transcript checks run server-side)
- [x] app opens offline in a desktop browser, zero console errors, zero non-local requests (all non-localhost requests blocked in test: none attempted)
- [x] photo upload (FileReader path) + crop/position (drag/wheel/sliders) + all 5 layouts + all 6 grades + all 3 export sizes work; exports verified as real PNGs 1080×1080, 1080×1350, 1920×1080
- [x] 4 screenshots taken and visually checked (cover first, editor second); undo/redo verified (incl. a debounce race fix in main.js)

## Notes
- Fonts: Anton and Pacifico, downloaded from the google/fonts GitHub repo,
  SIL OFL texts beside them under `app/vendor/`.
- Sample photos: the kit's two starter samples (made for make.fun, free to
  use), under `app/samples/`.
- No Rockstar logo, artwork or font anywhere in the entry.
