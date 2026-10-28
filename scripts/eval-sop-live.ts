import { analyzeSopWithEvolink } from '../src/shared/lib/sop-workflow/evolink';

if (!process.env.EVOLINK_API_KEY) {
  throw new Error(
    'EVOLINK_API_KEY is required. Live evaluation is paid and must be run explicitly.'
  );
}

const cases = [
  {
    id: 'inventory-branch-live',
    sop: '每天 9 点检查 ERP 库存，库存充足通知仓库拣货，否则通知采购补货。',
  },
  {
    id: 'expense-boundary-live',
    sop: '报销小于 5000 元由主管审批，大于等于 5000 元由财务总监审批；驳回后通知员工修改。',
  },
];

for (const evaluation of cases) {
  const result = await analyzeSopWithEvolink({
    sop: evaluation.sop,
    locale: 'zh',
    triggerHint: 'auto',
  });
  process.stdout.write(
    `${JSON.stringify({
      id: evaluation.id,
      model: result.meta.model,
      promptVersion: result.meta.promptVersion,
      steps: result.analysis.steps.length,
      branches: result.analysis.steps.reduce(
        (total, step) =>
          total + (step.operation === 'condition' ? step.next.length : 0),
        0
      ),
      risks: result.analysis.risks.length,
      tests: result.analysis.tests.length,
    })}\n`
  );
}
