import assert from 'node:assert/strict';
import test from 'node:test';
import { generateWorkflow } from './workflow';

test('daily time in SOP configures a day-based n8n schedule', () => {
  const result = generateWorkflow('每天 9 点从 ERP 拉取待发货订单，检查库存。', 'schedule');
  const nodes = result.workflow.nodes as Array<{ type: string; parameters: { rule?: { interval: Array<Record<string, unknown>> } } }>;
  assert.deepEqual(nodes[0].parameters.rule?.interval[0], {
    field: 'days', daysInterval: 1, triggerAtHour: 9, triggerAtMinute: 0,
  });
  assert.match(result.steps[0].detail, /9:00/);
});

test('a notification step is labeled as a notification even when it mentions inventory', () => {
  const result = generateWorkflow('库存不足则通知采购。', 'manual');
  assert.equal(result.steps[1].kind, 'notify');
});
