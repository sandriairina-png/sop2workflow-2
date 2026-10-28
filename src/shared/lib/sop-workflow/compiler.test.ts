import assert from 'node:assert/strict';
import test from 'node:test';

import { compileN8nWorkflow } from './compiler';
import { SopAnalysis, SopStep } from './schema';

function step(
  overrides: Partial<SopStep> & Pick<SopStep, 'id' | 'operation'>
): SopStep {
  return {
    title: overrides.id,
    description: overrides.id,
    inputs: [],
    outputs: [],
    next: [],
    errorHandling: [],
    ...overrides,
    id: overrides.id,
    operation: overrides.operation,
  };
}

function analysis(steps: SopStep[]): SopAnalysis {
  return {
    schemaVersion: '1.0',
    title: '测试流程',
    summary: '测试结构化流程',
    trigger: {
      type: 'schedule',
      description: '每天 9 点',
      schedule: { hour: 9, minute: 0, timezone: 'Asia/Shanghai' },
    },
    actors: [],
    steps,
    assumptions: [],
    missingInformation: [],
    deploymentChecklist: [],
    risks: [],
    tests: [],
  };
}

function condition(
  targetStepId: string,
  branch: 'true' | 'false' | 'case',
  operator: 'greaterThan' | 'greaterThanOrEqual' | 'lessThan',
  rightValue: number,
  label: string
) {
  return {
    targetStepId,
    branch,
    label,
    condition: {
      leftValue: '{{$json.amount}}',
      operator,
      rightValue,
      explanation: label,
    },
  } as const;
}

test('compiles a daily schedule trigger', () => {
  const result = compileN8nWorkflow(
    analysis([step({ id: 'done', operation: 'end' })])
  );
  assert.equal(result.nodes[0].type, 'n8n-nodes-base.scheduleTrigger');
  assert.deepEqual(result.nodes[0].parameters.rule, {
    interval: [
      {
        field: 'days',
        daysInterval: 1,
        triggerAtHour: 9,
        triggerAtMinute: 0,
      },
    ],
  });
});

test('compiles inventory outcomes to true and false outputs', () => {
  const source = analysis([
    step({
      id: 'check-stock',
      operation: 'condition',
      next: [
        condition('notify-warehouse', 'true', 'greaterThan', 0, '库存充足'),
        condition('notify-purchase', 'false', 'lessThan', 1, '库存不足'),
      ],
    }),
    step({ id: 'notify-warehouse', operation: 'notify' }),
    step({ id: 'notify-purchase', operation: 'notify' }),
  ]);
  const result = compileN8nWorkflow(source);
  const ifNode = result.nodes.find((node) => node.id === 'check-stock')!;
  assert.equal(ifNode.type, 'n8n-nodes-base.if');
  const outputs = (result.connections[ifNode.name] as any).main;
  assert.equal(outputs[0][0].node, 'notify-warehouse');
  assert.equal(outputs[1][0].node, 'notify-purchase');
});

test('preserves greater-than-or-equal 5000 in an If node', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'amount-check',
        operation: 'condition',
        next: [
          condition(
            'finance',
            'true',
            'greaterThanOrEqual',
            5000,
            '大于等于 5000'
          ),
          condition('manager', 'false', 'lessThan', 5000, '小于 5000'),
        ],
      }),
      step({ id: 'finance', operation: 'approve' }),
      step({ id: 'manager', operation: 'approve' }),
    ])
  );
  const node = result.nodes.find(
    (candidate) => candidate.id === 'amount-check'
  )!;
  const item = (node.parameters.conditions as any).conditions[0];
  assert.equal(item.operator.operation, 'gte');
  assert.equal(item.rightValue, 5000);
});

test('maps approval rejection follow-up to notification semantics', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'notify-rejection',
        title: '审批驳回后通知员工',
        operation: 'notify',
        integration: {
          system: 'Email',
          action: '发送驳回通知',
          credentialRequired: true,
          endpointKnown: false,
        },
      }),
    ])
  );
  assert.equal(
    result.nodes.find((node) => node.id === 'notify-rejection')?.type,
    'n8n-nodes-base.emailSend'
  );
});

test('maps three cases to Switch output indexes', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'route',
        operation: 'condition',
        next: [
          condition('a', 'case', 'lessThan', 1000, '低'),
          condition('b', 'case', 'lessThan', 5000, '中'),
          condition('c', 'case', 'greaterThanOrEqual', 5000, '高'),
        ],
      }),
      step({ id: 'a', operation: 'end' }),
      step({ id: 'b', operation: 'end' }),
      step({ id: 'c', operation: 'end' }),
    ])
  );
  const switchNode = result.nodes.find((node) => node.id === 'route')!;
  assert.equal(switchNode.type, 'n8n-nodes-base.switch');
  const outputs = (result.connections[switchNode.name] as any).main;
  assert.equal(outputs[0][0].node, 'a');
  assert.equal(outputs[1][0].node, 'b');
  assert.equal(outputs[2][0].node, 'c');
});

test('compiles explicit merge nodes and incoming connections', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'left',
        operation: 'transform',
        next: [{ targetStepId: 'join', label: '完成', branch: 'default' }],
      }),
      step({ id: 'join', operation: 'merge' }),
    ])
  );
  assert.equal(
    result.nodes.find((node) => node.id === 'join')?.type,
    'n8n-nodes-base.merge'
  );
  assert.equal((result.connections.left as any).main[0][0].node, 'join');
});

test('uses a disabled HTTP Request placeholder without secrets', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'erp-write',
        operation: 'write',
        integration: {
          system: 'ERP',
          action: '创建采购申请',
          credentialRequired: true,
          endpointKnown: false,
        },
      }),
    ])
  );
  const node = result.nodes.find((candidate) => candidate.id === 'erp-write')!;
  assert.equal(node.type, 'n8n-nodes-base.httpRequest');
  assert.equal(node.disabled, true);
  assert.match(String(node.parameters.url), /replace-me\.invalid/);
  assert.doesNotMatch(JSON.stringify(result), /sk-[a-z0-9_-]{16,}/i);
  assert.ok(result.configurationRequirements.length > 0);
});

test('exports inactive workflows', () => {
  const result = compileN8nWorkflow(
    analysis([step({ id: 'done', operation: 'end' })])
  );
  assert.equal(result.active, false);
});

test('compiles explicit exception targets as n8n error outputs', () => {
  const result = compileN8nWorkflow(
    analysis([
      step({
        id: 'erp-read',
        operation: 'read',
        next: [{ targetStepId: 'done', label: '成功', branch: 'default' }],
        errorHandling: [
          {
            scenario: 'ERP 超时',
            action: '通知管理员',
            targetStepId: 'notify-error',
          },
        ],
      }),
      step({ id: 'done', operation: 'end' }),
      step({ id: 'notify-error', operation: 'notify' }),
    ])
  );
  const source = result.nodes.find((node) => node.id === 'erp-read')!;
  assert.equal(source.onError, 'continueErrorOutput');
  const outputs = (result.connections[source.name] as any).main;
  assert.equal(outputs[0][0].node, 'done');
  assert.equal(outputs[1][0].node, 'notify-error');
});
