import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SOP_PLAN_SYSTEM_PROMPT,
  SOP_SKELETON_SYSTEM_PROMPT,
  SOP_STEP_DETAIL_SYSTEM_PROMPT,
} from './prompt';

test('gives the model an exact JSON contract for each stage', () => {
  assert.match(SOP_SKELETON_SYSTEM_PROMPT, /"schemaVersion":"1\.0"/);
  assert.match(SOP_SKELETON_SYSTEM_PROMPT, /"actors":\[\{"id"/);
  assert.match(
    SOP_STEP_DETAIL_SYSTEM_PROMPT,
    /"errorHandling":\[\{"kind":"system"/
  );
  assert.match(SOP_PLAN_SYSTEM_PROMPT, /"confirmationQuestions":\[/);
  assert.match(SOP_PLAN_SYSTEM_PROMPT, /"deploymentChecklist":\[/);
});

test('states the system and business exception rule', () => {
  assert.match(SOP_SKELETON_SYSTEM_PROMPT, /系统异常处理/);
  assert.match(
    SOP_STEP_DETAIL_SYSTEM_PROMPT,
    /业务异常已经是主干里的 next 分支/
  );
});
