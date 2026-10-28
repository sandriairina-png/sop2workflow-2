import assert from 'node:assert/strict';
import test from 'node:test';

import { SopAnalysis } from '@/shared/lib/sop-workflow';

import {
  buildWorkflowGraphRows,
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
      operation: 'notify',
      inputs: [],
      outputs: [],
      next: [],
      errorHandling: [],
    },
  ],
  assumptions: [],
  missingInformation: [],
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
