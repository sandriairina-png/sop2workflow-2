# Linearity-Inspired Landing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose SOP2Workflow's landing page to closely match the supplied Linearity reference while preserving the working SOP-to-n8n experience.

**Architecture:** Split the current monolithic studio into a Linearity-style hero prompt and a reusable workflow result stage that share generator state through one client component. Keep section data in next-intl JSON and restyle the existing landing blocks so every section uses the same warm-black visual system.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, next-intl, Lucide icons

**Spec:** `docs/superpowers/specs/2026-10-27-linearity-inspired-redesign.md`

## Global Constraints

- Preserve all current SOP generation, n8n JSON export, bilingual content, and credential-safety behavior.
- Match the reference composition without copying Linearity brand assets, screenshots, or text.
- Keep the primary content width between 1600px and 1700px.
- Respect keyboard focus and `prefers-reduced-motion`.
- Do not modify or remove user-owned Vite prototype files.

## Review Focus

- Empty SOP submission keeps focus in the prompt and shows actionable localized copy.
- Long SOP text does not break the hero or result-stage layout.
- Generated workflow stays visible and usable at desktop and narrow widths.
- Switching trigger modes before generation changes the exported n8n trigger node.
- Chinese and English expose equivalent controls, examples, and section order.

---

### Task 1: Linearity-style hero and shared generator state

**Files:**
- Modify: `src/themes/default/blocks/sop-workflow-studio.tsx`
- Modify: `src/config/style/global.css`
- Modify: `src/config/locale/messages/zh/pages/index.json`
- Modify: `src/config/locale/messages/en/pages/index.json`
- Test: `src/config/locale/landing-product.test.ts`

**Interfaces:**
- Consumes: `generateSopWorkflow(sop, mode, language)` and existing localized `workspace` copy.
- Produces: one `SopWorkflowStudio` client component with hero prompt and result stage sharing `sop`, `mode`, and `result` state.

- [ ] Add failing assertions for tokenized headline copy, primary CTA labels, and equivalent bilingual hero controls.
- [ ] Run `./node_modules/.bin/tsx --test src/config/locale/landing-product.test.ts` and verify the new assertions fail.
- [ ] Recompose the studio with a floating warm-glow hero, meaningful inline pills, large SOP prompt, circular generate action, pill CTA row, and scroll cue.
- [ ] Move flow/JSON/setup into a full-width product stage below the hero while preserving copy and download behavior.
- [ ] Add hero entrance, ambient glow, result reveal, focus, keyboard, and reduced-motion styles to `global.css`.
- [ ] Run the focused tests and verify they pass.

### Task 2: Editorial lower-page composition

**Files:**
- Modify: `src/themes/default/blocks/features-step.tsx`
- Modify: `src/themes/default/blocks/features.tsx`
- Modify: `src/themes/default/blocks/faq.tsx`
- Modify: `src/themes/default/blocks/cta.tsx`
- Modify: `src/config/locale/messages/zh/pages/index.json`
- Modify: `src/config/locale/messages/en/pages/index.json`
- Test: `src/config/locale/landing-product.test.ts`

**Interfaces:**
- Consumes: the warm-black design tokens established by Task 1.
- Produces: sequential editorial process canvases, a compact capability strip, reference-aligned FAQ, and closing CTA.

- [ ] Add failing assertions that the lower sections keep the approved order and carry dedicated editorial layout markers.
- [ ] Replace equal generic step cards with alternating copy/product-canvas sections for capture, structure, and export.
- [ ] Collapse feature cards into a compact icon-and-copy capability strip with large negative space.
- [ ] Restyle FAQ and CTA using the same warm borders, rounded surfaces, and focused lighting.
- [ ] Run the locale/structure test and verify it passes.

### Task 3: Header, footer, responsive fidelity, and verification

**Files:**
- Modify: `src/themes/default/layouts/landing.tsx` or the active header/footer blocks only if needed by inspection.
- Modify: `src/config/locale/messages/zh/landing.json`
- Modify: `src/config/locale/messages/en/landing.json`
- Modify: `src/config/style/global.css`
- Test: `src/config/locale/landing-product.test.ts`

**Interfaces:**
- Consumes: completed hero and lower-section structure.
- Produces: a coherent responsive page and final verified preview.

- [ ] Add failing navigation assertions for the compact product links and one primary workspace action.
- [ ] Match the reference header density, rounded CTA, mobile menu spacing, and focused footer hierarchy.
- [ ] Verify 1440px desktop, narrow mobile, focus states, reduced motion, generation, JSON tab, setup tab, and download enablement in the browser.
- [ ] Run `./node_modules/.bin/tsx --test src/shared/lib/sop-workflow.test.ts src/config/locale/landing-product.test.ts`.
- [ ] Run `./node_modules/.bin/tsc --noEmit`.
- [ ] Run `npm run build` and require exit code 0.

## Self-review

- Spec coverage: hero composition, functional generator, editorial lower sections, bilingual parity, responsive behavior, and verification all map to explicit tasks.
- Type consistency: Task 1 keeps the existing generator signature and exposes no new cross-file state API.
- Proportion: implementation detail is limited to decisions that determine fidelity; component bodies remain with the implementer.
- Review focus: each listed failure mode is covered by focused tests or browser verification in the owning task.
