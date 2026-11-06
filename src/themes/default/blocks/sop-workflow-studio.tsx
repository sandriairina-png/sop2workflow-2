'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
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
  classifyErrorHandling,
  compileN8nWorkflow,
  isAiAddedErrorHandling,
  SOP_EXAMPLES,
  SopAnalysis,
  SopAnalysisResponse,
  SopClarification,
  TriggerHint,
} from '@/shared/lib/sop-workflow';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

import { SAMPLE_WORKFLOWS } from './sop-workflow-sample';
import {
  buildClarificationAnswers,
  buildWorkflowGraphRows,
  describeDraftError,
  getStepSourceBadge,
  mergeClarifications,
  resolveConfirmationQuestions,
  resolveWorkflowError,
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
  generating_eta?: string;
  generating_elapsed?: string;
  generating_statuses?: string[];
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
  error_too_frequent?: string;
  error_daily_limit?: string;
  error_config?: string;
  error_timeout?: string;
  error_invalid_output?: string;
  error_provider?: string;
  error_generic?: string;
  retry?: string;
  sample_badge?: string;
  sample_title?: string;
  sample_description?: string;
  sample_try?: string;
  operation_labels?: Record<string, string>;
  branch_labels?: Record<string, string>;
  risk_levels?: Record<string, string>;
  owner?: string;
  step_label?: string;
  unknown_step?: string;
  draft_errors?: Record<string, string>;
  condition_pending?: string;
  confirmed_conditions?: string;
  remove_condition?: string;
  option_conventional?: string;
  option_configure_later?: string;
  error_kind_system?: string;
  error_kind_business?: string;
  system_error_handler?: string;
  error_source_ai?: string;
  error_source_text?: string;
  export_confirm?: string;
  export_confirm_short?: string;
  export_hints?: Record<string, string>;
  details_incomplete?: string;
  complete_details?: string;
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
  source_text?: string;
  ai_inferred?: string;
  needs_confirmation?: string;
  confirmation_title?: string;
  confirmation_description?: string;
  custom_answer?: string;
  custom_answer_placeholder?: string;
  apply_answers?: string;
  answer_required?: string;
  advanced?: string;
  advanced_description?: string;
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
  const [activeTab, setActiveTab] = useState<'flow' | 'setup'>('flow');
  const [busy, setBusy] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string>
  >({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(
    {}
  );
  // Confirmed answers apply to the SOP text they were given for and carry
  // over to every later regeneration (retry, complete details, more answers).
  const [clarifications, setClarifications] = useState<SopClarification[]>([]);
  const [clarifiedSop, setClarifiedSop] = useState('');
  // The conditions the result on screen was actually generated with.
  const [appliedClarifications, setAppliedClarifications] = useState<
    SopClarification[]
  >([]);
  // Why copy/download is unavailable, shown when the user clicks them anyway.
  const [exportHint, setExportHint] = useState('');
  const exportHintTimer = useRef<number | undefined>(undefined);

  const workflow = useMemo(
    () => (validatedAnalysis ? compileN8nWorkflow(validatedAnalysis) : null),
    [validatedAnalysis]
  );
  // Before the first generation the canvas shows a sample result, so users
  // see what they will get. Export stays tied to their own result.
  const sample = SAMPLE_WORKFLOWS[copy.language === 'zh' ? 'zh' : 'en'];
  const showingSample = !validatedAnalysis;
  const preview = validatedAnalysis ?? sample.analysis;
  const previewWorkflow = useMemo(
    () => workflow ?? compileN8nWorkflow(sample.analysis),
    [workflow, sample]
  );
  const json = useMemo(
    () => (workflow ? JSON.stringify(workflow, null, 2) : ''),
    [workflow]
  );
  const actorNames = useMemo(
    () => new Map(preview.actors.map((actor) => [actor.id, actor.name])),
    [preview]
  );
  const stepTitles = useMemo(
    () => new Map(preview.steps.map((step) => [step.id, step.title])),
    [preview]
  );
  const graphRows = useMemo(() => buildWorkflowGraphRows(preview), [preview]);
  const aiErrorCount = useMemo(
    () =>
      preview.steps.reduce(
        (count, step) =>
          count + step.errorHandling.filter(isAiAddedErrorHandling).length,
        0
      ),
    [preview]
  );
  const exportBlocker = busy
    ? 'busy'
    : !json
      ? 'sample'
      : !draftIsValid
        ? 'invalid'
        : !reviewConfirmed
          ? 'confirm'
          : '';
  const exportHints = copy.export_hints || {};
  const exportBlockerText = (reason: string) => {
    const fallback: Record<string, string> = {
      busy: 'Generating. Please wait a moment.',
      sample:
        'This is a sample. Generate your own workflow to review and download it.',
      invalid:
        'The JSON under Advanced has unvalidated edits. Open Advanced and click Revalidate.',
      confirm:
        'Tick "Reviewed" next to this button first, then copy or download.',
    };
    const text = exportHints[reason] || fallback[reason] || '';
    if (reason !== 'confirm' || !aiErrorCount) return text;
    const extra = (
      exportHints.ai_errors ||
      '{count} exception rules were added by AI; check them first.'
    ).replace('{count}', String(aiErrorCount));
    return `${text} ${extra}`;
  };
  function showExportHint(reason: string) {
    setExportHint(reason);
    window.clearTimeout(exportHintTimer.current);
    exportHintTimer.current = window.setTimeout(() => setExportHint(''), 4500);
  }
  useEffect(() => () => window.clearTimeout(exportHintTimer.current), []);
  const examples = copy.example_values?.length
    ? copy.example_values
    : SOP_EXAMPLES;
  const confirmedConditions = useMemo(
    () => (sop.trim() === clarifiedSop ? clarifications : []),
    [sop, clarifiedSop, clarifications]
  );
  const appliedKeys = useMemo(
    () =>
      new Set(
        appliedClarifications.map(
          (item) => `${item.questionId}\u0000${item.answer}`
        )
      ),
    [appliedClarifications]
  );
  const conditionsChanged =
    confirmedConditions.length !== appliedKeys.size ||
    confirmedConditions.some(
      (item) => !appliedKeys.has(`${item.questionId}\u0000${item.answer}`)
    );
  const pendingQuestions = useMemo(
    () =>
      preview
        ? resolveConfirmationQuestions(
            preview,
            confirmedConditions,
            {
              conventional: copy.option_conventional || 'Use common practice',
              configureLater:
                copy.option_configure_later || 'Keep it as a setup item',
            },
            { includeMissingInformation: !result?.meta.detailsIncomplete }
          )
        : [],
    [
      preview,
      confirmedConditions,
      copy.option_conventional,
      copy.option_configure_later,
      result?.meta.detailsIncomplete,
    ]
  );

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    if (!busy) return;
    setElapsedSeconds(0);
    const interval = window.setInterval(
      () => setElapsedSeconds((seconds) => seconds + 1),
      1000
    );
    return () => window.clearInterval(interval);
  }, [busy]);

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

  async function generate(newAnswers: SopClarification[] = []) {
    const source = sop.trim();
    if (!source) {
      setError(copy.error_empty || 'Add an SOP before generating.');
      setErrorRetryable(false);
      textareaRef.current?.focus();
      return;
    }

    const confirmed = mergeClarifications(
      source === clarifiedSop ? clarifications : [],
      newAnswers
    );
    setClarifications(confirmed);
    setClarifiedSop(source);
    setError('');
    setErrorRetryable(false);
    setBusy(true);
    setReviewConfirmed(false);
    setDraftIsValid(false);
    setValidationMessage('');
    try {
      const response = await fetch('/api/sop-workflow/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sop: source,
          locale: copy.language || 'en',
          triggerHint: mode,
          clarifications: confirmed,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const messages: Record<string, string | undefined> = {
          invalid_origin: copy.error_origin,
          busy: copy.error_busy,
          too_frequent: copy.error_too_frequent || copy.error_busy,
          client_daily_limit: copy.error_daily_limit || copy.error_busy,
          global_daily_limit: copy.error_daily_limit || copy.error_busy,
          not_configured: copy.error_config,
          provider_timeout: copy.error_timeout,
          invalid_output: copy.error_invalid_output,
          provider_error: copy.error_provider,
          internal_error: copy.error_generic,
        };
        const presentation = resolveWorkflowError(String(payload.error), {
          fallback:
            copy.error_generic ||
            'Unable to analyze this SOP. Please try again.',
          timeout:
            copy.error_timeout ||
            'This SOP took longer than expected to analyze.',
          provider:
            copy.error_provider ||
            'The model service is temporarily unavailable.',
          invalidOutput: copy.error_invalid_output,
          byCode: messages,
        });
        setError(presentation.message);
        setErrorRetryable(presentation.retryable);
        return;
      }
      const next = payload as SopAnalysisResponse;
      setAppliedClarifications(confirmed);
      setResult(next);
      setValidatedAnalysis(next.analysis);
      setDraftIsValid(true);
      setAnalysisDraft(JSON.stringify(next.analysis, null, 2));
      setValidationMessage(copy.validated || 'Structure validated');
      setSelectedAnswers({});
      setCustomAnswers({});
      setActiveTab('flow');
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      window.setTimeout(
        () =>
          resultRef.current?.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'start',
          }),
        120
      );
    } catch {
      const presentation = resolveWorkflowError('transport_error', {
        fallback:
          copy.error_generic || 'Unable to analyze this SOP. Please try again.',
        timeout:
          copy.error_timeout ||
          'This SOP took longer than expected to analyze.',
        provider:
          copy.error_provider ||
          'The model service is temporarily unavailable.',
        invalidOutput: copy.error_invalid_output,
      });
      setError(presentation.message);
      setErrorRetryable(presentation.retryable);
    } finally {
      setBusy(false);
    }
  }

  function applyClarifications() {
    if (!validatedAnalysis) return;
    const answers = buildClarificationAnswers(
      pendingQuestions,
      selectedAnswers,
      customAnswers
    );
    if (!answers.length) {
      // Removed or not-yet-applied conditions still need a regeneration.
      if (conditionsChanged) {
        void generate();
        return;
      }
      setError(
        copy.answer_required || 'Answer at least one question to continue.'
      );
      setErrorRetryable(false);
      return;
    }
    void generate(answers);
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
      const messages = copy.draft_errors || {};
      const fallback =
        messages.generic ||
        'The edited workflow could not be validated. Check it and try again.';
      setError(
        describeDraftError(reason, analysisDraft, {
          syntax: messages.syntax || fallback,
          schema: messages.schema || fallback,
          duplicate: messages.duplicate || fallback,
          unknownActor: messages.unknown_actor || fallback,
          tooFewBranches: messages.too_few_branches || fallback,
          unknownTarget: messages.unknown_target || fallback,
          unlabelled: messages.unlabelled || fallback,
          missingCondition: messages.missing_condition || fallback,
          unknownErrorTarget: messages.unknown_error_target || fallback,
          unreachable: messages.unreachable || fallback,
          noEnd: messages.no_end || fallback,
          secret: messages.secret || fallback,
          generic: fallback,
        })
      );
    }
  }

  async function copyJson() {
    if (exportBlocker) {
      showExportHint(exportBlocker);
      return;
    }
    await navigator.clipboard.writeText(json);
    setCopied(true);
  }

  function downloadJson() {
    if (exportBlocker) {
      showExportHint(exportBlocker);
      return;
    }
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

  const setupSections = preview
    ? [
        {
          title: copy.checklist || 'Deployment checklist',
          items: [
            ...new Set([
              ...preview.deploymentChecklist,
              ...previewWorkflow.configurationRequirements,
            ]),
          ],
          icon: Zap,
        },
        {
          title: copy.assumptions || 'Assumptions',
          items: preview.assumptions,
          icon: GitBranch,
        },
        {
          title: copy.tests || 'Validation plan',
          items: preview.tests.map((item) => `${item.name}: ${item.expected}`),
          icon: CheckCircle2,
        },
        {
          title: copy.risks || 'Risks and mitigations',
          items: preview.risks.map(
            (item) =>
              `${copy.risk_levels?.[item.level] || item.level} · ${item.title}：${item.mitigation}`
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
                      setErrorRetryable(false);
                    }}
                    onKeyDown={(event) => {
                      if (
                        (event.metaKey || event.ctrlKey) &&
                        event.key === 'Enter'
                      )
                        void generate();
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
                      onClick={() => void generate()}
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
                <div
                  className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm text-[#ffb0b0]"
                  role="alert"
                >
                  <span>{error}</span>
                  {errorRetryable ? (
                    <button
                      type="button"
                      onClick={() => void generate()}
                      disabled={busy}
                      className="rounded-full border border-[#ffb0b0]/35 px-3 py-1.5 text-[11px] font-medium text-[#ffd0d0] transition hover:border-[#ffb0b0]/60 hover:bg-[#ffb0b0]/10 disabled:opacity-50"
                    >
                      {copy.retry || '重新生成'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {busy ? (
                <div
                  className="mx-auto mt-4 flex max-w-[620px] items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left backdrop-blur-xl"
                  role="status"
                  aria-live="polite"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#090a0d]">
                    <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-white/88">
                      {copy.generating_statuses?.[
                        elapsedSeconds < 10 ? 0 : elapsedSeconds < 25 ? 1 : 2
                      ] ||
                        copy.generating ||
                        'Analyzing SOP'}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/42">
                      <span>{copy.generating_eta}</span>
                      <span>
                        {(
                          copy.generating_elapsed || '{seconds}s elapsed'
                        ).replace('{seconds}', String(elapsedSeconds))}
                      </span>
                    </div>
                  </div>
                </div>
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
                      setErrorRetryable(false);
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
              {(['flow', 'setup'] as const).map((value) => (
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
                  {value === 'flow' ? copy.preview : copy.setup}
                </button>
              ))}
              <div className="relative flex items-center gap-2">
                {showingSample ? null : (
                  <label
                    title={copy.review_confirm}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] transition',
                      reviewConfirmed
                        ? 'border-[#7cff67]/30 bg-[#7cff67]/[0.06] text-[#a9f59d]'
                        : 'border-white/15 text-white/65 hover:border-white/30 hover:text-white',
                      exportHint === 'confirm' &&
                        'border-[#f5c46b]/70 text-[#ffe2ad] ring-2 ring-[#f5c46b]/25',
                      (!draftIsValid || busy) && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={reviewConfirmed}
                      disabled={!draftIsValid || busy}
                      onChange={(event) => {
                        setReviewConfirmed(event.target.checked);
                        if (event.target.checked) setExportHint('');
                      }}
                      className="size-3.5 accent-[#7cff67]"
                    />
                    <span className="sm:hidden">
                      {copy.export_confirm_short || 'Reviewed'}
                    </span>
                    <span className="hidden sm:inline">
                      {copy.export_confirm || 'I reviewed this workflow'}
                    </span>
                  </label>
                )}
                <button
                  type="button"
                  aria-disabled={Boolean(exportBlocker)}
                  title={exportBlocker ? exportBlockerText(exportBlocker) : ''}
                  onClick={copyJson}
                  className={cn(
                    'hidden rounded-full border border-white/10 p-2 text-white/45 transition sm:block',
                    exportBlocker ? 'opacity-35' : 'hover:text-white'
                  )}
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
                  aria-disabled={Boolean(exportBlocker)}
                  title={exportBlocker ? exportBlockerText(exportBlocker) : ''}
                  onClick={downloadJson}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] transition',
                    exportBlocker
                      ? 'border-white/10 text-white/48 opacity-35'
                      : 'border-white bg-white font-medium text-black hover:bg-white/88'
                  )}
                >
                  <Download className="size-3" />
                  <span className="hidden sm:inline">
                    {copy.download || 'Download'}
                  </span>
                </button>
                {exportHint ? (
                  <div
                    role="status"
                    className="absolute top-full right-0 z-30 mt-2 w-72 rounded-xl border border-[#f5c46b]/30 bg-[#1a1710] px-3.5 py-2.5 text-[11px] leading-5 text-[#f5d9a3] shadow-2xl"
                  >
                    {exportBlockerText(exportHint)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="linearity-product-canvas min-h-[600px] md:min-h-[680px]">
            {showingSample ? (
              <div className="mx-5 mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#a99cff]/25 bg-[#a99cff]/[0.06] px-5 py-4 md:mx-10 md:mt-8">
                <div className="min-w-0">
                  <div className="text-[10px] tracking-[0.08em] text-[#a99cff]">
                    {copy.sample_badge || 'Sample result'}
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-white/90">
                    {copy.sample_title ||
                      'This workflow was generated from the order fulfilment example.'}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-white/45">
                    {copy.sample_description ||
                      'Paste your own SOP to get the same nodes, branches, exception handling and an n8n file.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSop(sample.sop);
                    setMode('auto');
                    revealInput();
                  }}
                  className="shrink-0 rounded-full bg-white px-4 py-2 text-[11px] font-medium text-black transition hover:bg-white/88"
                >
                  {copy.sample_try || 'Try this example'}
                </button>
              </div>
            ) : null}
            {activeTab === 'flow' ? (
              <div className="p-5 md:p-10">
                <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] tracking-[0.08em] text-[#a99cff]">
                      {showingSample
                        ? copy.sample_badge || 'Sample result'
                        : copy.generated}
                    </div>
                    <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em] md:text-3xl">
                      {preview.title}
                    </h3>
                    <p className="mt-2 text-xs text-white/40">
                      {preview.summary}
                    </p>
                    {result?.meta.detailsIncomplete ? (
                      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#f5c46b]/25 bg-[#f5c46b]/[0.06] px-4 py-2.5 text-[11px] text-[#f5d9a3]">
                        <span>
                          {copy.details_incomplete ||
                            'The main workflow is ready. Node details were not completed this time.'}
                        </span>
                        <button
                          type="button"
                          onClick={() => void generate()}
                          disabled={busy}
                          className="rounded-full border border-[#f5c46b]/35 px-3 py-1 font-medium text-[#ffe2ad] transition hover:bg-[#f5c46b]/10 disabled:opacity-50"
                        >
                          {copy.complete_details || 'Complete details'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[10px] text-white/45">
                    {preview.steps.length} {copy.nodes}
                  </span>
                </div>
                <div className="mx-auto max-w-4xl">
                  {graphRows.map(({ step, edges }, index) => {
                    const Icon = nodeIcons[step.operation];
                    const sourceBadge = getStepSourceBadge(step.source, {
                      sourceText: copy.source_text || 'Explicit in SOP',
                      aiInferred: copy.ai_inferred || 'AI inferred',
                      needsConfirmation:
                        copy.needs_confirmation || 'Needs confirmation',
                    });
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
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[9px] tracking-[0.12em] text-white/30 uppercase">
                              {copy.operation_labels?.[step.operation] ||
                                step.operation}{' '}
                              · {copy.step_label || 'Step'} {index + 1}
                            </span>
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[9px] font-medium',
                                sourceBadge.tone === 'confirmed' &&
                                  'border-[#7cff67]/25 bg-[#7cff67]/[0.07] text-[#a9f59d]',
                                sourceBadge.tone === 'inferred' &&
                                  'border-[#a99cff]/30 bg-[#a99cff]/[0.08] text-[#c5bcff]',
                                sourceBadge.tone === 'warning' &&
                                  'border-[#ffb45e]/30 bg-[#ffb45e]/[0.08] text-[#ffd29b]'
                              )}
                            >
                              {sourceBadge.label}
                            </span>
                          </div>
                          <h4 className="mt-2 text-sm font-medium">
                            {step.title}
                          </h4>
                          <p className="mt-1.5 text-[11px] leading-5 text-white/38">
                            {step.description}
                          </p>
                          {actorNames.get(step.ownerActorId || '') ? (
                            <div className="mt-3 text-[10px] text-white/35">
                              {copy.owner || 'Owner'} ·{' '}
                              {actorNames.get(step.ownerActorId || '')}
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
                                const target = preview.steps.find(
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
                                      <span>
                                        {copy.branch_labels?.[edge.branch] ||
                                          edge.branch}
                                      </span>
                                      <GitBranch className="size-3" />
                                    </div>
                                    <div className="mt-2 text-xs font-medium text-white/85">
                                      {edge.label}
                                    </div>
                                    <div className="mt-2 text-[10px] leading-4 text-white/42">
                                      →{' '}
                                      {target?.title ||
                                        copy.unknown_step ||
                                        'Unknown step'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                          {step.errorHandling.length ? (
                            <div className="mt-3 space-y-2 border-t border-[#ff9f9f]/15 pt-3">
                              {step.errorHandling.map((item) => {
                                const system =
                                  classifyErrorHandling(item) === 'system';
                                const aiAdded = isAiAddedErrorHandling(item);
                                return (
                                  <div
                                    key={`${step.id}-${item.scenario}`}
                                    className={cn(
                                      'linearity-branch-lane rounded-xl border px-3 py-2 text-[10px] leading-5',
                                      aiAdded && 'border-dashed',
                                      system
                                        ? 'border-[#ff9f9f]/20 bg-[#ff9f9f]/[0.05] text-[#ffc5c5]'
                                        : 'border-[#f5c46b]/20 bg-[#f5c46b]/[0.05] text-[#f5d9a3]'
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        'mr-2 inline-block rounded-full border px-1.5 text-[9px] leading-4 font-medium',
                                        aiAdded
                                          ? 'border-[#a99cff]/35 bg-[#a99cff]/[0.1] text-[#c5bcff]'
                                          : 'border-[#7cff67]/25 bg-[#7cff67]/[0.07] text-[#a9f59d]'
                                      )}
                                    >
                                      {aiAdded
                                        ? copy.error_source_ai || 'Added by AI'
                                        : copy.error_source_text || 'From SOP'}
                                    </span>
                                    <span className="mr-2 font-semibold">
                                      {system
                                        ? copy.error_kind_system ||
                                          'System error'
                                        : copy.error_kind_business ||
                                          'Business exception'}
                                    </span>
                                    {item.scenario}: {item.action}
                                    {system
                                      ? ` → ${copy.system_error_handler || 'System error handler'}`
                                      : item.targetStepId
                                        ? ` → ${stepTitles.get(item.targetStepId) || copy.unknown_step || 'Unknown step'}`
                                        : ''}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-10 p-5 md:p-10">
                {pendingQuestions.length ||
                confirmedConditions.length ||
                conditionsChanged ? (
                  <section aria-labelledby="confirmation-questions-title">
                    <div className="max-w-2xl">
                      <h3
                        id="confirmation-questions-title"
                        className="text-lg font-semibold tracking-[-0.02em]"
                      >
                        {copy.confirmation_title || 'Complete missing details'}
                      </h3>
                      <p className="mt-2 text-xs leading-6 text-white/42">
                        {copy.confirmation_description ||
                          'Your answers become confirmed conditions and regenerate the workflow.'}
                      </p>
                    </div>
                    {confirmedConditions.length ? (
                      <div className="mt-6 rounded-2xl border border-[#9ee792]/20 bg-[#9ee792]/[0.04] p-4">
                        <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-[#9ee792]">
                          <CheckCircle2 className="size-3.5" />
                          {copy.confirmed_conditions || 'Confirmed conditions'}
                        </div>
                        <ul className="space-y-2">
                          {confirmedConditions.map((item) => (
                            <li
                              key={item.questionId}
                              className="flex items-start justify-between gap-3 text-[11px] leading-5 text-white/60"
                            >
                              <span>
                                {item.question}
                                <span className="mx-2 text-white/30">→</span>
                                <span className="text-white/85">
                                  {item.answer}
                                </span>
                                {appliedKeys.has(
                                  `${item.questionId}\u0000${item.answer}`
                                ) ? null : (
                                  <span className="ml-2 text-[#f5c46b]">
                                    {copy.condition_pending ||
                                      '(not applied yet)'}
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setClarifications((current) =>
                                    current.filter(
                                      (candidate) =>
                                        candidate.questionId !== item.questionId
                                    )
                                  )
                                }
                                className="shrink-0 text-white/35 transition hover:text-white disabled:opacity-50"
                              >
                                {copy.remove_condition || 'Remove'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {pendingQuestions.length ? (
                      <div className="mt-6 grid gap-4 lg:grid-cols-2">
                        {pendingQuestions.map((question, index) => (
                          <fieldset
                            key={question.id}
                            disabled={showingSample}
                            className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-5"
                          >
                            <legend className="px-1 text-sm leading-6 font-medium text-white/88">
                              <span className="mr-2 text-[#a99cff]">
                                {index + 1}
                              </span>
                              {question.question}
                            </legend>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {question.options.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  aria-pressed={
                                    selectedAnswers[question.id] ===
                                    option.value
                                  }
                                  onClick={() => {
                                    setSelectedAnswers((current) => ({
                                      ...current,
                                      [question.id]: option.value,
                                    }));
                                    setCustomAnswers((current) => ({
                                      ...current,
                                      [question.id]: '',
                                    }));
                                    setError('');
                                  }}
                                  className={cn(
                                    'rounded-full border px-3 py-2 text-[11px] transition',
                                    selectedAnswers[question.id] ===
                                      option.value
                                      ? 'border-white bg-white text-black'
                                      : 'border-white/12 text-white/55 hover:border-white/25 hover:text-white'
                                  )}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                            <input
                              value={customAnswers[question.id] || ''}
                              onChange={(event) => {
                                const value = event.target.value;
                                setCustomAnswers((current) => ({
                                  ...current,
                                  [question.id]: value,
                                }));
                                setSelectedAnswers((current) => {
                                  if (value.trim()) {
                                    return {
                                      ...current,
                                      [question.id]: '__custom__',
                                    };
                                  }
                                  if (current[question.id] !== '__custom__') {
                                    return current;
                                  }
                                  const { [question.id]: _cleared, ...rest } =
                                    current;
                                  return rest;
                                });
                                setError('');
                              }}
                              maxLength={1000}
                              aria-label={copy.custom_answer || 'Custom answer'}
                              placeholder={
                                copy.custom_answer_placeholder ||
                                'Enter the condition in your own words'
                              }
                              className={cn(
                                'mt-3 h-11 w-full rounded-xl border bg-black/25 px-3 text-base text-white transition outline-none placeholder:text-white/28 focus:border-white/30 md:text-sm',
                                selectedAnswers[question.id] === '__custom__'
                                  ? 'border-white/40'
                                  : 'border-white/12'
                              )}
                            />
                          </fieldset>
                        ))}
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        'mt-5 flex flex-wrap items-center gap-3',
                        showingSample && 'hidden'
                      )}
                    >
                      <button
                        type="button"
                        onClick={applyClarifications}
                        disabled={busy}
                        className="rounded-full bg-white px-5 py-2.5 text-xs font-medium text-black transition hover:bg-white/88 disabled:opacity-50"
                      >
                        {copy.apply_answers || 'Apply answers and regenerate'}
                      </button>
                      {error ? (
                        <span className="text-xs text-[#ffb0b0]" role="alert">
                          {error}
                        </span>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                  {setupSections.map(({ title, items, icon: Icon }) => (
                    <div key={title}>
                      <div className="mb-5 flex items-center gap-2 text-sm font-medium">
                        <Icon className="size-4 text-[#a99cff]" />
                        {title}
                      </div>
                      <div className="space-y-3">
                        {items.map((item, index) => (
                          <div
                            key={`${title}-${index}`}
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

                <details
                  className={cn(
                    'group rounded-2xl border border-white/10 bg-black/20',
                    showingSample && 'hidden'
                  )}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden">
                    <span>
                      <span className="block text-sm font-medium">
                        {copy.advanced || 'Advanced'}
                      </span>
                      <span className="mt-1 block text-[10px] leading-5 text-white/38">
                        {copy.advanced_description ||
                          'Inspect and edit the structured JSON only when needed.'}
                      </span>
                    </span>
                    <ChevronDown className="size-4 text-white/45 transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-white/[0.08] p-5 md:p-6">
                    <div className="mb-5 flex items-center gap-2 rounded-xl border border-white/10 bg-[#15161c] px-4 py-3 text-[11px] text-white/70">
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
                      className="min-h-[360px] w-full resize-y rounded-2xl border border-white/[0.08] bg-black/35 p-5 font-mono text-[11px] leading-6 text-[#d8d3cf] transition outline-none focus:border-white/20"
                      aria-label={
                        copy.structured_json || 'Structured workflow JSON'
                      }
                    />
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-[11px] text-[#9ee792]">
                        {validationMessage ? (
                          <CheckCircle2 className="size-4" />
                        ) : null}
                        {validationMessage ||
                          copy.review_required ||
                          'Validate JSON before confirming.'}
                      </span>
                    </div>
                  </div>
                </details>
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
