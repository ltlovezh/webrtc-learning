# WebRTC Call Flow Video Design

## Style Prompt

Technical whiteboard explainer for WebRTC beginners. Use a light engineering canvas, grid-aligned protocol nodes, crisp connector lines, and large readable protocol cards. The mood is calm, precise, and classroom-friendly. Every frame should help the viewer understand the relationship between signaling, SDP, ICE, DTLS, and SRTP.

## Colors

- Canvas: `#F7FAFC`
- Ink: `#102033`
- Muted ink: `#53657A`
- Rule/grid: `#D8E2EE`
- SDP accent: `#1B66D2`
- ICE accent: `#E07A1F`
- Success/media accent: `#139A63`
- Warning/relay accent: `#B45309`

## Typography

- Primary Chinese/system UI: `Hiragino Sans GB`, `Arial`, sans-serif.
- Protocol/code text: `IBM Plex Mono`, `JetBrains Mono`, monospace.
- Use 60px+ for scene titles, 28px+ for body text, and 22px+ for labels.

## Motion Rules

- Scene transitions use medium-energy horizontal push or gentle crossfade.
- Scene elements enter with varied `gsap.from()` transforms: slide, scale, line draw, and fade.
- Keep path animations deterministic and legible. Do not use random particles.
- Hold SDP and ICE cards long enough for both the viewer and narration.

## What NOT to Do

- Do not use dark neon technology styling.
- Do not rely on abstract decorative shapes without protocol meaning.
- Do not hide SDP/ICE details in tiny text.
- Do not use jump cuts between scenes.
- Do not let subtitles cover the A/B/signaling diagram or protocol cards.
