import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.LEADBRIDGE_TEST_DATABASE_URL;

test("PostgreSQL sync fencing serializes generations and rejects stale writes", { skip: !databaseUrl }, async (t) => {
  assert.ok(databaseUrl);
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  assert.match(databaseName, /test/i, "refusing to run against a database not named as a test database");
  process.env.DATABASE_URL = databaseUrl;

  const [{ prisma }, { ExecutionLock }, { withExecutionFence }] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/services/execution-lock.service"),
    import("../src/services/execution-fence"),
  ]);
  const lock = new ExecutionLock(prisma);
  const fixtures: string[] = [];
  const makeConnector = async () => {
    const id = `fence-test-${randomUUID()}`;
    const connector = await prisma.connector.create({ data: { id, name: id, type: "REST", enabled: true } });
    fixtures.push(connector.id);
    return connector.id;
  };
  const fence = (connectorId: string, executionId: string, generation: bigint) => ({ connectorId, executionId, generation });
  const expireLease = async (connectorId: string) => {
    await prisma.$executeRaw`UPDATE "Connector" SET "lockedAt" = clock_timestamp() - interval '2 minutes' WHERE "id" = ${connectorId}`;
  };

  try {
    await t.test("valid lease excludes a concurrent acquisition; expiry advances generation", async () => {
      const connectorId = await makeConnector();
      const generationA = await lock.acquire(connectorId, "worker-a");
      assert.equal(generationA, BigInt(1));
      assert.equal(await lock.acquire(connectorId, "worker-b"), null);
      await expireLease(connectorId);
      const generationB = await lock.acquire(connectorId, "worker-b");
      assert.equal(generationB, BigInt(2));
      assert.ok(generationB > generationA!);
    });

    await t.test("stale worker cannot write leads, sync history, or connector status", async () => {
      const connectorId = await makeConnector();
      const generationA = await lock.acquire(connectorId, "old-worker");
      assert.ok(generationA);
      await expireLease(connectorId);
      const generationB = await lock.acquire(connectorId, "new-worker");
      assert.ok(generationB);
      await assert.rejects(withExecutionFence(fence(connectorId, "old-worker", generationA!), (tx) => tx.lead.create({
        data: { displayName: "must roll back", connectorId },
      })));
      const run = await prisma.connectorSyncRun.create({ data: { connectorId, status: "ACTIVE" } });
      await assert.rejects(withExecutionFence(fence(connectorId, "old-worker", generationA!), async (tx) => {
        await tx.connectorSyncRun.update({ where: { id: run.id }, data: { status: "ACTIVE", errorMessage: "stale" } });
        await tx.connector.update({ where: { id: connectorId }, data: { status: "ERROR" } });
      }));
      assert.equal(await prisma.lead.count({ where: { connectorId } }), 0);
      assert.equal((await prisma.connectorSyncRun.findUniqueOrThrow({ where: { id: run.id } })).errorMessage, null);
      assert.equal((await prisma.connector.findUniqueOrThrow({ where: { id: connectorId } })).lockedBy, "new-worker");
    });

    await t.test("reclaimer waits for an in-flight fenced transaction, then fences later stale work", async () => {
      const connectorId = await makeConnector();
      const generationA = await lock.acquire(connectorId, "stalling-worker");
      assert.ok(generationA);
      let entered!: () => void;
      let resume!: () => void;
      const enteredBarrier = new Promise<void>((resolve) => { entered = resolve; });
      const resumeBarrier = new Promise<void>((resolve) => { resume = resolve; });
      const oldTransaction = withExecutionFence(fence(connectorId, "stalling-worker", generationA!), async (tx) => {
        await tx.connector.update({ where: { id: connectorId }, data: { lockedAt: new Date(0) } });
        await tx.lead.create({ data: { displayName: "commits before reclaim", connectorId } });
        entered();
        await resumeBarrier;
      });
      await enteredBarrier;
      const acquiring = lock.acquire(connectorId, "replacement-worker");
      let lockWaitObserved = false;
      try {
        for (let attempt = 0; attempt < 100; attempt++) {
          const waiters = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT count(*) AS count FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query LIKE '%UPDATE "Connector"%'
          `;
          if (waiters[0]?.count > BigInt(0)) { lockWaitObserved = true; break; }
          await new Promise<void>((resolve) => setTimeout(resolve, 20));
        }
      } finally {
        resume();
      }
      await oldTransaction;
      const generationB = await acquiring;
      assert.ok(lockWaitObserved, "reclaimer should be waiting on the connector row lock");
      assert.equal(generationB, generationA! + BigInt(1));
      await assert.rejects(withExecutionFence(fence(connectorId, "stalling-worker", generationA!), (tx) => tx.lead.create({
        data: { displayName: "stale after reclaim", connectorId },
      })));
      assert.equal(await prisma.lead.count({ where: { connectorId } }), 1);
    });

    await t.test("current worker can persist and complete; expired run recovery is atomic", async () => {
      const connectorId = await makeConnector();
      const generationA = await lock.acquire(connectorId, "normal-worker");
      assert.ok(generationA);
      const run = await withExecutionFence(fence(connectorId, "normal-worker", generationA!), (tx) => tx.connectorSyncRun.create({ data: { connectorId, status: "ACTIVE" } }));
      await withExecutionFence(fence(connectorId, "normal-worker", generationA!), async (tx) => {
        await tx.lead.create({ data: { displayName: "valid worker", connectorId } });
        await tx.connectorSyncRun.update({ where: { id: run.id }, data: { status: "ACTIVE", completedAt: new Date() } });
      });
      await expireLease(connectorId);
      const generationB = await lock.acquire(connectorId, "recovery-worker");
      assert.equal(generationB, generationA! + BigInt(1));
      assert.equal((await prisma.connectorSyncRun.findUniqueOrThrow({ where: { id: run.id } })).status, "ERROR");
      await assert.rejects(withExecutionFence(fence(connectorId, "normal-worker", generationA!), (tx) => tx.connector.update({ where: { id: connectorId }, data: { status: "ACTIVE" } })));
      assert.equal(await prisma.lead.count({ where: { connectorId } }), 1);
    });
  } finally {
    for (const id of fixtures) await prisma.connector.deleteMany({ where: { id } });
    await prisma.$disconnect();
  }
});
