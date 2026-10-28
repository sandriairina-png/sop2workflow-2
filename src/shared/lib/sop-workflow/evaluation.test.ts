import assert from 'node:assert/strict';
import test from 'node:test';

import { compileN8nWorkflow } from './compiler';
import cases from './evaluation-cases.json';
import { SOP_WORKFLOW_FIXTURES } from './fixtures';
import { SOP_ANALYSIS_PROMPT_VERSION } from './prompt';

for (const evaluation of cases) {
  test(`offline model regression: ${evaluation.id}`, () => {
    const analysis = SOP_WORKFLOW_FIXTURES[evaluation.fixtureId];
    assert.ok(analysis, `unknown fixture ${evaluation.fixtureId}`);
    assert.equal(evaluation.model, 'gemini-3.8-flash');
    assert.equal(evaluation.promptVersion, SOP_ANALYSIS_PROMPT_VERSION);
    assert.equal(analysis.trigger.type, evaluation.expected.trigger);
    const branchCount = analysis.steps
      .filter((step) => step.operation === 'condition')
      .reduce((total, step) => total + step.next.length, 0);
    assert.ok(branchCount >= evaluation.expected.minBranches);
    for (const operation of evaluation.expected.operations) {
      assert.ok(analysis.steps.some((step) => step.operation === operation));
    }
    const workflow = compileN8nWorkflow(analysis);
    for (const nodeType of evaluation.expected.nodeTypes) {
      assert.ok(workflow.nodes.some((node) => node.type === nodeType));
    }
    assert.ok(analysis.risks.length >= evaluation.expected.minRisks);
    assert.ok(analysis.tests.length >= evaluation.expected.minTests);
  });
}
