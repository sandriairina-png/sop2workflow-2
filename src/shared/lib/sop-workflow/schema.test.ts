import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSopAnalysisGraph } from './graph';
import { SopAnalysis, SopAnalysisSchema } from './schema';

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

test('accepts a branched inventory analysis', () => {
  const parsed = SopAnalysisSchema.parse(inventoryAnalysis());
  assert.deepEqual(validateSopAnalysisGraph(parsed), parsed);
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
  analysis.missingInformation = [
    'Use credential sk-example-secret-value-1234567890',
  ];
  assert.throws(() => validateSopAnalysisGraph(analysis), /secret/i);
});
