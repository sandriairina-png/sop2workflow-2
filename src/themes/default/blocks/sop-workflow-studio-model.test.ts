import assert from 'node:assert/strict';
import test from 'node:test';

import { SopAnalysis } from '@/shared/lib/sop-workflow';

import {
  buildClarificationAnswers,
  buildWorkflowGraphRows,
  getStepSourceBadge,
  resolveWorkflowError,
  validateAnalysisDraft,
} from './sop-workflow-studio-model';

const analysis: SopAnalysis = {
  schemaVersion: '1.0',
  title: '库存检查',
  summary: '按库存分支处理',
  trigger: { type: 'schedule', description: '每天 9 点' },
  actors: [],
  steps: [
    {
      id: 'check',
      title: '检查库存',
      description: '读取数量',
      source: 'source_text',
      operation: 'condition',
      inputs: [],
      outputs: [],
      next: [
        {
          targetStepId: 'enough',
          label: '库存充足',
          branch: 'true',
          condition: {
            leftValue: '{{$json.stock}}',
            operator: 'greaterThanOrEqual',
            rightValue: 10,
            explanation: '库存达到安全值',
          },
        },
        {
          targetStepId: 'buy',
          label: '库存不足',
          branch: 'false',
          condition: {
            leftValue: '{{$json.stock}}',
            operator: 'lessThan',
            rightValue: 10,
            explanation: '库存低于安全值',
          },
        },
      ],
      errorHandling: [],
    },
    {
      id: 'enough',
      title: '通知仓库',
      description: '继续履约',
      source: 'ai_inferred',
      operation: 'notify',
      inputs: [],
      outputs: [],
      next: [],
      errorHandling: [],
    },
    {
      id: 'buy',
      title: '通知采购',
      description: '发起补货',
      source: 'needs_confirmation',
      operation: 'notify',
      inputs: [],
      outputs: [],
      next: [],
      errorHandling: [],
    },
  ],
  assumptions: [],
  missingInformation: [],
  confirmationQuestions: [],
  deploymentChecklist: [],
  risks: [],
  tests: [],
};

test('preserves real branch labels and targets in graph rows', () => {
  const rows = buildWorkflowGraphRows(analysis);
  assert.deepEqual(rows[0].edges, [
    { targetStepId: 'enough', label: '库存充足', branch: 'true' },
    { targetStepId: 'buy', label: '库存不足', branch: 'false' },
  ]);
});

test('accepts a valid edited analysis and rejects broken references', () => {
  assert.equal(
    validateAnalysisDraft(JSON.stringify(analysis)).title,
    '库存检查'
  );
  const broken = structuredClone(analysis);
  broken.steps[0].next[0].targetStepId = 'missing';
  assert.throws(
    () => validateAnalysisDraft(JSON.stringify(broken)),
    /unknown step/
  );
});

test('turns provider failures into a retryable user-facing state', () => {
  const result = resolveWorkflowError('provider_timeout', {
    fallback: '生成失败',
    timeout: '这份 SOP 较复杂，本次分析未在规定时间内完成。',
    provider: '模型服务暂时不可用。',
  });

  assert.deepEqual(result, {
    message: '这份 SOP 较复杂，本次分析未在规定时间内完成。',
    retryable: true,
  });
  assert.deepEqual(
    resolveWorkflowError('transport_error', {
      fallback: '生成失败',
      timeout: '超时',
      provider: '模型服务暂时不可用。',
    }),
    { message: '模型服务暂时不可用。', retryable: true }
  );
  assert.equal(
    resolveWorkflowError('invalid_request', {
      fallback: '生成失败',
      timeout: '超时',
      provider: '服务不可用',
    }).retryable,
    false
  );
});

test('maps node provenance to a localized semantic badge', () => {
  assert.deepEqual(
    getStepSourceBadge('needs_confirmation', {
      sourceText: '原文明确',
      aiInferred: 'AI 推断',
      needsConfirmation: '需用户确认',
    }),
    { label: '需用户确认', tone: 'warning' }
  );
});

test('builds supplemental model conditions from selected and custom answers', () => {
  const questions = [
    {
      id: 'threshold',
      question: '财务总监审批阈值？',
      options: [
        { value: '5000', label: '5000 元' },
        { value: '10000', label: '10000 元' },
      ],
      allowCustom: true,
    },
    {
      id: 'reject_path',
      question: '驳回后的处理方式？',
      options: [
        { value: 'resubmit', label: '补充后重提' },
        { value: 'end', label: '结束流程' },
      ],
      allowCustom: true,
    },
  ];

  assert.deepEqual(
    buildClarificationAnswers(
      questions,
      { threshold: '5000', reject_path: '__custom__' },
      { reject_path: '驳回原节点修改后重新提交' }
    ),
    [
      {
        questionId: 'threshold',
        question: '财务总监审批阈值？',
        answer: '5000 元',
      },
      {
        questionId: 'reject_path',
        question: '驳回后的处理方式？',
        answer: '驳回原节点修改后重新提交',
      },
    ]
  );
});
