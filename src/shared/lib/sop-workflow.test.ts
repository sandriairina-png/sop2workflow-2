import assert from 'node:assert/strict';
import test from 'node:test';

import { generateSopWorkflow } from './sop-workflow';

test('extracts a daily time into an n8n schedule trigger', () => {
  const result = generateSopWorkflow(
    '每天 9 点从 ERP 拉取待发货订单，检查库存。',
    'schedule'
  );
  const trigger = result.workflow.nodes[0];

  assert.deepEqual(trigger.parameters, {
    rule: {
      interval: [
        {
          field: 'days',
          daysInterval: 1,
          triggerAtHour: 9,
          triggerAtMinute: 0,
        },
      ],
    },
  });
  assert.equal(result.workflow.active, false);
});

test('notification takes precedence when a step also mentions inventory', () => {
  const result = generateSopWorkflow('库存不足则通知采购。', 'manual');
  assert.equal(result.steps[1].kind, 'notify');
});

test('throws a clear error for empty SOP input', () => {
  assert.throws(() => generateSopWorkflow('   ', 'manual'), /SOP/);
});

test('connects every generated node in order', () => {
  const result = generateSopWorkflow('校验订单。\n通知仓库。', 'manual');
  assert.equal(result.workflow.nodes.length, 3);
  assert.equal(Object.keys(result.workflow.connections).length, 2);
});

test('localizes generated review copy for Chinese SOPs', () => {
  const result = generateSopWorkflow('校验订单。\n通知仓库。', 'manual', 'zh');
  assert.equal(result.steps[0].title, '手动触发');
  assert.match(result.summary, /2 个业务步骤/);
  assert.match(result.checklist[0], /导入 n8n/);
});
