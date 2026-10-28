# SOP2Workflow Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the ShipAny homepage into a bilingual SOP2Workflow product landing page with a working SOP-to-n8n generator in the hero.

**Architecture:** Keep the ShipAny Next.js application as the product shell. Move the pure workflow compiler into `src/shared/lib`, expose it through a client-side hero workspace, and drive all public copy from the existing next-intl JSON catalogs.

**Tech Stack:** Next.js 16, React 19, TypeScript, next-intl, Tailwind CSS, Lucide icons, Node test runner.

**Spec:** User requirements in the current conversation.

## Global Constraints

- The generator must accept a user SOP and download an inactive n8n workflow JSON draft.
- The home hero must contain the title, description, and the usable generator panel.
- Public navigation must hide unrelated ShipAny/demo product entries.
- Chinese and English landing copy must remain structurally equivalent.
- Metadata and template branding must describe SOP2Workflow.
- Unknown ERP credentials and endpoints must never be fabricated.

## Review Focus

- Empty SOP input shows a useful validation message.
- Chinese and English copy expose the same visible sections and navigation targets.
- Downloaded workflow JSON uses valid trigger and connection shapes and stays inactive.
- The hero remains usable on narrow screens and honors reduced-motion preferences.
- Public metadata contains no ShipAny template positioning.

---

### Task 1: Shared workflow compiler

**Files:**
- Create: `src/shared/lib/sop-workflow.ts`
- Create: `src/shared/lib/sop-workflow.test.ts`

**Interfaces:**
- Produces: `generateSopWorkflow(sop, triggerMode)` and prompt constants for the hero and future server adapter.

- [ ] Write compiler tests for daily schedule extraction, notification classification, inactive export, and empty input.
- [ ] Run the tests and confirm they fail because the module does not exist.
- [ ] Implement the pure compiler.
- [ ] Run the tests and confirm they pass.

### Task 2: Product hero workspace

**Files:**
- Create: `src/themes/default/blocks/sop-workflow-studio.tsx`
- Modify: `src/themes/default/blocks/hero.tsx`
- Modify: `src/config/style/global.css`

**Interfaces:**
- Consumes: `generateSopWorkflow` from Task 1 and localized strings passed through the hero section object.
- Produces: interactive SOP input, trigger selector, node preview, JSON/setup views, copy, and download actions.

- [ ] Add a source-level contract test for required hero controls and accessibility labels.
- [ ] Run it and confirm it fails before the component exists.
- [ ] Implement the client workspace and restrained enterprise visual system.
- [ ] Run the contract test and TypeScript build.

### Task 3: Bilingual landing structure and branding

**Files:**
- Modify: `src/config/locale/messages/zh/pages/index.json`
- Modify: `src/config/locale/messages/en/pages/index.json`
- Modify: `src/config/locale/messages/zh/landing.json`
- Modify: `src/config/locale/messages/en/landing.json`
- Modify: `src/config/locale/messages/zh/common.json`
- Modify: `src/config/locale/messages/en/common.json`
- Modify: `src/config/index.ts`
- Modify: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Produces: aligned Chinese/English navigation, homepage sections, FAQ/CTA copy, and product metadata.

- [ ] Add a locale contract test for section parity, product metadata, and hidden unrelated entries.
- [ ] Run it and confirm it fails against template copy.
- [ ] Replace both locale catalogs and default metadata values.
- [ ] Run locale tests, compiler tests, and the production build.
