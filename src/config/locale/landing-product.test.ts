import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

function json(path: string) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

test('Chinese and English homepages expose the same focused sections', () => {
  const zh = json('./messages/zh/pages/index.json').page;
  const en = json('./messages/en/pages/index.json').page;

  assert.deepEqual(zh.show_sections, [
    'hero',
    'usage',
    'features',
    'faq',
    'cta',
  ]);
  assert.deepEqual(en.show_sections, zh.show_sections);
  assert.equal(zh.sections.hero.product, 'sop2workflow');
  assert.equal(en.sections.hero.product, 'sop2workflow');
  assert.equal(zh.sections.hero.block, 'hero');
  assert.equal(en.sections.hero.block, 'hero');
});

test('public navigation only exposes product-relevant destinations', () => {
  for (const locale of ['zh', 'en']) {
    const landing = json(`./messages/${locale}/landing.json`);
    const serialized = JSON.stringify(landing);
    assert.doesNotMatch(
      serialized,
      /showcases|blog|updates|AI Image|AI Video/i
    );
    assert.match(serialized, /#workspace/);
    assert.match(serialized, /#features/);
    assert.deepEqual(landing.header.buttons, []);
  }
});

test('header anchors use smooth in-page navigation', () => {
  const header = readFileSync(
    new URL('../../themes/default/blocks/header.tsx', import.meta.url),
    'utf8'
  );

  assert.match(header, /function handleAnchorNavigation/);
  assert.match(
    header,
    /scrollIntoView\(\{[\s\S]*?behavior: reduceMotion \? 'auto' : 'smooth'/
  );
  assert.match(
    header,
    /onClick=\{\(event\) =>[\s\S]*?handleAnchorNavigation\(event, item\.url\)/
  );

  for (const file of [
    '../../themes/default/blocks/features-step.tsx',
    '../../themes/default/blocks/features.tsx',
    '../../themes/default/blocks/faq.tsx',
  ]) {
    const section = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(section, /scroll-mt-24/);
  }

  const globalStyles = readFileSync(
    new URL('../style/global.css', import.meta.url),
    'utf8'
  );
  assert.match(globalStyles, /scroll-behavior:\s*smooth/);
  assert.match(
    globalStyles,
    /prefers-reduced-motion:\s*reduce[\s\S]*?scroll-behavior:\s*auto/
  );
});

test('metadata identifies SOP2Workflow in both locales', () => {
  for (const locale of ['zh', 'en']) {
    const common = json(`./messages/${locale}/common.json`);
    assert.match(common.metadata.title, /SOP2Workflow/);
    assert.doesNotMatch(common.metadata.description, /ShipAny/i);
  }
});

test('hero component delegates the product UI to the workflow studio', () => {
  const source = readFileSync(
    new URL('../../themes/default/blocks/hero.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /SopWorkflowStudio/);
  assert.match(source, /section\.product === 'sop2workflow'/);
});

test('editorial hero exposes one localized start action', () => {
  const zh = json('./messages/zh/pages/index.json').page.sections.hero;
  const en = json('./messages/en/pages/index.json').page.sections.hero;

  assert.equal(zh.title, '把 ERP SOP 变成 n8n 工作流');
  assert.equal(en.title, 'Turn ERP SOPs into n8n workflows');
  assert.match(zh.description, /触发条件、操作步骤与判断分支/);
  assert.match(en.description, /triggers, actions, and decision branches/);
  assert.equal(zh.workspace.primary_cta, '立即体验');
  assert.equal(en.workspace.primary_cta, 'Try it now');

  const source = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.tsx',
      import.meta.url
    ),
    'utf8'
  );
  assert.match(source, /linearity-hero-title/);
  assert.match(source, /linearity-hero-description/);
  assert.match(source, /linearity-hero-start/);
  assert.match(source, /scrollIntoView\(\{[\s\S]*?behavior: 'smooth'/);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
  assert.match(
    source,
    /linearity-hero-intro[^"\n]*min-h-\[calc\(100svh-92px\)\][^"\n]*xl:grid-cols-/
  );
  assert.doesNotMatch(source, /copy\.secondary_cta/);
});

test('landing header presents a high-contrast sign-in action', () => {
  const header = readFileSync(
    new URL('../../themes/default/blocks/header.tsx', import.meta.url),
    'utf8'
  );

  assert.match(header, /signButtonClassName="[^"]*bg-white/);
});

test('workflow input is part of the first-screen hero composition', () => {
  const source = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.tsx',
      import.meta.url
    ),
    'utf8'
  );
  const intro = source.indexOf('linearity-hero-intro');
  const workspace = source.indexOf('linearity-hero-workspace');
  const prompt = source.indexOf('<StarBorder', workspace);

  assert.ok(intro >= 0, 'hero intro composition is missing');
  assert.ok(
    workspace > intro,
    'workflow workspace should follow the hero copy'
  );
  assert.ok(
    prompt > workspace,
    'workflow input should live in the hero workspace'
  );
});

test('hero publishes three capability summaries in both locales', () => {
  for (const locale of ['zh', 'en']) {
    const hero = json(`./messages/${locale}/pages/index.json`).page.sections
      .hero;
    const benefits = hero.workspace.benefits;

    assert.equal(benefits.length, 3);
    assert.deepEqual(
      benefits.map((item: { id: string }) => item.id),
      ['complete-delivery', 'local-processing', 'credential-safety']
    );
    assert.ok(
      benefits.every(
        (item: { title: string; description: string }) =>
          item.title.length > 0 && item.description.length > 0
      )
    );
  }
});

test('workflow input follows the capability cards in the hero', () => {
  const source = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.tsx',
      import.meta.url
    ),
    'utf8'
  );
  const benefits = source.indexOf('linearity-hero-benefits');
  const workspace = source.indexOf('linearity-hero-workspace');

  assert.ok(benefits >= 0, 'hero capability cards are missing');
  assert.ok(
    workspace > benefits,
    'workflow input should appear below the capability cards'
  );
});

test('SOP textarea hides its native scrollbar', () => {
  const studio = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.tsx',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(studio, /id="sop-input"[\s\S]*?className="[^"]*scrollbar-hide/);
});

test('workflow input removes shortcut coaching and explains smart trigger detection', () => {
  const studio = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.tsx',
      import.meta.url
    ),
    'utf8'
  );

  assert.doesNotMatch(studio, /copy\.prompt_caption/);
  assert.match(studio, /copy\.trigger_auto_hint/);
  for (const locale of ['zh', 'en']) {
    const workspace = json(`./messages/${locale}/pages/index.json`).page
      .sections.hero.workspace;
    assert.equal(workspace.prompt_caption, undefined);
    assert.ok(workspace.trigger_auto_hint.length > 0);
  }
});

test('workflow generation communicates progress and completion timing', () => {
  const studio = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.tsx',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(studio, /generating_eta/);
  assert.match(studio, /generating_statuses/);
  assert.match(studio, /aria-live="polite"/);
  assert.match(studio, /elapsedSeconds/);
  assert.match(studio, /resultRef\.current\?\.scrollIntoView/);

  for (const locale of ['zh', 'en']) {
    const workspace = json(`./messages/${locale}/pages/index.json`).page
      .sections.hero.workspace;
    assert.ok(workspace.generating_eta.length > 0);
    assert.equal(workspace.generating_statuses.length, 3);
  }
});

test('landing reveal animations replay when sections re-enter the viewport', () => {
  const page = readFileSync(
    new URL('../../themes/default/pages/dynamic-page.tsx', import.meta.url),
    'utf8'
  );
  const scrollAnimation = readFileSync(
    new URL('../../shared/components/ui/scroll-animation.tsx', import.meta.url),
    'utf8'
  );

  assert.match(page, /once=\{false\}/);
  assert.match(scrollAnimation, /once: false/);
  assert.doesNotMatch(page, /\s+once\s*>/);
});

test('sign-in modal exposes an explicit close action above decorative layers', () => {
  const modal = readFileSync(
    new URL('../../shared/blocks/sign/sign-modal.tsx', import.meta.url),
    'utf8'
  );

  assert.match(modal, /showCloseButton=\{false\}/);
  assert.match(modal, /onClick=\{\(\) => setIsShowSignModal\(false\)\}/);
  assert.match(modal, /z-20/);
});

test('workflow preview heading and description are centered as one group', () => {
  const source = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.tsx',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(source, /linearity-stage-copy[^"\n]*text-center/);
  assert.match(
    source,
    /linearity-stage-title[^"\n]*mx-auto[^"\n]*lg:whitespace-nowrap/
  );
  assert.match(source, /linearity-stage-description[^"\n]*mx-auto/);
});

test('lower landing blocks use the approved editorial composition', () => {
  const step = readFileSync(
    new URL('../../themes/default/blocks/features-step.tsx', import.meta.url),
    'utf8'
  );
  const features = readFileSync(
    new URL('../../themes/default/blocks/features.tsx', import.meta.url),
    'utf8'
  );
  const cta = readFileSync(
    new URL('../../themes/default/blocks/cta.tsx', import.meta.url),
    'utf8'
  );

  assert.match(step, /linearity-editorial/);
  assert.match(features, /linearity-capability-strip/);
  assert.match(cta, /linearity-closing-cta/);
});

test('work method uses a compact four-step horizontal stepper', () => {
  const step = readFileSync(
    new URL('../../themes/default/blocks/features-step.tsx', import.meta.url),
    'utf8'
  );

  assert.match(step, /<ol/);
  assert.match(step, /lg:grid-cols-4/);
  assert.match(step, /linearity-step-connector/);
  assert.doesNotMatch(step, /linearity-editorial-canvas/);
});

test('sections after the hero share the subtle geometric background field', () => {
  const files = [
    '../../themes/default/blocks/features-step.tsx',
    '../../themes/default/blocks/features.tsx',
    '../../themes/default/blocks/faq.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /linearity-subtle-field/);
  }
  const styles = readFileSync(
    new URL('../style/global.css', import.meta.url),
    'utf8'
  );
  assert.match(styles, /\.linearity-subtle-field/);
  assert.match(styles, /opacity:\s*0\.1/);
});

test('header uses the compact reference composition', () => {
  const source = readFileSync(
    new URL('../../themes/default/blocks/header.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /linearity-header/);
  assert.match(source, /linearity-mobile-cta/);
});

test('landing typography stays restrained across narrow and desktop layouts', () => {
  const files = [
    '../../themes/default/blocks/sop-workflow-studio.tsx',
    '../../themes/default/blocks/features-step.tsx',
    '../../themes/default/blocks/features.tsx',
    '../../themes/default/blocks/faq.tsx',
    '../../themes/default/blocks/cta.tsx',
  ];
  const source = files
    .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
    .join('\n');
  const styles = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.module.css',
      import.meta.url
    ),
    'utf8'
  );

  assert.doesNotMatch(source, /(?:md:text-7xl|lg:text-6xl)/);
  assert.match(
    styles,
    /\.heroTitle[\s\S]*font-size:\s*clamp\(2\.25rem, 6\.6vw, 4\.5rem\)/
  );
  assert.match(styles, /\.heroTitle[\s\S]*font-style:\s*italic/);
  assert.match(styles, /\.heroTitle[\s\S]*letter-spacing:\s*-0\.025em/);
  assert.match(styles, /\.heroTitle[\s\S]*word-break:\s*keep-all/);
  assert.match(source, /linearity-submit[^"\n]*size-\[29px\]/);
});

test('all landing sections use the React Bits scroll entrance', () => {
  const page = readFileSync(
    new URL('../../themes/default/pages/dynamic-page.tsx', import.meta.url),
    'utf8'
  );
  const componentUrl = new URL(
    '../../shared/components/ui/animated-content.jsx',
    import.meta.url
  );

  assert.match(page, /import AnimatedContent/);
  assert.match(page, /<AnimatedContent/);
  assert.match(page, /trigger=\{block === 'hero' \? 'mount' : 'scroll'\}/);
  assert.ok(existsSync(componentUrl), 'AnimatedContent component is missing');
  const animatedContent = readFileSync(componentUrl, 'utf8');
  assert.match(animatedContent, /ScrollTrigger/);
  assert.match(animatedContent, /prefers-reduced-motion/);
  assert.match(animatedContent, /ctx\.revert\(\)/);
});

test('hero integrates the React Bits Aurora background without changing workflow controls', () => {
  const studio = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.tsx',
      import.meta.url
    ),
    'utf8'
  );
  const aurora = readFileSync(
    new URL('../../shared/components/ui/aurora.jsx', import.meta.url),
    'utf8'
  );
  const auroraCssUrl = new URL(
    '../../shared/components/ui/Aurora.css',
    import.meta.url
  );
  const landingStyles = readFileSync(
    new URL('../style/global.css', import.meta.url),
    'utf8'
  );
  assert.match(studio, /import Aurora/);
  assert.match(studio, /<Aurora/);
  assert.match(studio, /colorStops=\{\['#5227FF', '#7cff67', '#5227FF'\]\}/);
  assert.match(studio, /amplitude=\{1\}/);
  assert.match(studio, /blend=\{0\.5\}/);
  assert.match(studio, /height=\{0\.45\}/);
  assert.match(studio, /speed=\{1\}/);
  assert.match(studio, /glow=\{0\.6\}/);
  assert.doesNotMatch(studio, /amplitudePulse|loopDuration/);
  assert.match(aurora, /import '\.\/Aurora\.css'/);
  assert.match(aurora, /getContext\('webgl2'/);
  assert.match(aurora, /IntersectionObserver/);
  assert.match(aurora, /prefers-reduced-motion/);
  assert.ok(existsSync(auroraCssUrl), 'React Bits Aurora CSS is missing');
  assert.match(
    landingStyles,
    /\.linearity-aurora-stage\s*\{[\s\S]*?width:\s*100vw;[\s\S]*?height:\s*720px;/
  );
  assert.match(studio, /fetch\('\/api\/sop-workflow\/analyze'/);
  assert.match(studio, /compileN8nWorkflow/);
});

test('SOP input panel uses the React Bits StarBorder effect', () => {
  const studio = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.tsx',
      import.meta.url
    ),
    'utf8'
  );
  const componentUrl = new URL(
    '../../shared/components/ui/star-border.jsx',
    import.meta.url
  );

  assert.match(studio, /import StarBorder/);
  assert.match(studio, /<StarBorder/);
  assert.match(studio, /as="div"/);
  assert.match(studio, /linearity-prompt-star/);
  assert.ok(existsSync(componentUrl), 'StarBorder component is missing');

  const starBorder = readFileSync(componentUrl, 'utf8');
  assert.match(starBorder, /getContext\('2d'\)/);
  assert.match(starBorder, /ResizeObserver/);
  assert.match(starBorder, /IntersectionObserver/);
  assert.match(starBorder, /prefers-reduced-motion/);
  assert.match(
    starBorder,
    /cancelAnimationFrame\(frame\);\s*frame = 0;/,
    'StarBorder must clear a cancelled frame handle so it can restart on re-entry'
  );
});

test('workflow preview renders explicit branch lanes instead of label-only badges', () => {
  const studio = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.tsx',
      import.meta.url
    ),
    'utf8'
  );
  assert.match(studio, /linearity-branch-lanes/);
  assert.match(studio, /linearity-branch-lane/);
  assert.match(studio, /edge\.branch/);
  assert.match(studio, /edge\.targetStepId/);
});

test('SOP input panel stays transparent behind the animated border', () => {
  const styles = readFileSync(
    new URL('../style/global.css', import.meta.url),
    'utf8'
  );
  const promptRule = styles.match(/\.linearity-prompt\s*\{([\s\S]*?)\}/)?.[1];

  assert.ok(promptRule, 'linearity prompt styles are missing');
  assert.match(promptRule, /background:\s*transparent/);
  assert.match(promptRule, /backdrop-filter:\s*none/);
});

test('mobile StarBorder matches the 459 by 192 input area', () => {
  const studio = readFileSync(
    new URL(
      '../../themes/default/blocks/sop-workflow-studio.tsx',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(studio, /linearity-prompt-star[^"\n]*h-\[192px\]/);
  assert.match(studio, /linearity-prompt-star[^"\n]*w-\[459px\]/);
  assert.match(studio, /max-w-\[calc\(100vw-40px\)\]/);
  assert.match(studio, /md:h-auto[^"\n]*md:w-full/);
  assert.match(studio, /style=\{\{ background: 'transparent', padding: 0 \}\}/);
});
