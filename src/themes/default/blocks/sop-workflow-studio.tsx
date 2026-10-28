'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  Download,
  FileCheck2,
  FileInput,
  GitBranch,
  LoaderCircle,
  MousePointer2,
  Play,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  Webhook,
  Workflow,
  Zap,
} from 'lucide-react';

import Aurora from '@/shared/components/ui/aurora';
import StarBorder from '@/shared/components/ui/star-border';
import {
  compileN8nWorkflow,
  SOP_EXAMPLES,
  SopAnalysis,
  SopAnalysisResponse,
  TriggerHint,
} from '@/shared/lib/sop-workflow';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

import {
  buildWorkflowGraphRows,
  validateAnalysisDraft,
} from './sop-workflow-studio-model';
import studioStyles from './sop-workflow-studio.module.css';

const nodeIcons: Record<
  SopAnalysis['steps'][number]['operation'],
  typeof Play
> = {
  read: FileInput,
  transform: RefreshCw,
  write: FileCheck2,
  approve: CheckCircle2,
  notify: Send,
  wait: Clock3,
  condition: GitBranch,
  merge: Route,
  end: Check,
};

type StudioCopy = {
  language?: 'zh' | 'en';
  badge?: string;
  hero_lead?: string;
  hero_join?: string;
  hero_target?: string;
  hero_tokens?: string[];
  primary_cta?: string;
  secondary_cta?: string;
  scroll_hint?: string;
  input_label?: string;
  input_hint?: string;
  placeholder?: string;
  examples_label?: string;
  example_labels?: string[];
  example_values?: string[];
  trigger_label?: string;
  trigger_auto?: string;
  trigger_auto_hint?: string;
  trigger_manual?: string;
  trigger_schedule?: string;
  trigger_webhook?: string;
  generate?: string;
  generating?: string;
  privacy?: string;
  preview?: string;
  json?: string;
  setup?: string;
  stage_label?: string;
  stage_title?: string;
  stage_description?: string;
  empty_title?: string;
  empty_description?: string;
  nodes?: string;
  generated?: string;
  copy?: string;
  copied?: string;
  download?: string;
  configuration_note?: string;
  checklist?: string;
  assumptions?: string;
  tests?: string;
  error_empty?: string;
  error_origin?: string;
  error_busy?: string;
  error_config?: string;
  error_timeout?: string;
  error_invalid_output?: string;
  error_provider?: string;
  error_generic?: string;
  local_session?: string;
  awaiting?: string;
  validate?: string;
  validated?: string;
  review_title?: string;
  review_confirm?: string;
  review_required?: string;
  structured_json?: string;
  missing_information?: string;
  risks?: string;
  benefits?: Array<{
    id: string;
    title: string;
    description: string;
  }>;
};

export function SopWorkflowStudio({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const copy = (section.workspace || {}) as StudioCopy;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [sop, setSop] = useState('');
  const [mode, setMode] = useState<TriggerHint>('auto');
  const [result, setResult] = useState<SopAnalysisResponse | null>(null);
  const [analysisDraft, setAnalysisDraft] = useState('');
  const [validatedAnalysis, setValidatedAnalysis] =
    useState<SopAnalysis | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [draftIsValid, setDraftIsValid] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'flow' | 'json' | 'setup'>('flow');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const workflow = useMemo(
    () => (validatedAnalysis ? compileN8nWorkflow(validatedAnalysis) : null),
    [validatedAnalysis]
  );
  const json = useMemo(
    () => (workflow ? JSON.stringify(workflow, null, 2) : ''),
    [workflow]
  );
  const graphRows = useMemo(
    () => (validatedAnalysis ? buildWorkflowGraphRows(validatedAnalysis) : []),
    [validatedAnalysis]
  );
  const examples = copy.example_values?.length
    ? copy.example_values
    : SOP_EXAMPLES;

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  function revealInput() {
    workspaceRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    window.setTimeout(
      () => textareaRef.current?.focus({ preventScroll: true }),
      520
    );
  }

  async function generate() {
    if (!sop.trim()) {
      setError(copy.error_empty || 'Add an SOP before generating.');
      textareaRef.current?.focus();
      return;
    }

    setError('');
    setBusy(true);
    setReviewConfirmed(false);
    setDraftIsValid(false);
    setValidationMessage('');
    try {
      const response = await fetch('/api/sop-workflow/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sop: sop.trim(),
          locale: copy.language || 'en',
          triggerHint: mode,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const messages: Record<string, string | undefined> = {
          invalid_origin: copy.error_origin,
          busy: copy.error_busy,
          too_frequent: copy.error_busy,
          client_daily_limit: copy.error_busy,
          global_daily_limit: copy.error_busy,
          not_configured: copy.error_config,
          provider_timeout: copy.error_timeout,
          invalid_output: copy.error_invalid_output,
          provider_error: copy.error_provider,
          internal_error: copy.error_generic,
        };
        throw new Error(
          messages[payload.error] ||
            copy.error_generic ||
            'Unable to analyze this SOP. Please try again.'
        );
      }
      const next = payload as SopAnalysisResponse;
      setResult(next);
      setValidatedAnalysis(next.analysis);
      setDraftIsValid(true);
      setAnalysisDraft(JSON.stringify(next.analysis, null, 2));
      setValidationMessage(copy.validated || 'Structure validated');
      setActiveTab('flow');
      window.setTimeout(
        () =>
          resultRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          }),
        80
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to generate.'
      );
    } finally {
      setBusy(false);
    }
  }

  function validateDraft() {
    try {
      const analysis = validateAnalysisDraft(analysisDraft);
      setValidatedAnalysis(analysis);
      setDraftIsValid(true);
      setValidationMessage(copy.validated || 'Structure validated');
      setReviewConfirmed(false);
      setError('');
    } catch (reason) {
      setDraftIsValid(false);
      setReviewConfirmed(false);
      setValidationMessage('');
      setError(reason instanceof Error ? reason.message : 'Invalid JSON');
    }
  }

  async function copyJson() {
    if (!json || !reviewConfirmed) return;
    await navigator.clipboard.writeText(json);
    setCopied(true);
  }

  function downloadJson() {
    if (!json || !reviewConfirmed) return;
    const url = URL.createObjectURL(
      new Blob([json], { type: 'application/json;charset=utf-8' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sop2workflow-n8n.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  const triggerOptions: Array<{
    value: TriggerHint;
    label: string;
    hint?: string;
    icon: typeof MousePointer2;
  }> = [
    {
      value: 'auto',
      label: copy.trigger_auto || 'Auto detect',
      hint:
        copy.trigger_auto_hint ||
        'Infer manual, scheduled, or webhook triggering from the SOP.',
      icon: MousePointer2,
    },
    {
      value: 'schedule',
      label: copy.trigger_schedule || 'Schedule',
      icon: Clock3,
    },
    {
      value: 'webhook',
      label: copy.trigger_webhook || 'Webhook',
      icon: Webhook,
    },
  ];
  const benefitIcons = [CheckCircle2, Workflow, ShieldCheck];

  const setupSections = validatedAnalysis
    ? [
        {
          title: copy.checklist || 'Deployment checklist',
          items: validatedAnalysis.deploymentChecklist,
          icon: Zap,
        },
        {
          title: copy.assumptions || 'Assumptions',
          items: validatedAnalysis.assumptions,
          icon: GitBranch,
        },
        {
          title: copy.tests || 'Validation plan',
          items: validatedAnalysis.tests.map(
            (item) => `${item.name}: ${item.expected}`
          ),
          icon: CheckCircle2,
        },
        {
          title: copy.missing_information || 'Missing information',
          items: validatedAnalysis.missingInformation,
          icon: FileInput,
        },
        {
          title: copy.risks || 'Risks and mitigations',
          items: validatedAnalysis.risks.map(
            (item) => `[${item.level}] ${item.title}: ${item.mitigation}`
          ),
          icon: ShieldCheck,
        },
      ]
    : [];

  return (
    <section
      id={section.id || 'workspace'}
      className={cn(
        'linearity-shell relative overflow-hidden bg-[#050507] text-white',
        className
      )}
    >
      <div className="linearity-aurora-stage" aria-hidden>
        <Aurora
          colorStops={['#5227FF', '#7cff67', '#5227FF']}
          amplitude={1}
          blend={0.5}
          height={0.45}
          speed={1}
          glow={0.6}
        />
      </div>
      <div className="linearity-grain" aria-hidden />

      <div className="relative mx-auto flex max-w-[1680px] flex-col items-center px-5 pt-[92px] pb-10 md:px-10 xl:px-14">
        <div className="linearity-hero-copy mx-auto w-full max-w-[1600px] text-center">
          <div className="linearity-hero-intro grid min-h-[calc(100svh-92px)] w-full items-center gap-10 py-10 md:py-12 xl:grid-cols-[minmax(0,1fr)_minmax(520px,0.86fr)] xl:gap-14 xl:py-8">
            <div className="linearity-hero-main flex flex-col items-center xl:col-span-2">
              <h1
                className={cn(
                  studioStyles.heroTitle,
                  'linearity-hero-title mx-auto text-[#f8f7f4] xl:max-w-[780px]'
                )}
              >
                {section.title}
              </h1>

              <p
                className={cn(
                  studioStyles.heroDescription,
                  'linearity-hero-description mx-auto mt-7 max-w-[760px] text-white/72 md:mt-9'
                )}
              >
                {section.description}
              </p>

              <button
                type="button"
                onClick={revealInput}
                className={cn(
                  studioStyles.heroStart,
                  'linearity-hero-start mt-8 md:mt-10'
                )}
                aria-controls="sop-input"
              >
                {copy.primary_cta || 'Get started'}
              </button>
            </div>

            {copy.benefits?.length ? (
              <div className="linearity-hero-benefits grid w-full gap-2.5 text-left md:grid-cols-3 xl:col-span-2">
                {copy.benefits.map((benefit, index) => {
                  const BenefitIcon = benefitIcons[index] || CheckCircle2;
                  return (
                    <article
                      key={benefit.id}
                      className="group flex min-h-[88px] items-start gap-4 rounded-2xl border border-white/10 bg-[#0d0e12]/80 px-5 py-4 transition-colors hover:border-white/24 hover:bg-[#15161c]"
                    >
                      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#090a0d]">
                        <BenefitIcon className="size-4" strokeWidth={1.7} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold tracking-[-0.02em] text-white/90 md:text-[15px]">
                          {benefit.title}
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-white/45">
                          {benefit.description}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            <div
              ref={workspaceRef}
              id="sop-workspace"
              className="linearity-hero-workspace mx-auto w-full max-w-[720px] scroll-mt-28 xl:col-span-2"
            >
              <StarBorder
                as="div"
                color="#ffffff"
                trailColor="#dfe5ff"
                duration={7}
                stars={1}
                trailLength={0.15}
                thickness={1.1}
                radius={26}
                glow={0.18}
                hover="lap"
                clickPulse={false}
                backgroundColor="transparent"
                borderColor="rgba(255, 255, 255, 0.16)"
                className="linearity-prompt-star mx-auto block h-[192px] w-[459px] max-w-[calc(100vw-40px)] p-0 text-left md:h-auto md:w-full md:max-w-[720px]"
                style={{ background: 'transparent', padding: 0 }}
              >
                <div className="linearity-prompt relative h-full w-full md:h-auto">
                  <label htmlFor="sop-input" className="sr-only">
                    {copy.input_label || 'Business SOP'}
                  </label>
                  <textarea
                    ref={textareaRef}
                    id="sop-input"
                    value={sop}
                    maxLength={4000}
                    onChange={(event) => {
                      setSop(event.target.value);
                      setError('');
                    }}
                    onKeyDown={(event) => {
                      if (
                        (event.metaKey || event.ctrlKey) &&
                        event.key === 'Enter'
                      )
                        generate();
                    }}
                    placeholder={copy.placeholder}
                    className="scrollbar-hide h-full min-h-0 w-full resize-none border-0 bg-transparent px-6 pt-6 pb-24 text-base leading-8 text-white outline-none placeholder:text-white/36 md:h-auto md:min-h-56 md:px-8 md:pt-8 md:text-lg"
                  />
                  <div className="absolute right-5 bottom-5 left-5 flex items-end justify-between gap-4 md:right-7 md:bottom-7 md:left-7">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1.5">
                        {triggerOptions.map((option) => {
                          const Icon = option.icon;
                          return (
                            <button
                              type="button"
                              key={option.value}
                              onClick={() => setMode(option.value)}
                              title={option.hint}
                              aria-label={option.hint || option.label}
                              className={cn(
                                'linearity-mode inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px]',
                                mode === option.value
                                  ? 'linearity-mode-active'
                                  : 'text-white/42'
                              )}
                            >
                              <Icon className="size-3" strokeWidth={1.7} />
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={generate}
                      disabled={busy}
                      className="linearity-submit grid size-[29px] shrink-0 place-items-center rounded-full"
                      aria-label={copy.generate || 'Generate workflow'}
                    >
                      {busy ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <ArrowUp className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </StarBorder>

              {error ? (
                <p className="mt-3 text-sm text-[#ff9f9f]" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <span className="mr-1 self-center text-[10px] tracking-[0.12em] text-white/30 uppercase">
                  {copy.examples_label || 'Examples'}
                </span>
                {examples.map((example, index) => (
                  <button
                    type="button"
                    key={example}
                    onClick={() => {
                      setSop(example);
                      setError('');
                      textareaRef.current?.focus();
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] text-white/48 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                  >
                    {copy.example_labels?.[index] || `Example ${index + 1}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={resultRef}
        id="workflow-preview"
        className="sop-result-stage relative mx-auto max-w-[1680px] scroll-mt-8 px-5 pb-24 md:px-10 md:pb-36 xl:px-14"
      >
        <div className="mb-10 grid gap-6 lg:grid-cols-[.35fr_1.65fr] lg:items-end">
          <div className="text-[11px] tracking-[0.08em] text-[#a99cff]">
            {copy.stage_label || 'The product'}
          </div>
          <div className="linearity-stage-copy text-center">
            <h2 className="linearity-stage-title mx-auto max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-balance md:text-5xl lg:max-w-none lg:whitespace-nowrap">
              {copy.stage_title || 'A workflow your team can inspect.'}
            </h2>
            <p className="linearity-stage-description mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/45">
              {copy.stage_description || copy.empty_description}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'linearity-product-frame overflow-hidden rounded-[28px]',
            result && 'linearity-product-frame-active'
          )}
        >
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5" aria-hidden>
                <span className="size-2 rounded-full bg-white/15" />
                <span className="size-2 rounded-full bg-white/15" />
                <span className="size-2 rounded-full bg-[#7cff67]" />
              </div>
              <span className="h-3 w-px bg-white/10" />
              <span className="text-[10px] tracking-[0.12em] text-white/35 uppercase">
                SOP2Workflow
              </span>
            </div>
            <div className="flex items-center gap-4">
              {(['flow', 'json', 'setup'] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className={cn(
                    'h-14 border-b text-[11px] transition',
                    activeTab === value
                      ? 'border-white text-white'
                      : 'border-transparent text-white/35 hover:text-white/65'
                  )}
                >
                  {value === 'flow'
                    ? copy.preview
                    : value === 'json'
                      ? copy.json
                      : copy.setup}
                </button>
              ))}
              <button
                type="button"
                disabled={!json || !reviewConfirmed}
                onClick={copyJson}
                className="hidden rounded-full border border-white/10 p-2 text-white/45 transition hover:text-white disabled:opacity-25 sm:block"
                aria-label={copy.copy || 'Copy JSON'}
              >
                {copied ? (
                  <Check className="size-3.5 text-[#7cff67]" />
                ) : (
                  <Clipboard className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                disabled={!json || !reviewConfirmed}
                onClick={downloadJson}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[10px] text-white/48 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-25"
              >
                <Download className="size-3" />
                <span className="hidden sm:inline">
                  {copy.download || 'Download'}
                </span>
              </button>
            </div>
          </div>

          <div className="linearity-product-canvas min-h-[600px] md:min-h-[680px]">
            {!result ? (
              <div className="flex min-h-[600px] flex-col items-center justify-center px-6 text-center md:min-h-[680px]">
                <div className="linearity-empty-flow mb-8 flex items-center">
                  <span className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-black/25 text-white/45">
                    <FileInput className="size-5" />
                  </span>
                  <span className="h-px w-20 bg-white/22 md:w-32" />
                  <span className="grid size-14 place-items-center rounded-2xl border border-white/16 bg-[#15161c] text-white">
                    <Workflow className="size-5" />
                  </span>
                </div>
                <div className="text-[10px] tracking-[0.08em] text-[#a99cff]">
                  {copy.awaiting || 'Awaiting source'}
                </div>
                <h3 className="mt-4 max-w-xl text-2xl font-semibold tracking-[-0.035em] md:text-4xl">
                  {copy.empty_title}
                </h3>
                <p className="mt-4 max-w-lg text-sm leading-7 text-white/38">
                  {copy.empty_description}
                </p>
              </div>
            ) : activeTab === 'flow' ? (
              <div className="p-5 md:p-10">
                <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] tracking-[0.08em] text-[#a99cff]">
                      {copy.generated}
                    </div>
                    <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em] md:text-3xl">
                      {validatedAnalysis?.title}
                    </h3>
                    <p className="mt-2 text-xs text-white/40">
                      {validatedAnalysis?.summary}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[10px] text-white/45">
                    {validatedAnalysis?.steps.length} {copy.nodes}
                  </span>
                </div>
                <div className="mx-auto max-w-4xl">
                  {graphRows.map(({ step, edges }, index) => {
                    const Icon = nodeIcons[step.operation];
                    return (
                      <div
                        key={step.id}
                        className="linearity-node relative flex gap-4"
                        style={{ animationDelay: `${index * 65}ms` }}
                      >
                        <div className="flex w-10 shrink-0 flex-col items-center">
                          <span className="z-10 grid size-10 place-items-center rounded-xl border border-white/14 bg-[#15161c] text-white">
                            <Icon className="size-4" />
                          </span>
                          {index !== graphRows.length - 1 ? (
                            <span className="linearity-flow-line min-h-12 w-px flex-1 bg-white/10" />
                          ) : null}
                        </div>
                        <div className="mb-3 min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-black/20 p-4 backdrop-blur-xl transition hover:border-white/15 md:p-5">
                          <div className="text-[9px] tracking-[0.12em] text-white/30 uppercase">
                            {step.operation} · {String(index).padStart(2, '0')}
                          </div>
                          <h4 className="mt-2 text-sm font-medium">
                            {step.title}
                          </h4>
                          <p className="mt-1.5 text-[11px] leading-5 text-white/38">
                            {step.description}
                          </p>
                          {step.ownerActorId ? (
                            <div className="mt-3 text-[10px] text-white/35">
                              Owner · {step.ownerActorId}
                            </div>
                          ) : null}
                          {edges.length ? (
                            <div
                              className={cn(
                                'linearity-branch-lanes relative mt-5 grid gap-3 border-t border-white/[0.08] pt-6',
                                edges.length > 1 && 'md:grid-cols-2'
                              )}
                              aria-label={`${step.title} branches`}
                            >
                              <span className="absolute top-0 left-1/2 h-6 w-px -translate-x-1/2 bg-[#a99cff]/35" />
                              {edges.map((edge) => {
                                const target = validatedAnalysis?.steps.find(
                                  (candidate) =>
                                    candidate.id === edge.targetStepId
                                );
                                return (
                                  <div
                                    key={`${step.id}-${edge.targetStepId}-${edge.label}`}
                                    className="linearity-branch-lane relative min-h-24 rounded-xl border border-[#a99cff]/25 bg-[#a99cff]/[0.06] p-3"
                                  >
                                    <span className="absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 bg-[#a99cff]/35" />
                                    <div className="flex items-center justify-between gap-2 text-[9px] tracking-[0.1em] text-[#a99cff] uppercase">
                                      <span>{edge.branch}</span>
                                      <GitBranch className="size-3" />
                                    </div>
                                    <div className="mt-2 text-xs font-medium text-white/85">
                                      {edge.label}
                                    </div>
                                    <div className="mt-2 text-[10px] leading-4 text-white/42">
                                      → {target?.title || edge.targetStepId}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                          {step.errorHandling.length ? (
                            <div className="mt-3 space-y-2 border-t border-[#ff9f9f]/15 pt-3">
                              {step.errorHandling.map((item) => (
                                <div
                                  key={`${step.id}-${item.scenario}`}
                                  className="linearity-branch-lane rounded-xl border border-[#ff9f9f]/20 bg-[#ff9f9f]/[0.05] px-3 py-2 text-[10px] leading-5 text-[#ffc5c5]"
                                >
                                  <span className="mr-2 font-semibold uppercase">
                                    error
                                  </span>
                                  {item.scenario}: {item.action}
                                  {item.targetStepId
                                    ? ` → ${item.targetStepId}`
                                    : ''}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : activeTab === 'json' ? (
              <div className="p-5 md:p-10">
                <div className="mb-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#15161c] px-4 py-3 text-[11px] text-white/70">
                  <ShieldCheck className="size-4 shrink-0" />
                  {copy.configuration_note}
                </div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      {copy.structured_json || 'Structured workflow JSON'}
                    </div>
                    <div className="mt-1 text-[10px] text-white/38">
                      {copy.review_title ||
                        'Edit assumptions and node details, then validate again.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={validateDraft}
                    className="rounded-full border border-white/15 bg-white px-4 py-2 text-[11px] font-medium text-black transition hover:bg-white/85"
                  >
                    {copy.validate || 'Validate changes'}
                  </button>
                </div>
                <textarea
                  value={analysisDraft}
                  spellCheck={false}
                  onChange={(event) => {
                    setAnalysisDraft(event.target.value);
                    setDraftIsValid(false);
                    setReviewConfirmed(false);
                    setValidationMessage('');
                    setError('');
                  }}
                  className="min-h-[440px] w-full resize-y rounded-2xl border border-white/[0.08] bg-black/35 p-5 font-mono text-[11px] leading-6 text-[#d8d3cf] transition outline-none focus:border-white/20"
                  aria-label={
                    copy.structured_json || 'Structured workflow JSON'
                  }
                />
                {error ? (
                  <p className="mt-3 rounded-xl border border-[#ff9f9f]/20 bg-[#ff9f9f]/[0.05] px-3 py-2 text-[11px] leading-5 text-[#ffc5c5]">
                    {error}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-[11px] text-[#9ee792]">
                    {validationMessage ? (
                      <CheckCircle2 className="size-4" />
                    ) : null}
                    {validationMessage ||
                      copy.review_required ||
                      'Validate JSON before confirming.'}
                  </span>
                  <label className="inline-flex items-center gap-2 text-[11px] text-white/60">
                    <input
                      type="checkbox"
                      checked={reviewConfirmed}
                      disabled={!draftIsValid}
                      onChange={(event) =>
                        setReviewConfirmed(event.target.checked)
                      }
                      className="size-4 accent-white"
                    />
                    {copy.review_confirm ||
                      'I reviewed the branches, risks, and required configuration.'}
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid gap-8 p-5 md:grid-cols-2 md:p-10 xl:grid-cols-3">
                {setupSections.map(({ title, items, icon: Icon }) => (
                  <div key={title}>
                    <div className="mb-5 flex items-center gap-2 text-sm font-medium">
                      <Icon className="size-4 text-[#a99cff]" />
                      {title}
                    </div>
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div
                          key={item}
                          className="flex gap-3 border-t border-white/[0.08] pt-3 text-[11px] leading-5 text-white/42"
                        >
                          <span className="text-[#a99cff]">{index + 1}</span>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-[10px] text-white/28">
          <ShieldCheck className="size-3" />
          {copy.privacy}
        </p>
      </div>
    </section>
  );
}
