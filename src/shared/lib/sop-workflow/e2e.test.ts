import assert from 'node:assert/strict';
import test from 'node:test';

import { compileN8nWorkflow } from './compiler';
import { SOP_WORKFLOW_FIXTURES } from './fixtures';
import { validateSopAnalysisGraph } from './graph';

for (const [name, fixture] of Object.entries(SOP_WORKFLOW_FIXTURES)) {
  test(`validates and compiles fixture: ${name}`, () => {
    const analysis = validateSopAnalysisGraph(fixture);
    const workflow = compileN8nWorkflow(analysis);
    const nodeNames = new Set(workflow.nodes.map((node) => node.name));
    for (const connection of Object.values(workflow.connections) as any[]) {
      for (const output of connection.main) {
        for (const target of output) assert.ok(nodeNames.has(target.node));
      }
    }
    assert.ok(analysis.deploymentChecklist.length > 0);
    assert.ok(analysis.tests.length > 0);
    assert.doesNotMatch(JSON.stringify(workflow), /sk-[a-z0-9_-]{16,}/i);
  });
}

test('keeps real decision and integration node types in the compiled output', () => {
  const inventory = compileN8nWorkflow(SOP_WORKFLOW_FIXTURES.inventoryBranch);
  assert.ok(inventory.nodes.some((node) => node.type === 'n8n-nodes-base.if'));
  assert.ok(
    inventory.nodes.some((node) => node.type === 'n8n-nodes-base.httpRequest')
  );
  const rejection = compileN8nWorkflow(SOP_WORKFLOW_FIXTURES.rejectionNotice);
  assert.ok(
    rejection.nodes.some((node) => node.type === 'n8n-nodes-base.emailSend')
  );
});
