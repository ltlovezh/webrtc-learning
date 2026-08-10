# WebRTC Media Data Flow Video Design

## Style Prompt

Technical whiteboard explainer for WebRTC beginners. Use a light engineering canvas, grid-aligned topology diagrams, crisp connector lines, and large readable cards. The mood is calm, precise, and classroom-friendly. Every frame should help the viewer distinguish transport paths from media distribution architecture.

## Colors

- Canvas: `#F7FAFC`
- Ink: `#102033`
- Muted ink: `#53657A`
- Rule/grid: `#D8E2EE`
- P2P/media accent: `#139A63`
- TURN relay accent: `#E07A1F`
- SFU accent: `#1B66D2`
- MCU/CDN accent: `#7C3AED`
- Warning/failure accent: `#DC2626`

## Typography

- Primary Chinese/system UI: `sans-serif`.
- Protocol/code text: `monospace`.
- Use 60px+ for scene titles, 28px+ for body text, and 20px+ for labels.

## Motion Rules

- Scene transitions use medium-energy horizontal push or gentle crossfade.
- Scene elements enter with varied `gsap.from()` transforms: slide, scale, line draw, and fade.
- Keep path animations deterministic and legible. Do not use random particles.
- Use animated packets only when they clarify where RTP/SRTP/RTCP flows.

## What NOT to Do

- Do not use dark neon technology styling.
- Do not put P2P, TURN, SFU, MCU, and CDN in one overloaded diagram.
- Do not hide acronym definitions in tiny text.
- Do not use jump cuts between scenes.
- Do not let subtitles cover topology nodes, labels, protocol cards, or comparison tables.
