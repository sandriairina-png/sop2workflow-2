import assert from 'node:assert/strict';
import test from 'node:test';

import { compileN8nWorkflow, SopAnalysis } from './sop-workflow';

function basicAnalysis(): SopAnalysis {
  return {
    schemaVersion: '1.0',
    title: 'ERP 订单校验',
    summary: '校验订单后结束。',
    trigger: { type: 'manual', description: '人工触发' },
    actors: [],
    steps: [
      {
        id: 'validate-order',
        title: '校验订单',
        description: '检查订单必填字段。',
        operation: 'transform',
        inputs: ['order'],
        outputs: ['validatedOrder'],
        next: [
          { targetStepId: 'done', label: '完成', branch: 'default' },
        ],
        errorHandling: [],
      },
      {
        id: 'done',
        title: '结束',
        description: '流程结束。',
        operation: 'end',
        inputs: [],
        outputs: [],
        next: [],
        errorHandling: [],
      },
    ],
    assumptions: [],
    missingInformation: [],
    deploymentChecklist: ['导入 n8n 后检查字段映射。'],
    risks: [],
    tests: [],
  };
}

test('compiles valid trigger structure and inactive workflow', () => {
  const result = compileN8nWorkflow(basicAnalysis());
  assert.equal(result.nodes[0].type, 'n8n-nodes-base.manualTrigger');
  assert.equal(result.active, false);
});

test('generates unique node ids and names', () => {
  const result = compileN8nWorkflow(basicAnalysis());
  assert.equal(
    new Set(result.nodes.map((node) => node.id)).size,
    result.nodes.length
  );
  assert.equal(
    new Set(result.nodes.map((node) => node.name)).size,
    result.nodes.length
  );
});

test('keeps every connection target present in the workflow', () => {
  const result = compileN8nWorkflow(basicAnalysis());
  const names = new Set(result.nodes.map((node) => node.name));
  for (const connection of Object.values(result.connections) as any[]) {
    for (const output of connection.main) {
      for (const edge of output) assert.ok(names.has(edge.node));
    }
  }
});
