# Layout Guardrails

This project should be reviewed as HTML before rendering MP4.

## Rules

- Keep important content above the caption safe area. The global caption layer occupies the bottom of the frame.
- Prefer grid and flex regions for cards, comparison tables, and glossary rows.
- In diagrams, keep semantic layers separate: connector lines below, moving packets above lines, cards and nodes above both.
- Avoid diagonal connector bounding boxes unless the surrounding area is empty.
- Add any new review-sensitive moment to `quality-frames.json`.
- Only render MP4 after HTML preview and automated layout checks are clean.

## Commands

```bash
npm run preview:html
open http://127.0.0.1:3137/index.html?seek=150
npm run review:layout
```

## What The Automated Review Checks

`scripts/layout-review.mjs` opens each timestamp in `quality-frames.json` with system Chrome and checks visible UI elements for bounding-box intersections. It catches common issues such as a subtitle covering bottom content, a connector crossing text, or two cards occupying the same visual space.

If a new overlap is intentional, mark the involved element with:

```html
data-overlap-ignore
```

Use this sparingly. Most overlaps should be fixed by layout, not ignored.
