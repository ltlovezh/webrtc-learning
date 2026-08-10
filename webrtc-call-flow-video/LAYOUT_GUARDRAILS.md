# Layout Guardrails

This project should be reviewed as HTML before rendering MP4.

## Rules

- Keep important content above the caption safe area. The global caption layer occupies the bottom of the frame, so do not place nodes, labels, or cards there.
- Prefer grid and flex regions for cards and repeated information. Use absolute positioning only for controlled diagram primitives.
- In diagrams, keep semantic layers separate: connector lines below, moving packets above lines, cards and nodes above both, labels above cards only when intentionally attached.
- Add any new review-sensitive moment to `quality-frames.json`.
- Run automated checks before rendering:

```bash
npm run review:layout
```

For HTML preview, use the static server and `?seek=`:

```bash
npm run preview:html
open http://127.0.0.1:3137/index.html?seek=153
```

Only render MP4 after the HTML preview and automated layout checks are clean.

## What The Automated Review Checks

`scripts/layout-review.mjs` opens each timestamp in `quality-frames.json` with system Chrome and checks visible UI elements for bounding-box intersections. It catches cases HyperFrames `inspect` often does not report, such as a label covering a card, a caption covering bottom content, or two diagram cards occupying the same visual space.

If a new overlap is intentional, mark the involved element with:

```html
data-overlap-ignore
```

Use this sparingly. Most overlaps should be fixed by layout, not ignored.
