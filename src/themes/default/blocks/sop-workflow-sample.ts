import type { SopAnalysis } from '@/shared/lib/sop-workflow';

// Shown before the first generation so users see what they will get. Generated
// by the real model from the first quick example (order fulfilment), with
// operation types and the trigger corrected by hand.
export const SAMPLE_WORKFLOWS: Record<
  'zh' | 'en',
  { sop: string; analysis: SopAnalysis }
> = {
  zh: {
    sop: '每天 9 点从 ERP 拉取待发货订单，检查库存。库存充足则通知仓库拣货；库存不足则通知采购，并记录异常。',
    analysis: {
      schemaVersion: '1.0',
      title: '每日待发货订单库存检查与处理流程',
      summary:
        '定时拉取待发货订单，按库存充足与否分别通知仓库拣货或通知采购并记录异常。',
      trigger: {
        type: 'schedule',
        description: '每天 9:00 自动触发',
        schedule: {
          hour: 9,
          minute: 0,
          timezone: 'Asia/Shanghai',
        },
      },
      actors: [
        {
          id: 'actor_system',
          name: 'ERP系统',
          responsibility: '定时拉取订单并检查库存',
        },
        {
          id: 'actor_warehouse',
          name: '仓库人员',
          responsibility: '接收拣货通知并执行拣货',
        },
        {
          id: 'actor_purchasing',
          name: '采购人员',
          responsibility: '接收缺货通知并处理补货',
        },
      ],
      steps: [
        {
          id: 'step_fetch_orders',
          title: '拉取待发货订单',
          description: '从ERP拉取待发货订单',
          source: 'source_text',
          ownerActorId: 'actor_system',
          operation: 'read',
          integration: {
            system: 'ERP系统',
            action: '查询待发货订单',
            credentialRequired: true,
            endpointKnown: false,
          },
          inputs: ['定时触发信号', '订单状态筛选条件'],
          outputs: ['待发货订单列表'],
          next: [
            {
              targetStepId: 'step_check_stock',
              label: '完成拉取',
              branch: 'default',
            },
          ],
          errorHandling: [
            {
              kind: 'system',
              scenario: 'ERP接口请求超时',
              action: '重试并告警通知运维',
            },
            {
              kind: 'system',
              scenario: 'ERP接口鉴权失效',
              action: '记录日志并提醒更新凭据',
            },
          ],
        },
        {
          id: 'step_check_stock',
          title: '检查库存',
          description: '检查订单物料库存是否充足',
          source: 'source_text',
          ownerActorId: 'actor_system',
          operation: 'condition',
          integration: {
            system: 'ERP系统',
            action: '查询物料可用库存',
            credentialRequired: true,
            endpointKnown: false,
          },
          inputs: ['待发货订单列表', '物料编码与需求量'],
          outputs: ['库存充足订单列表', '缺货订单列表'],
          next: [
            {
              targetStepId: 'step_notify_warehouse',
              label: '充足',
              condition: {
                leftValue: '{{$json.available_qty}}',
                operator: 'greaterThanOrEqual',
                rightValue: '{{$json.required_qty}}',
                explanation: '库存充足时通知拣货',
              },
              branch: 'true',
            },
            {
              targetStepId: 'step_handle_shortage',
              label: '不足',
              condition: {
                leftValue: '{{$json.available_qty}}',
                operator: 'lessThan',
                rightValue: '{{$json.required_qty}}',
                explanation: '库存不足时通知采购并记异常',
              },
              branch: 'false',
            },
          ],
          errorHandling: [
            {
              kind: 'system',
              scenario: '库存查询接口失败',
              action: '记录异常并通知运维',
            },
          ],
        },
        {
          id: 'step_notify_warehouse',
          title: '通知仓库拣货',
          description: '通知仓库安排拣货出库',
          source: 'source_text',
          ownerActorId: 'actor_warehouse',
          operation: 'notify',
          integration: {
            system: '消息通知系统',
            action: '发送仓库拣货任务',
            credentialRequired: true,
            endpointKnown: false,
          },
          inputs: ['库存充足订单列表'],
          outputs: ['拣货通知发送结果'],
          next: [
            {
              targetStepId: 'step_end',
              label: '完成通知',
              branch: 'default',
            },
          ],
          errorHandling: [
            {
              kind: 'system',
              scenario: '通知服务调用失败',
              action: '写入重试队列并告警',
            },
          ],
        },
        {
          id: 'step_handle_shortage',
          title: '通知采购并记录异常',
          description: '通知采购补货并记录异常',
          source: 'source_text',
          ownerActorId: 'actor_purchasing',
          operation: 'notify',
          integration: {
            system: 'ERP系统',
            action: '记录缺货并通知采购',
            credentialRequired: true,
            endpointKnown: false,
          },
          inputs: ['缺货订单列表'],
          outputs: ['采购通知结果', '异常日志记录'],
          next: [
            {
              targetStepId: 'step_end',
              label: '处理完毕',
              branch: 'default',
            },
          ],
          errorHandling: [
            {
              kind: 'system',
              scenario: '消息或日志接口失败',
              action: '记录错误并通知运维',
            },
          ],
        },
        {
          id: 'step_end',
          title: '流程结束',
          description: '完成本日订单检查处理',
          source: 'ai_inferred',
          operation: 'end',
          inputs: ['各分支执行状态'],
          outputs: ['流程执行汇总'],
          next: [],
          errorHandling: [],
        },
      ],
      assumptions: [
        '每天9点系统自动定时拉取全部待发货状态订单',
        '库存充足的判定基于当前可用物理库存而非在途库存',
      ],
      missingInformation: [
        '通知仓库拣货的具体通讯渠道',
        '通知采购人员的具体通讯渠道及异常记录载体',
      ],
      confirmationQuestions: [
        {
          id: 'warehouse_notify_channel',
          question: '系统通知仓库人员拣货的渠道是什么？',
          options: [
            {
              value: 'erp_task',
              label: 'ERP系统内置待办/任务',
            },
            {
              value: 'im_robot',
              label: '企微/钉钉群机器人消息',
            },
            {
              value: 'pda_push',
              label: 'WMS/PDA手持终端推送',
            },
          ],
          allowCustom: true,
        },
        {
          id: 'shortage_handle_target',
          question: '库存不足时，通过何种方式通知采购并记录异常？',
          options: [
            {
              value: 'im_and_log',
              label: '企微/钉钉机器人通知并在ERP标记异常订单',
            },
            {
              value: 'auto_pr',
              label: '自动生成ERP采购申请单并邮件抄送采购员',
            },
          ],
          allowCustom: true,
        },
      ],
      deploymentChecklist: [
        '在定时任务调度器配置每日9点的Cron表达式',
        '配置并验证ERP订单读取与库存锁定的API接口权限',
        '配置仓库与采购的即时通讯或消息推送接口集成凭证',
      ],
      risks: [
        {
          level: 'high',
          title: '库存并发超卖风险',
          description: '多笔订单同时检查相同SKU可能导致可用库存超额分配',
          mitigation: '检查库存时增加锁定或预占逻辑',
        },
        {
          level: 'medium',
          title: 'ERP接口超时或故障',
          description: '9点定时任务调用ERP拉取接口失败导致流程中断',
          mitigation: '设置失败自动重试机制与管理员告警通知',
        },
        {
          level: 'low',
          title: '定时任务重复拉取',
          description: '调度异常触发多次运行导致重复发送拣货或异常通知',
          mitigation: '根据订单号增加幂等校验与防重记录',
        },
      ],
      tests: [
        {
          name: '库存充足正常分支测试',
          input: '输入待发货订单A（需求量10），对应SKU可用库存为20',
          expected: '成功触发仓库拣货通知且不通知采购',
        },
        {
          name: '库存不足异常分支测试',
          input: '输入待发货订单B（需求量10），对应SKU可用库存为5',
          expected: '成功记录异常订单并向采购发送缺货通知',
        },
        {
          name: 'ERP接口超时失败重试测试',
          input: '模拟9点触发拉取订单时ERP网络中断返回504错误',
          expected: '系统执行指数退避重试并在失败3次后告警',
        },
      ],
    },
  },
  en: {
    sop: 'Every day at 9:00, fetch open shipments from the ERP and check inventory. If stock is available, notify the warehouse; otherwise alert procurement and log an exception.',
    analysis: {
      schemaVersion: '1.0',
      title: 'Daily Open Shipments and Inventory Check',
      summary:
        'Daily check of open shipments and inventory with routing to warehouse or procurement.',
      trigger: {
        type: 'schedule',
        description: 'Every day at 9:00',
        schedule: {
          hour: 9,
          minute: 0,
          timezone: 'Asia/Shanghai',
        },
      },
      actors: [
        {
          id: 'actor_erp_system',
          name: 'ERP System',
          responsibility:
            'Fetch shipments, verify stock, send alerts, log exceptions',
        },
        {
          id: 'actor_warehouse',
          name: 'Warehouse',
          responsibility: 'Receive stock availability notification',
        },
        {
          id: 'actor_procurement',
          name: 'Procurement',
          responsibility: 'Receive out-of-stock alert',
        },
      ],
      steps: [
        {
          id: 'step_fetch_and_check',
          title: 'Fetch & Check Stock',
          description: 'Fetch shipments and check inventory.',
          source: 'source_text',
          ownerActorId: 'actor_erp_system',
          operation: 'condition',
          integration: {
            system: 'ERP System',
            action: 'Fetch and verify',
            credentialRequired: true,
            endpointKnown: false,
          },
          inputs: ['Schedule trigger', 'ERP credentials'],
          outputs: ['Open shipment list', 'Inventory status'],
          next: [
            {
              targetStepId: 'step_notify_warehouse',
              label: 'In Stock',
              condition: {
                leftValue: '{{$json.inventory_status}}',
                operator: 'equals',
                rightValue: 'available',
                explanation: 'Stock is available for open shipments',
              },
              branch: 'true',
            },
            {
              targetStepId: 'step_alert_procurement',
              label: 'Out of Stock',
              condition: {
                leftValue: '{{$json.inventory_status}}',
                operator: 'notEquals',
                rightValue: 'available',
                explanation: 'Stock is insufficient or unavailable',
              },
              branch: 'false',
            },
          ],
          errorHandling: [
            {
              kind: 'system',
              scenario: 'ERP API failure',
              action: 'Log error and alert',
            },
          ],
        },
        {
          id: 'step_notify_warehouse',
          title: 'Notify Warehouse',
          description: 'Send notification to warehouse.',
          source: 'source_text',
          ownerActorId: 'actor_warehouse',
          operation: 'notify',
          integration: {
            system: 'Notification System',
            action: 'Send notice',
            credentialRequired: true,
            endpointKnown: false,
          },
          inputs: ['Open shipment list', 'Stock status'],
          outputs: ['Dispatch notice'],
          next: [
            {
              targetStepId: 'step_end',
              label: 'Done',
              branch: 'default',
            },
          ],
          errorHandling: [
            {
              kind: 'system',
              scenario: 'Message send failure',
              action: 'Retry and alert',
            },
          ],
        },
        {
          id: 'step_alert_procurement',
          title: 'Alert & Log Exception',
          description: 'Alert procurement and log exception.',
          source: 'source_text',
          ownerActorId: 'actor_procurement',
          operation: 'notify',
          integration: {
            system: 'ERP System',
            action: 'Alert and log',
            credentialRequired: true,
            endpointKnown: false,
          },
          inputs: ['Open shipment list', 'Stock shortage data'],
          outputs: ['Procurement alert', 'Exception log entry'],
          next: [
            {
              targetStepId: 'step_end',
              label: 'Done',
              branch: 'default',
            },
          ],
          errorHandling: [
            {
              kind: 'system',
              scenario: 'Log write failure',
              action: 'Alert administrator',
            },
          ],
        },
        {
          id: 'step_end',
          title: 'End',
          description: 'Daily process ends.',
          source: 'ai_inferred',
          operation: 'end',
          inputs: ['Execution status'],
          outputs: ['Process completed'],
          next: [],
          errorHandling: [],
        },
      ],
      assumptions: [
        'The ERP system provides stable scheduled batch job triggers and inventory query APIs.',
        'Shipments are evaluated at line-item level or whole-order level based on complete stock availability.',
      ],
      missingInformation: [
        'Specific communication channels for warehouse notifications and procurement alerts',
        'Exact destination and format for logging out-of-stock exceptions',
      ],
      confirmationQuestions: [
        {
          id: 'notification_channels',
          question:
            'Which channels should be used for warehouse notifications and procurement alerts?',
          options: [
            {
              value: 'email',
              label: 'Email',
            },
            {
              value: 'erp_internal_message',
              label: 'ERP Internal Message',
            },
          ],
          allowCustom: true,
        },
        {
          id: 'exception_log_target',
          question: 'Where should out-of-stock exceptions be logged?',
          options: [
            {
              value: 'erp_audit_table',
              label: 'ERP Exception Log Table',
            },
            {
              value: 'external_log_system',
              label: 'External Logging System (e.g., ELK)',
            },
          ],
          allowCustom: true,
        },
      ],
      deploymentChecklist: [
        'Configure and validate cron schedule for 09:00 daily execution.',
        'Set up API service credentials and access permissions for ERP shipments and inventory.',
        'Verify notification routing and template configuration for warehouse and procurement.',
      ],
      risks: [
        {
          level: 'high',
          title: 'ERP API Timeout or Failure',
          description:
            'Scheduled job fails if ERP inventory API is unreachable at 9:00.',
          mitigation:
            'Implement automatic retries and alert the system administrator upon continuous failures.',
        },
        {
          level: 'medium',
          title: 'Concurrent Inventory Reservation Conflict',
          description:
            'Stock marked available could be claimed by other sales orders before warehouse processing.',
          mitigation:
            'Apply soft reservation or lock inventory immediately upon matching open shipments.',
        },
      ],
      tests: [
        {
          name: 'Sufficient Stock Notification Test',
          input:
            'Run job with 1 open shipment where ERP inventory is fully available.',
          expected:
            'Warehouse receives fulfillment notification and no procurement alert is sent.',
        },
        {
          name: 'Out of Stock Exception Test',
          input:
            'Run job with 1 open shipment where required inventory is zero or insufficient.',
          expected:
            'Procurement alert is triggered and an exception record is successfully written.',
        },
        {
          name: 'ERP API Failure Boundary Test',
          input: 'Simulate network timeout during shipment fetch at 9:00.',
          expected:
            'Job retries up to configured limit, logs error, and halts without sending partial alerts.',
        },
      ],
    },
  },
};
