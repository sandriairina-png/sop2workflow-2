import assert from 'node:assert/strict';
import test from 'node:test';

import {
  consumeSopWorkflowQuota,
  createMemoryQuotaStore,
  hashSopWorkflowClient,
  SOP_WORKFLOW_DEFAULT_LIMITS,
} from './sop_workflow_quota';

test('enforces the 10 second minimum interval', async () => {
  const store = createMemoryQuotaStore();
  const now = new Date('2026-10-28T00:00:00.000Z');
  assert.equal(
    (await consumeSopWorkflowQuota({ clientHash: 'client-a', now, store }))
      .allowed,
    true
  );
  const second = await consumeSopWorkflowQuota({
    clientHash: 'client-a',
    now: new Date(now.getTime() + 9000),
    store,
  });
  assert.equal(second.allowed, false);
  assert.equal(second.code, 'too_frequent');
  assert.equal(SOP_WORKFLOW_DEFAULT_LIMITS.intervalMs, 10_000);
});

test('enforces client and global daily limits', async () => {
  const clientStore = createMemoryQuotaStore();
  const limits = { ...SOP_WORKFLOW_DEFAULT_LIMITS, clientDaily: 2 };
  const start = new Date('2026-10-28T00:00:00.000Z');
  for (let index = 0; index < 2; index += 1) {
    assert.equal(
      (
        await consumeSopWorkflowQuota({
          clientHash: 'client-a',
          now: new Date(start.getTime() + index * 11_000),
          limits,
          store: clientStore,
        })
      ).allowed,
      true
    );
  }
  const clientLimit = await consumeSopWorkflowQuota({
    clientHash: 'client-a',
    now: new Date(start.getTime() + 22_000),
    limits,
    store: clientStore,
  });
  assert.equal(clientLimit.allowed, false);
  if (clientLimit.allowed) assert.fail('expected client quota rejection');
  assert.equal(clientLimit.code, 'client_daily_exhausted');

  const globalStore = createMemoryQuotaStore();
  const globalLimits = {
    ...SOP_WORKFLOW_DEFAULT_LIMITS,
    clientDaily: 10,
    globalDaily: 2,
  };
  await consumeSopWorkflowQuota({
    clientHash: 'a',
    now: start,
    limits: globalLimits,
    store: globalStore,
  });
  await consumeSopWorkflowQuota({
    clientHash: 'b',
    now: start,
    limits: globalLimits,
    store: globalStore,
  });
  const globalLimit = await consumeSopWorkflowQuota({
    clientHash: 'c',
    now: start,
    limits: globalLimits,
    store: globalStore,
  });
  assert.equal(globalLimit.allowed, false);
  if (globalLimit.allowed) assert.fail('expected global quota rejection');
  assert.equal(globalLimit.code, 'global_daily_exhausted');
});

test('resets counts on a new UTC day', async () => {
  const store = createMemoryQuotaStore();
  const limits = { ...SOP_WORKFLOW_DEFAULT_LIMITS, clientDaily: 1 };
  await consumeSopWorkflowQuota({
    clientHash: 'client-a',
    now: new Date('2026-10-28T23:59:59.000Z'),
    limits,
    store,
  });
  const nextDay = await consumeSopWorkflowQuota({
    clientHash: 'client-a',
    now: new Date('2026-10-29T00:00:01.000Z'),
    limits,
    store,
  });
  assert.equal(nextDay.allowed, true);
});

test('stores a salted hash instead of raw client identity', () => {
  const hash = hashSopWorkflowClient('203.0.113.9|cookie-value', 'salt');
  assert.notEqual(hash, '203.0.113.9|cookie-value');
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('fails closed when the quota store is unavailable', async () => {
  const result = await consumeSopWorkflowQuota({
    clientHash: 'client-a',
    now: new Date(),
    store: {
      mutate: async () => {
        throw new Error('database down');
      },
    },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'quota_unavailable');
});
