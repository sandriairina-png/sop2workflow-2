# SOP2Workflow

SOP2Workflow 是面向 ERP 场景的 SOP 自动化工作台：输入业务流程，生成可审阅、可下载并导入 n8n 的工作流草稿。正式产品基于 Next.js，入口位于 `src/app`；`vite-src` 保留为早期独立 React 原型。

```bash
pnpm dev                 # SOP2Workflow / Next.js 主应用，默认端口 3000
pnpm dev:prototype       # SOP2Workflow 原型，默认端口 5173
pnpm build:prototype     # 检查并构建原型
```

当前基础版在浏览器本地解析 SOP，生成可导入 n8n 的流程骨架。ERP 接口、审批、复杂条件分支和凭据仍需在 n8n 中配置；项目内已经包含后续接入模型服务所需的 ERP 分析与 n8n 编排提示词。

## ShipAny 模板资料

## Getting Started

read [ShipAny Document](https://shipany.ai/docs/quick-start) to start your AI SaaS project.

## Buy Templates

check [ShipAny Templates](https://shipany.ai/templates) to buy Business Templates.

## Feedback

submit your feedbacks on [Github Issues](https://github.com/shipanyai/shipany-template-two/issues)

## LICENSE

!!! Please do not publicly release ShipAny's Code. Illegal use will be prosecuted

[ShipAny LICENSE](./LICENSE)
