import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSopAnalysisGraph } from './graph';
import {
  classifyErrorHandling,
  SopAnalysis,
  SopAnalysisSchema,
  SopStepSchema,
} from './schema';

function inventoryAnalysis(): SopAnalysis {
  return {
    schemaVersion: '1.0',
    title: '每日库存检查',
    summary: '每天检查库存并按库存状态通知对应团队。',
    trigger: {
      type: 'schedule',
      description: '每天 9 点运行',
      schedule: { hour: 9, minute: 0, timezone: 'Asia/Shanghai' },
    },
    actors: [
      { id: 'warehouse', name: '仓库', responsibility: '处理拣货' },
      { id: 'purchasing', name: '采购', responsibility: '处理补货' },
    ],
    steps: [
      {
        id: 'check-stock',
        title: '检查库存',
        description: '从 ERP 获取可用库存并判断是否充足。',
        source: 'source_text',
        operation: 'condition',
        integration: {
          system: 'ERP',
          action: '读取库存',
          credentialRequired: true,
          endpointKnown: false,
        },
        inputs: ['SKU'],
        outputs: ['availableStock'],
        next: [
          {
            targetStepId: 'notify-warehouse',
            label: '库存充足',
            branch: 'true',
            condition: {
              leftValue: '{{$json.availableStock}}',
              operator: 'greaterThan',
              rightValue: 0,
              explanation: '可用库存大于 0',
            },
          },
          {
            targetStepId: 'notify-purchasing',
            label: '库存不足',
            branch: 'false',
            condition: {
              leftValue: '{{$json.availableStock}}',
              operator: 'lessThanOrEqual',
              rightValue: 0,
              explanation: '可用库存小于等于 0',
            },
          },
        ],
        errorHandling: [
          { scenario: 'ERP 不可用', action: '记录异常并停止流程' },
        ],
      },
      {
        id: 'notify-warehouse',
        title: '通知仓库',
        description: '通知仓库拣货。',
        source: 'source_text',
        ownerActorId: 'warehouse',
        operation: 'notify',
        inputs: ['SKU'],
        outputs: [],
        next: [],
        errorHandling: [],
      },
      {
        id: 'notify-purchasing',
        title: '通知采购',
        description: '通知采购补货。',
        source: 'source_text',
        ownerActorId: 'purchasing',
        operation: 'notify',
        inputs: ['SKU'],
        outputs: [],
        next: [],
        errorHandling: [],
      },
    ],
    assumptions: ['库存充足指可用库存大于 0。'],
    missingInformation: ['ERP 库存接口地址。'],
    confirmationQuestions: [],
    deploymentChecklist: ['配置 ERP 凭据并确认工作流时区。'],
    risks: [
      {
        level: 'high',
        title: '并发库存变化',
        description: '读取后库存可能变化。',
        mitigation: '执行前再次校验库存。',
      },
    ],
    tests: [
      { name: '零库存', input: 'availableStock=0', expected: '通知采购' },
    ],
  };
}

function aiNativeFields() {
  return {
    feasibility: {
      score: 80,
      verdict: 'conditional' as const,
      summary: '适合从人工确认模式开始。',
      dimensions: [
        { name: '任务结构化', score: 85, reason: '步骤明确' },
        { name: '信息数字化', score: 80, reason: '主要输入可获取' },
        { name: '判断可外化', score: 75, reason: '规则可描述' },
        { name: '容错空间', score: 70, reason: '发布前可人工确认' },
        { name: '反馈闭环', score: 90, reason: '可记录人工修订' },
      ],
      blockers: [],
    },
    nativeBlueprint: {
      objective: '让 AI 先处理任务，人工负责最终判断。',
      humanAiBoundary: [
        {
          stage: '处理',
          aiRole: '生成候选结果',
          humanRole: '确认结果',
          handoff: '候选结果和依据',
          acceptance: '负责人确认',
        },
      ],
      skills: [
        {
          name: '生成候选结果',
          trigger: '收到任务',
          input: '业务上下文',
          output: '候选结果与依据',
        },
      ],
      dataPlan: [
        { source: '人工修订', captureAt: '确认后', purpose: '持续评测' },
      ],
      memoryPlan: [
        {
          layer: 'episodic' as const,
          readAt: '相似任务开始时',
          writeAt: '任务验收后',
          governance: '定期去重和过期',
        },
      ],
      guardrails: [
        { risk: '错误发布', rule: '不得自动发布', humanCheckpoint: '发布前' },
      ],
      implementationPhases: [
        {
          phase: '试点',
          goal: '验证闭环',
          deliverables: ['可运行原型'],
          successMetric: '人工采纳率达到 80%',
        },
      ],
    },
  };
}

test('accepts a branched inventory analysis', () => {
  const parsed = SopAnalysisSchema.parse(inventoryAnalysis());
  assert.deepEqual(validateSopAnalysisGraph(parsed), parsed);
});

test('accepts a complete five-dimension AI Native blueprint', () => {
  const parsed = SopAnalysisSchema.parse({
    ...inventoryAnalysis(),
    ...aiNativeFields(),
  });

  assert.equal(parsed.feasibility?.dimensions.length, 5);
  assert.equal(parsed.nativeBlueprint?.skills.length, 1);
});

test('rejects an incomplete AI Native blueprint', () => {
  const fields = aiNativeFields();
  assert.throws(() =>
    SopAnalysisSchema.parse({
      ...inventoryAnalysis(),
      ...fields,
      feasibility: {
        ...fields.feasibility,
        dimensions: fields.feasibility.dimensions.slice(0, 4),
      },
    })
  );
  assert.throws(() =>
    SopAnalysisSchema.parse({
      ...inventoryAnalysis(),
      ...fields,
      nativeBlueprint: { ...fields.nativeBlueprint, skills: [] },
    })
  );
});

test('rejects duplicate and missing step references', () => {
  const duplicate = inventoryAnalysis();
  duplicate.steps[1].id = 'check-stock';
  assert.throws(() => validateSopAnalysisGraph(duplicate), /duplicate/i);

  const missing = inventoryAnalysis();
  missing.steps[0].next[0].targetStepId = 'not-a-step';
  assert.throws(() => validateSopAnalysisGraph(missing), /unknown step/i);
});

test('rejects a condition with fewer than two branches', () => {
  const analysis = inventoryAnalysis();
  analysis.steps[0].next = analysis.steps[0].next.slice(0, 1);
  assert.throws(() => validateSopAnalysisGraph(analysis), /two branches/i);
});

test('preserves an inclusive 5000 threshold', () => {
  const analysis = inventoryAnalysis();
  analysis.steps[0].next[0].condition = {
    leftValue: '{{$json.amount}}',
    operator: 'greaterThanOrEqual',
    rightValue: 5000,
    explanation: '金额大于等于 5000 元',
  };
  const parsed = SopAnalysisSchema.parse(analysis);
  assert.equal(
    parsed.steps[0].next[0].condition?.operator,
    'greaterThanOrEqual'
  );
  assert.equal(parsed.steps[0].next[0].condition?.rightValue, 5000);
});

test('keeps rejection notification semantic', () => {
  const analysis = inventoryAnalysis();
  analysis.steps[1] = {
    ...analysis.steps[1],
    id: 'notify-rejection',
    title: '审批驳回后通知员工',
    description: '主管驳回后通知提交员工。',
    operation: 'notify',
  };
  analysis.steps[0].next[0].targetStepId = 'notify-rejection';
  const parsed = SopAnalysisSchema.parse(analysis);
  assert.equal(parsed.steps[1].operation, 'notify');
});

test('rejects secret-like generated values', () => {
  const analysis = inventoryAnalysis();
  analysis.missingInformation = ['Use api_key=example-secret-value-1234567890'];
  assert.throws(() => validateSopAnalysisGraph(analysis), /secret/i);
});

test('requires every workflow node to declare a valid source', () => {
  const step = {
    id: 'submit',
    title: '提交申请',
    description: '员工提交报销申请。',
    operation: 'write',
    inputs: [],
    outputs: [],
    next: [],
    errorHandling: [],
  };

  assert.throws(() => SopStepSchema.parse(step));
  assert.equal(
    SopStepSchema.parse({ ...step, source: 'source_text' }).source,
    'source_text'
  );
  assert.throws(() =>
    SopStepSchema.parse({ ...step, source: 'model_guessed' })
  );
});

test('keeps 2 to 3 answer options for each confirmation question', () => {
  const analysis = inventoryAnalysis() as unknown as Record<string, unknown>;
  analysis.confirmationQuestions = [
    {
      id: 'approval_after_reject',
      question: '驳回后应如何处理？',
      options: [
        { value: 'resubmit', label: '补充材料后重新提交' },
        { value: 'end', label: '直接结束流程' },
      ],
      allowCustom: true,
    },
  ];

  const parsed = SopAnalysisSchema.parse(analysis) as unknown as {
    confirmationQuestions: Array<{ options: unknown[] }>;
  };
  assert.equal(parsed.confirmationQuestions[0].options.length, 2);

  const invalid = structuredClone(analysis) as typeof analysis;
  (invalid.confirmationQuestions as Array<{ options: unknown[] }>)[0].options =
    [{ value: 'only', label: '唯一选项' }];
  assert.throws(() => SopAnalysisSchema.parse(invalid));
});

test('rejects steps that are only reachable through error handling', () => {
  const analysis = inventoryAnalysis();
  analysis.steps.push({
    ...analysis.steps[analysis.steps.length - 1],
    id: 'orphan-alert',
    next: [],
  });
  analysis.steps[0].errorHandling = [
    {
      scenario: 'ERP 超时',
      action: '通知管理员',
      targetStepId: 'orphan-alert',
    },
  ];
  assert.throws(
    () => validateSopAnalysisGraph(analysis),
    /unreachable through next: orphan-alert/
  );
});

test('classifies system and business exceptions', () => {
  assert.equal(
    classifyErrorHandling({ scenario: '信用接口查询超时', action: '告警' }),
    'system'
  );
  assert.equal(
    classifyErrorHandling({ scenario: '审批超时', action: '催办上级' }),
    'business'
  );
  assert.equal(
    classifyErrorHandling({ scenario: '库存不足', action: '生成采购需求' }),
    'business'
  );
  assert.equal(
    classifyErrorHandling({
      kind: 'system',
      scenario: '审批人未配置',
      action: '通知管理员',
    }),
    'system'
  );
});

test('classifies by the scenario before the remediation text', () => {
  assert.equal(
    classifyErrorHandling({
      scenario: '退款金额解析为空',
      action: '转大额人工审批确认',
    }),
    'system'
  );
  assert.equal(
    classifyErrorHandling({
      scenario: '审批接口调用超时',
      action: '通知主管',
    }),
    'system'
  );
  assert.equal(
    classifyErrorHandling({ scenario: '老板未及时响应', action: '通知主管' }),
    'business'
  );
});
