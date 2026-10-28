# SOP2Workflow Linearity-Inspired Redesign

## Intent

Rebuild the public landing page around the current Linearity homepage's composition and pacing while keeping SOP2Workflow's own name, content, icons, and functional workflow generator. The page should feel like a polished creative SaaS launch rather than a developer template or dark admin dashboard.

## Visual direction

- Near-black canvas (`#080706`) with soft warm light in amber, orange, coral, and restrained yellow-green.
- Rounded display typography with oversized, tightly tracked headlines; neutral sans-serif for body and compact utility labels.
- Translucent graphite surfaces, large soft radii, thin warm borders, inset highlights, and deep blurred shadows.
- Pill-shaped inline tokens are meaningful ERP inputs: operator/department, ERP domain, and desired automation output.
- The single signature is the interactive SOP prompt surface inside the headline glow, not decorative gradients scattered across every section.
- Motion is concentrated in the hero: token entrance, slow ambient glow, prompt focus response, generate transition, and result reveal. Respect `prefers-reduced-motion`.

## Page structure

1. Floating dark header with brand, compact product navigation, language/sign-in controls, and one bright rounded primary action.
2. Centered hero using a three-line sentence assembled from editable-looking pills: business role, ERP process, and workflow outcome.
3. Large glass SOP prompt directly below the headline, with example prompt text and a circular arrow action.
4. Two rounded calls to action plus a scroll cue.
5. A full-width workflow product stage that reveals the existing n8n flow preview, JSON view, and deployment checklist after generation.
6. Editorial product sections with large rounded product canvases and short supporting copy, rather than equal-sized generic feature cards.
7. Compact capability strip, FAQ, warm-glow closing CTA, and focused footer.

## Functional behavior

- Preserve SOP input, quick examples, manual/schedule/webhook triggers, local workflow generation, flow/JSON/setup tabs, clipboard, and JSON download.
- On generate, scroll or visually transition the user from the hero prompt into the result stage.
- Keep Chinese and English content in parity.
- Do not claim live AI inference; the existing deterministic local generator and embedded prompts remain accurately described.

## Constraints

- React 19, Next.js 16, Tailwind CSS 4, next-intl, and existing ShipAny theme loading architecture.
- Desktop-first at a 1600–1700px content width, with a coherent mobile collapse.
- No copied Linearity logos, screenshots, illustrations, source code, or brand text. Visual fidelity applies to composition, scale, spacing, surface treatment, and motion language.
- Existing user-owned prototype and unrelated dirty changes must remain untouched.

## Acceptance

- The first viewport clearly matches the reference's composition: floating header, tokenized headline, glass prompt, warm ambient glow, pill CTAs, and scroll cue.
- The SOP generator remains usable end-to-end from the first viewport.
- Lower sections continue the same visual system instead of falling back to template cards.
- Chinese and English render the same section order and equivalent controls.
- TypeScript, focused tests, production build, browser interaction, and visual inspection pass.
