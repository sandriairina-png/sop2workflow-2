import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileN8nWorkflow,
  validateSopAnalysisGraph,
} from '@/shared/lib/sop-workflow';

import { SAMPLE_WORKFLOWS } from './sop-workflow-sample';

test('ships valid, exportable sample workflows', () => {
  for (const { sop, analysis } of Object.values(SAMPLE_WORKFLOWS)) {
    assert.ok(sop.length > 10);
    validateSopAnalysisGraph(analysis);
    const workflow = compileN8nWorkflow(analysis);
    assert.equal(workflow.nodes[0].type, 'n8n-nodes-base.scheduleTrigger');
    assert.ok(workflow.nodes.some((node) => node.type === 'n8n-nodes-base.if'));
    assert.ok(analysis.confirmationQuestions.length > 0);
  }
});
