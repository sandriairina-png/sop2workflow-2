import { createHash } from 'node:crypto';

import { and, eq, like, ne } from 'drizzle-orm';

import { config as configTable } from '@/config/db/schema';
import { db } from '@/core/db';

export type SopWorkflowQuotaLimits = {
  intervalMs: number;
  clientDaily: number;
  globalDaily: number;
};

export const SOP_WORKFLOW_DEFAULT_LIMITS: SopWorkflowQuotaLimits = {
  intervalMs: 10_000,
  clientDaily: 20,
  globalDaily: 200,
};

type ClientQuota = { count: number; lastAt: number };
export type QuotaDocument = {
  global: number;
  clients: Record<string, ClientQuota>;
};

export type QuotaDecision =
  | { allowed: true; remainingClient: number; remainingGlobal: number }
  | {
      allowed: false;
      code:
        | 'too_frequent'
        | 'client_daily_exhausted'
        | 'global_daily_exhausted'
        | 'quota_unavailable';
      retryAfterSeconds?: number;
    };

export type QuotaStore = {
  mutate<T>(
    dayKey: string,
    updater: (current: QuotaDocument) => {
      document: QuotaDocument;
      result: T;
    }
  ): Promise<T>;
};

function emptyDocument(): QuotaDocument {
  return { global: 0, clients: {} };
}

export function createMemoryQuotaStore(): QuotaStore {
  const documents = new Map<string, QuotaDocument>();
  return {
    async mutate(dayKey, updater) {
      const current = structuredClone(documents.get(dayKey) || emptyDocument());
      const { document, result } = updater(current);
      documents.set(dayKey, structuredClone(document));
      return result;
    },
  };
}

const databaseQuotaStore: QuotaStore = {
  async mutate(dayKey, updater) {
    return db().transaction(async (tx: any) => {
      await tx
        .insert(configTable)
        .values({ name: dayKey, value: JSON.stringify(emptyDocument()) })
        .onConflictDoNothing();

      const [row] = await tx
        .select()
        .from(configTable)
        .where(eq(configTable.name, dayKey))
        .for('update');
      if (!row) throw new Error('quota row unavailable');

      const current = row.value
        ? (JSON.parse(row.value) as QuotaDocument)
        : emptyDocument();
      const { document, result } = updater(current);
      await tx
        .update(configTable)
        .set({ value: JSON.stringify(document) })
        .where(eq(configTable.name, dayKey));

      await tx
        .delete(configTable)
        .where(
          and(
            like(configTable.name, 'sop-workflow-quota:%'),
            ne(configTable.name, dayKey)
          )
        );
      return result;
    });
  },
};

export function hashSopWorkflowClient(identity: string, salt: string) {
  return createHash('sha256').update(`${salt}|${identity}`).digest('hex');
}

export async function consumeSopWorkflowQuota({
  clientHash,
  now = new Date(),
  limits = SOP_WORKFLOW_DEFAULT_LIMITS,
  store = databaseQuotaStore,
}: {
  clientHash: string;
  now?: Date;
  limits?: SopWorkflowQuotaLimits;
  store?: QuotaStore;
}): Promise<QuotaDecision> {
  const day = now.toISOString().slice(0, 10);
  const dayKey = `sop-workflow-quota:${day}`;
  try {
    return await store.mutate(dayKey, (document) => {
      const current = document.clients[clientHash] || { count: 0, lastAt: 0 };
      const elapsed = now.getTime() - current.lastAt;
      if (current.lastAt && elapsed >= 0 && elapsed < limits.intervalMs) {
        return {
          document,
          result: {
            allowed: false,
            code: 'too_frequent',
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((limits.intervalMs - elapsed) / 1000)
            ),
          } as QuotaDecision,
        };
      }
      if (current.count >= limits.clientDaily) {
        return {
          document,
          result: {
            allowed: false,
            code: 'client_daily_exhausted',
          } as QuotaDecision,
        };
      }
      if (document.global >= limits.globalDaily) {
        return {
          document,
          result: {
            allowed: false,
            code: 'global_daily_exhausted',
          } as QuotaDecision,
        };
      }

      document.global += 1;
      document.clients[clientHash] = {
        count: current.count + 1,
        lastAt: now.getTime(),
      };
      return {
        document,
        result: {
          allowed: true,
          remainingClient: limits.clientDaily - current.count - 1,
          remainingGlobal: limits.globalDaily - document.global,
        } as QuotaDecision,
      };
    });
  } catch {
    return { allowed: false, code: 'quota_unavailable' };
  }
}

