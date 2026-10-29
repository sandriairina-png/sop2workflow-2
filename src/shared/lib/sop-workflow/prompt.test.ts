import assert from 'node:assert/strict';
import test from 'node:test';

import { SOP_ANALYSIS_SYSTEM_PROMPT } from './prompt';

test('gives the model an exact JSON contract for structured SOP output', () => {
  assert.match(SOP_ANALYSIS_SYSTEM_PROMPT, /"schemaVersion": "1\.0"/);
  assert.match(SOP_ANALYSIS_SYSTEM_PROMPT, /"operation": "condition"/);
  assert.match(SOP_ANALYSIS_SYSTEM_PROMPT, /"branch": "true"/);
  assert.match(SOP_ANALYSIS_SYSTEM_PROMPT, /greaterThanOrEqual/);
  assert.match(SOP_ANALYSIS_SYSTEM_PROMPT, /"deploymentChecklist": \[/);
});
